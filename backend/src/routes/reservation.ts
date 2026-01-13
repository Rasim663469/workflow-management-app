import { Router } from 'express';
import pool from '../db/database.js';

type ReservationLineInput = {
  zone_tarifaire_id: number;
  nombre_tables: number;
};

const router = Router();

const ALLOWED_WORKFLOWS = ['brouillon', 'envoyée', 'validée', 'annulée'] as const;
const DEFAULT_WORKFLOW = 'brouillon';

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

  const normalizedLines: ReservationLineInput[] = lignes
    .map((line: ReservationLineInput) => ({
      zone_tarifaire_id: Number(line.zone_tarifaire_id),
      nombre_tables: Math.max(1, Number(line.nombre_tables) || 0),
    }))
    .filter(line => Number.isFinite(line.zone_tarifaire_id) && line.nombre_tables > 0);

  if (normalizedLines.length === 0) {
    return res
      .status(400)
      .json({ error: 'Chaque ligne doit contenir un zone_tarifaire_id et un nombre_tables > 0.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Récupérer les zones tarifaires concernées et vérifier le festival + disponibilités
    const zoneInfos = new Map<
      number,
      { prix_table: number; disponibles: number; nom: string | null }
    >();

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

    // Calcul du prix de base
    const prixBase = normalizedLines.reduce((sum, line) => {
      const zone = zoneInfos.get(line.zone_tarifaire_id);
      return sum + line.nombre_tables * (zone?.prix_table ?? 0);
    }, 0);

    // Application des remises en tables (on retire en priorité les tables les plus chères)
    let tablesOffertes = Math.max(0, Number(remise_tables_offertes) || 0);
    let remiseMontantTables = 0;
    const linesByPrice = [...zoneInfos.entries()]
      .map(([zoneId, info]) => ({
        zoneId,
        prix_table: info.prix_table,
        tables: normalizedLines.find(l => l.zone_tarifaire_id === zoneId)?.nombre_tables ?? 0,
      }))
      .sort((a, b) => b.prix_table - a.prix_table);

    for (const line of linesByPrice) {
      if (tablesOffertes <= 0) break;
      const freeHere = Math.min(tablesOffertes, line.tables);
      remiseMontantTables += freeHere * line.prix_table;
      tablesOffertes -= freeHere;
    }

    const remiseMontant = Math.max(0, Number(remise_argent) || 0);
    const prixFinal = Math.max(0, prixBase - remiseMontant - remiseMontantTables);

    // Mise à jour du stock pour chaque zone
    for (const line of normalizedLines) {
      await client.query(
        `UPDATE zone_tarifaire 
         SET nombre_tables_disponibles = nombre_tables_disponibles - $1 
         WHERE id = $2`,
        [line.nombre_tables, line.zone_tarifaire_id]
      );
    }

    const workflow =
      typeof statut_workflow === 'string' && ALLOWED_WORKFLOWS.includes(statut_workflow as any)
        ? statut_workflow
        : DEFAULT_WORKFLOW;

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
        prixBase,
        prixFinal,
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
      prix: { base: prixBase, final: prixFinal, remise_montant: remiseMontant, remise_tables: remiseMontantTables },
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
      WHERE r.festival_id = $1
      GROUP BY r.id, e.nom
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
  const { statut_workflow, remise_argent, prix_final, editeur_presente_jeux } = req.body;

  const updates: string[] = [];
  const values: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (statut_workflow !== undefined) {
    const valid =
      typeof statut_workflow === 'string' && ALLOWED_WORKFLOWS.includes(statut_workflow as any);
    updates.push(`statut_workflow = $${paramIndex++}`);
    values.push(valid ? statut_workflow : DEFAULT_WORKFLOW);
  }
  if (remise_argent !== undefined) {
    updates.push(`remise_argent = $${paramIndex++}`);
    values.push(remise_argent);
  }
  if (prix_final !== undefined) {
    updates.push(`prix_final = $${paramIndex++}`);
    values.push(prix_final);
  }
  if (editeur_presente_jeux !== undefined) {
    updates.push(`editeur_presente_jeux = $${paramIndex++}`);
    values.push(editeur_presente_jeux);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

  values.push(id);

  try {
    const query = `UPDATE reservation SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) return res.status(404).json({ error: 'Réservation non trouvée' });

    res.json({ message: 'Réservation mise à jour', reservation: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
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
