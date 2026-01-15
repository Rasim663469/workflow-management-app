import { Router } from 'express';
import pool from '../db/database.js';

type ReservationLineInput = {
  zone_tarifaire_id: number;
  nombre_tables: number;
};

const router = Router();

const ALLOWED_WORKFLOWS = [
  'brouillon',
  'pas_de_contact',
  'contact_pris',
  'discussion_en_cours',
  'sera_absent',
  'considere_absent',
  'present',
  'facture',
  'facture_payee',
  'envoyée',
  'validée',
  'annulée',
] as const;
const DEFAULT_WORKFLOW = 'pas_de_contact';

const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  brouillon: ['pas_de_contact', 'contact_pris', 'discussion_en_cours', 'present', 'annulée'],
  pas_de_contact: ['contact_pris', 'discussion_en_cours', 'sera_absent', 'considere_absent', 'present', 'annulée'],
  contact_pris: ['discussion_en_cours', 'sera_absent', 'considere_absent', 'present', 'annulée'],
  discussion_en_cours: ['sera_absent', 'considere_absent', 'present', 'annulée'],
  sera_absent: ['considere_absent', 'annulée'],
  considere_absent: ['contact_pris', 'discussion_en_cours', 'present', 'annulée'],
  present: ['facture', 'annulée'],
  facture: ['facture_payee', 'annulée'],
  facture_payee: [],
  envoyée: ['validée', 'annulée'],
  validée: ['facture', 'annulée'],
  annulée: [],
};

function isValidWorkflow(value: unknown): value is (typeof ALLOWED_WORKFLOWS)[number] {
  return typeof value === 'string' && ALLOWED_WORKFLOWS.includes(value as any);
}

function isTransitionAllowed(current: string, next: string): boolean {
  if (current === next) return true;
  const allowed = WORKFLOW_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

type ZoneInfo = { prix_table: number; disponibles: number; nom: string | null };

function normalizeLines(lignes: ReservationLineInput[]): ReservationLineInput[] {
  return lignes
    .map((line: ReservationLineInput) => ({
      zone_tarifaire_id: Number(line.zone_tarifaire_id),
      nombre_tables: Math.max(1, Number(line.nombre_tables) || 0),
    }))
    .filter(line => Number.isFinite(line.zone_tarifaire_id) && line.nombre_tables > 0);
}

function computePrice(
  lines: ReservationLineInput[],
  zoneInfos: Map<number, ZoneInfo>,
  remiseTablesOffertes: number,
  remiseArgent: number
): { base: number; final: number; remise_montant: number; remise_tables: number } {
  const prixBase = lines.reduce((sum, line) => {
    const zone = zoneInfos.get(line.zone_tarifaire_id);
    return sum + line.nombre_tables * (zone?.prix_table ?? 0);
  }, 0);

  let tablesOffertes = Math.max(0, Number(remiseTablesOffertes) || 0);
  let remiseMontantTables = 0;
  const linesByPrice = [...zoneInfos.entries()]
    .map(([zoneId, info]) => ({
      zoneId,
      prix_table: info.prix_table,
      tables: lines.find(l => l.zone_tarifaire_id === zoneId)?.nombre_tables ?? 0,
    }))
    .sort((a, b) => b.prix_table - a.prix_table);

  for (const line of linesByPrice) {
    if (tablesOffertes <= 0) break;
    const freeHere = Math.min(tablesOffertes, line.tables);
    remiseMontantTables += freeHere * line.prix_table;
    tablesOffertes -= freeHere;
  }

  const remiseMontant = Math.max(0, Number(remiseArgent) || 0);
  const prixFinal = Math.max(0, prixBase - remiseMontant - remiseMontantTables);

  return {
    base: prixBase,
    final: prixFinal,
    remise_montant: remiseMontant,
    remise_tables: remiseMontantTables,
  };
}

// CREATE with multiple tariff zones + price calculation
router.post('/', async (req, res) => {
  const {
    editeur_id,
    festival_id,
    lignes,
    remise_tables_offertes = 0,
    remise_argent = 0,
    editeur_presente_jeux = false,
    statut_workflow = DEFAULT_WORKFLOW,
  } = req.body;

  if (!editeur_id || !festival_id || !Array.isArray(lignes) || lignes.length === 0) {
    return res
      .status(400)
      .json({ error: 'editeur_id, festival_id et au moins une ligne de zone sont requis.' });
  }

  const normalizedLines: ReservationLineInput[] = normalizeLines(lignes);

  if (normalizedLines.length === 0) {
    return res
      .status(400)
      .json({ error: 'Chaque ligne doit contenir un zone_tarifaire_id et un nombre_tables > 0.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Récupérer les zones tarifaires concernées et vérifier le festival + disponibilités
    const zoneInfos = new Map<number, ZoneInfo>();

    for (const line of normalizedLines) {
      const zoneRes = await client.query(
        `SELECT id, festival_id, prix_table, nombre_tables_disponibles, nom 
         FROM zone_tarifaire 
         WHERE id = $1`,
        [line.zone_tarifaire_id]
      );

      const zone = zoneRes.rows[0];
      if (!zone || zone.festival_id !== Number(festival_id)) {
        throw new Error('ZONE_INVALID');
      }

      if (Number(zone.nombre_tables_disponibles) < line.nombre_tables) {
        throw new Error('STOCK_INSUFFISANT');
      }

      zoneInfos.set(line.zone_tarifaire_id, {
        prix_table: Number(zone.prix_table) || 0,
        disponibles: Number(zone.nombre_tables_disponibles) || 0,
        nom: zone.nom ?? null,
      });
    }

    const price = computePrice(
      normalizedLines,
      zoneInfos,
      remise_tables_offertes,
      remise_argent
    );

    // Mise à jour du stock pour chaque zone
    for (const line of normalizedLines) {
      await client.query(
        `UPDATE zone_tarifaire 
         SET nombre_tables_disponibles = nombre_tables_disponibles - $1 
         WHERE id = $2`,
        [line.nombre_tables, line.zone_tarifaire_id]
      );
    }

    const workflow = isValidWorkflow(statut_workflow) ? statut_workflow : DEFAULT_WORKFLOW;

    const insertReservation = await client.query(
      `INSERT INTO reservation 
       (editeur_id, festival_id, remise_tables_offertes, remise_argent, prix_total, prix_final, editeur_presente_jeux, statut_workflow) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        editeur_id,
        festival_id,
        remise_tables_offertes || 0,
        remise_argent || 0,
        price.base,
        price.final,
        editeur_presente_jeux,
        workflow,
      ]
    );

    const reservationId = insertReservation.rows[0]?.id;

    for (const line of normalizedLines) {
      await client.query(
        `INSERT INTO reservation_detail (reservation_id, zone_tarifaire_id, nombre_tables) 
         VALUES ($1, $2, $3)`,
        [reservationId, line.zone_tarifaire_id, line.nombre_tables]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Réservation créée',
      reservation: insertReservation.rows[0],
      lignes: normalizedLines,
      prix: price,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const dbError = err as { code?: string; message?: string };
    if (dbError.message === 'ZONE_INVALID') {
      res.status(400).json({ error: 'Zone tarifaire invalide pour ce festival.' });
    } else if (dbError.message === 'STOCK_INSUFFISANT') {
      res.status(400).json({ error: 'Tables insuffisantes dans une des zones demandées.' });
    } else if (dbError.code === '23503') {
      res
        .status(400)
        .json({ error: "Le festival ou l'éditeur spécifié n'existe pas, ou zone invalide." });
    } else {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  } finally {
    client.release();
  }
});

// LIST by festival (cards view)
router.get('/festival/:festivalId', async (req, res) => {
  const { festivalId } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        r.*,
        e.nom AS editeur_nom,
        COALESCE(SUM(rd.nombre_tables), 0) AS tables_totales,
        lc.last_contact,
        COALESCE(json_agg(
          json_build_object(
            'zone_tarifaire_id', rd.zone_tarifaire_id,
            'nombre_tables', rd.nombre_tables,
            'zone_nom', zt.nom,
            'prix_table', zt.prix_table
          )
        ) FILTER (WHERE rd.id IS NOT NULL), '[]') AS lignes
      FROM reservation r
      JOIN editeur e ON e.id = r.editeur_id
      LEFT JOIN LATERAL (
        SELECT MAX(date_contact) AS last_contact
        FROM contact_editeur c
        WHERE c.editeur_id = r.editeur_id AND c.festival_id = r.festival_id
      ) lc ON true
      LEFT JOIN reservation_detail rd ON rd.reservation_id = r.id
      LEFT JOIN zone_tarifaire zt ON rd.zone_tarifaire_id = zt.id
      WHERE r.festival_id = $1
      GROUP BY r.id, e.nom, lc.last_contact
      ORDER BY r.id DESC
      `,
      [festivalId]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// READ by filters (fallback)
router.get('/', async (req, res) => {
  const { festival_id, editeur_id } = req.query;

  try {
    let baseQuery = `
      SELECT 
        r.*,
        e.nom AS editeur_nom,
        COALESCE(SUM(rd.nombre_tables), 0) AS tables_totales
      FROM reservation r
      JOIN editeur e ON e.id = r.editeur_id
      LEFT JOIN reservation_detail rd ON rd.reservation_id = r.id
    `;
    const values: (string | number)[] = [];
    const where: string[] = [];

    if (festival_id) {
      values.push(festival_id as string);
      where.push(`r.festival_id = $${values.length}`);
    }

    if (editeur_id) {
      values.push(editeur_id as string);
      where.push(`r.editeur_id = $${values.length}`);
    }

    if (where.length > 0) {
      baseQuery += ` WHERE ${where.join(' AND ')}`;
    }

    baseQuery += ' GROUP BY r.id, e.nom ORDER BY r.id DESC';

    const { rows } = await pool.query(baseQuery, values);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DETAIL
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        r.*,
        e.nom AS editeur_nom,
        COALESCE(json_agg(
          json_build_object(
            'zone_tarifaire_id', rd.zone_tarifaire_id,
            'nombre_tables', rd.nombre_tables,
            'zone_nom', zt.nom,
            'prix_table', zt.prix_table
          )
        ) FILTER (WHERE rd.id IS NOT NULL), '[]') AS lignes
      FROM reservation r
      JOIN editeur e ON e.id = r.editeur_id
      LEFT JOIN reservation_detail rd ON rd.reservation_id = r.id
      LEFT JOIN zone_tarifaire zt ON rd.zone_tarifaire_id = zt.id
      WHERE r.id = $1
      GROUP BY r.id, e.nom
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Réservation non trouvée' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// UPDATE (workflow / remises / présence)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    statut_workflow,
    remise_argent,
    remise_tables_offertes,
    editeur_presente_jeux,
    lignes,
  } = req.body;

  const updates: string[] = [];
  const values: (string | number | boolean)[] = [];
  let paramIndex = 1;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const currentRes = await client.query('SELECT * FROM reservation WHERE id = $1', [id]);
    const reservation = currentRes.rows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const currentStatus = reservation.statut_workflow ?? DEFAULT_WORKFLOW;
    if (statut_workflow !== undefined) {
      if (!isValidWorkflow(statut_workflow)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Statut workflow invalide.' });
      }
      if (!isTransitionAllowed(currentStatus, statut_workflow)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Transition de workflow non autorisée.' });
      }
      updates.push(`statut_workflow = $${paramIndex++}`);
      values.push(statut_workflow);
    }

    if (remise_argent !== undefined) {
      updates.push(`remise_argent = $${paramIndex++}`);
      values.push(remise_argent);
    }
    if (remise_tables_offertes !== undefined) {
      updates.push(`remise_tables_offertes = $${paramIndex++}`);
      values.push(remise_tables_offertes);
    }
    if (editeur_presente_jeux !== undefined) {
      updates.push(`editeur_presente_jeux = $${paramIndex++}`);
      values.push(editeur_presente_jeux);
    }

    const existingDetails = await client.query(
      'SELECT zone_tarifaire_id, nombre_tables FROM reservation_detail WHERE reservation_id = $1',
      [id]
    );
    const existingLines = existingDetails.rows as ReservationLineInput[];

    const linesProvided = Array.isArray(lignes);
    const normalizedLines = linesProvided ? normalizeLines(lignes) : existingLines;
    if (linesProvided && normalizedLines.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chaque ligne doit contenir un zone_tarifaire_id et un nombre_tables > 0.' });
    }

    const zoneInfos = new Map<number, ZoneInfo>();
    for (const line of normalizedLines) {
      const zoneRes = await client.query(
        `SELECT id, festival_id, prix_table, nombre_tables_disponibles, nom 
         FROM zone_tarifaire 
         WHERE id = $1`,
        [line.zone_tarifaire_id]
      );
      const zone = zoneRes.rows[0];
      if (!zone || zone.festival_id !== Number(reservation.festival_id)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Zone tarifaire invalide pour ce festival.' });
      }
      zoneInfos.set(line.zone_tarifaire_id, {
        prix_table: Number(zone.prix_table) || 0,
        disponibles: Number(zone.nombre_tables_disponibles) || 0,
        nom: zone.nom ?? null,
      });
    }

    if (linesProvided) {
      const oldMap = new Map<number, number>();
      for (const line of existingLines) {
        oldMap.set(line.zone_tarifaire_id, Number(line.nombre_tables) || 0);
      }
      const newMap = new Map<number, number>();
      for (const line of normalizedLines) {
        newMap.set(line.zone_tarifaire_id, Number(line.nombre_tables) || 0);
      }
      const zoneIds = new Set<number>([...oldMap.keys(), ...newMap.keys()]);
      for (const zoneId of zoneIds) {
        const oldQty = oldMap.get(zoneId) ?? 0;
        const newQty = newMap.get(zoneId) ?? 0;
        const delta = newQty - oldQty;
        if (delta > 0) {
          const zone = zoneInfos.get(zoneId);
          if (!zone || zone.disponibles < delta) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Tables insuffisantes dans une des zones demandées.' });
          }
          await client.query(
            `UPDATE zone_tarifaire 
             SET nombre_tables_disponibles = nombre_tables_disponibles - $1 
             WHERE id = $2`,
            [delta, zoneId]
          );
        } else if (delta < 0) {
          await client.query(
            `UPDATE zone_tarifaire 
             SET nombre_tables_disponibles = nombre_tables_disponibles + $1 
             WHERE id = $2`,
            [Math.abs(delta), zoneId]
          );
        }
      }

      await client.query('DELETE FROM reservation_detail WHERE reservation_id = $1', [id]);
      for (const line of normalizedLines) {
        await client.query(
          `INSERT INTO reservation_detail (reservation_id, zone_tarifaire_id, nombre_tables) 
           VALUES ($1, $2, $3)`,
          [id, line.zone_tarifaire_id, line.nombre_tables]
        );
      }
    }

    const effectiveRemiseTables =
      remise_tables_offertes !== undefined ? remise_tables_offertes : reservation.remise_tables_offertes;
    const effectiveRemiseArgent =
      remise_argent !== undefined ? remise_argent : reservation.remise_argent;
    const price = computePrice(normalizedLines, zoneInfos, effectiveRemiseTables, effectiveRemiseArgent);

    updates.push(`prix_total = $${paramIndex++}`);
    values.push(price.base);
    updates.push(`prix_final = $${paramIndex++}`);
    values.push(price.final);

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Rien à modifier' });
    }

    values.push(id);

    const query = `UPDATE reservation SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const { rows } = await client.query(query, values);

    await client.query('COMMIT');
    res.json({ message: 'Réservation mise à jour', reservation: rows[0], prix: price });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// CONTACTS history for reservation (editeur + festival)
router.post('/:id/contacts', async (req, res) => {
  const { id } = req.params;
  const { date_contact, notes } = req.body;

  try {
    const reservationRes = await pool.query(
      'SELECT editeur_id, festival_id FROM reservation WHERE id = $1',
      [id]
    );
    const reservation = reservationRes.rows[0];
    if (!reservation) return res.status(404).json({ error: 'Réservation non trouvée' });

    const { rows } = await pool.query(
      `INSERT INTO contact_editeur (editeur_id, festival_id, date_contact, notes) 
       VALUES ($1, $2, COALESCE($3, NOW()), $4) 
       RETURNING *`,
      [reservation.editeur_id, reservation.festival_id, date_contact, notes]
    );

    res.status(201).json({ message: 'Contact enregistré', contact: rows[0] });
  } catch (err: any) {
    console.error(err);
    if (err.code === '23503') {
      res.status(400).json({ error: "L'éditeur ou le festival n'existe pas." });
    } else {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
});

router.get('/:id/contacts', async (req, res) => {
  const { id } = req.params;
  try {
    const reservationRes = await pool.query(
      'SELECT editeur_id, festival_id FROM reservation WHERE id = $1',
      [id]
    );
    const reservation = reservationRes.rows[0];
    if (!reservation) return res.status(404).json({ error: 'Réservation non trouvée' });

    const { rows } = await pool.query(
      `SELECT c.* 
       FROM contact_editeur c
       WHERE c.editeur_id = $1 AND c.festival_id = $2
       ORDER BY c.date_contact DESC`,
      [reservation.editeur_id, reservation.festival_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE (restock tables)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const detailRes = await client.query(
      'SELECT zone_tarifaire_id, nombre_tables FROM reservation_detail WHERE reservation_id = $1',
      [id]
    );

    const deleteDetails = await client.query('DELETE FROM reservation_detail WHERE reservation_id = $1', [id]);
    const deleteRes = await client.query('DELETE FROM reservation WHERE id = $1 RETURNING *', [id]);

    if (deleteRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    if ((deleteDetails.rowCount ?? 0) > 0) {
      for (const row of detailRes.rows) {
        await client.query(
          `UPDATE zone_tarifaire 
             SET nombre_tables_disponibles = nombre_tables_disponibles + $1 
           WHERE id = $2`,
          [row.nombre_tables, row.zone_tarifaire_id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Réservation supprimée et tables remises en stock.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

export default router;
