import { Router } from 'express';
import pool from '../db/database.js';
import type { PoolClient } from 'pg';
import { requireRoles } from '../middleware/auth-admin.js';

type ReservationLineInput = {
  zone_tarifaire_id: number;
  nombre_tables: number;
  surface_m2?: number;
};

const router = Router();

const ALLOWED_WORKFLOWS = ['present', 'facture', 'facture_payee', 'annulée'] as const;
const DEFAULT_WORKFLOW = 'present';
const TABLE_AREA_M2 = 4;
const PRICE_PER_OUTLET = 250;

const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  present: ['facture', 'annulée'],
  facture: ['facture_payee', 'annulée'],
  facture_payee: [],
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

type CrmStatus =
  | 'pas_de_contact'
  | 'contact_pris'
  | 'discussion_en_cours'
  | 'sera_absent'
  | 'considere_absent'
  | 'present';

function mapReservationStatusToCrm(status: string): CrmStatus | null {
  if (status === 'annulée') return 'sera_absent';
  if (status === 'facture' || status === 'facture_payee' || status === 'present') return 'present';
  return null;
}

async function syncCrmStatus(
  client: PoolClient,
  editeurId: number,
  festivalId: number,
  status: string
): Promise<void> {
  const crmStatus = mapReservationStatusToCrm(status);
  if (!crmStatus) return;
  await client.query(
    `
    INSERT INTO crm_suivi (editeur_id, festival_id, statut, derniere_relance)
    VALUES ($1, $2, $3::varchar, CASE WHEN $3::varchar = 'contact_pris' THEN NOW() ELSE NULL END)
    ON CONFLICT (editeur_id, festival_id)
    DO UPDATE SET statut = EXCLUDED.statut
    `,
    [editeurId, festivalId, crmStatus]
  );
}

type ZoneInfo = { prix_table: number; prix_m2: number; disponibles: number; nom: string | null };

function normalizeLines(lignes: ReservationLineInput[]): ReservationLineInput[] {
  return lignes
    .map((line: ReservationLineInput) => ({
      zone_tarifaire_id: Number(line.zone_tarifaire_id),
      nombre_tables: Math.max(0, Number(line.nombre_tables) || 0),
      surface_m2: Math.max(0, Number(line.surface_m2) || 0),
    }))
    .filter(
      line =>
        Number.isFinite(line.zone_tarifaire_id) &&
        (line.nombre_tables > 0 || (line.surface_m2 ?? 0) > 0)
    );
}

function tablesFromArea(surfaceM2: number): number {
  if (!surfaceM2 || surfaceM2 <= 0) return 0;
  return Math.ceil(surfaceM2 / TABLE_AREA_M2);
}

function lineTables(line: ReservationLineInput): number {
  return (Number(line.nombre_tables) || 0) + tablesFromArea(Number(line.surface_m2) || 0);
}

function computePrice(
  lines: ReservationLineInput[],
  zoneInfos: Map<number, ZoneInfo>,
  remiseTablesOffertes: number,
  remiseArgent: number,
  prisesElectriques: number
): { base: number; final: number; remise_montant: number; remise_tables: number } {
  const prixBaseSansPrises = lines.reduce((sum, line) => {
    const zone = zoneInfos.get(line.zone_tarifaire_id);
    const tables = Number(line.nombre_tables) || 0;
    const surface = Number(line.surface_m2) || 0;
    return (
      sum +
      tables * (zone?.prix_table ?? 0) +
      surface * (zone?.prix_m2 ?? 0)
    );
  }, 0);

  let tablesOffertes = Math.max(0, Number(remiseTablesOffertes) || 0);
  let remiseMontantTables = 0;
  const linesByPrice = [...zoneInfos.entries()]
    .map(([zoneId, info]) => ({
      zoneId,
      prix_table: info.prix_table,
      tables: (() => {
        const line = lines.find(l => l.zone_tarifaire_id === zoneId);
        return line ? lineTables(line) : 0;
      })(),
    }))
    .sort((a, b) => b.prix_table - a.prix_table);

  for (const line of linesByPrice) {
    if (tablesOffertes <= 0) break;
    const freeHere = Math.min(tablesOffertes, line.tables);
    remiseMontantTables += freeHere * line.prix_table;
    tablesOffertes -= freeHere;
  }

  const remiseMontant = Math.max(0, Number(remiseArgent) || 0);
  const coutPrises = Math.max(0, Number(prisesElectriques) || 0) * PRICE_PER_OUTLET;
  const prixBase = prixBaseSansPrises + coutPrises;
  const prixFinal = Math.max(0, prixBase - remiseMontant - remiseMontantTables);

  return {
    base: prixBase,
    final: prixFinal,
    remise_montant: remiseMontant,
    remise_tables: remiseMontantTables,
  };
}

// CREATE 
router.post('/', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
  const {
    editeur_id,
    festival_id,
    lignes,
    remise_tables_offertes = 0,
    remise_argent = 0,
    editeur_presente_jeux = false,
    besoin_animateur = false,
    prises_electriques = 0,
    notes = null,
    souhait_grandes_tables = 0,
    souhait_tables_standard = 0,
    souhait_tables_mairie = 0,
    statut_workflow = DEFAULT_WORKFLOW,
  } = req.body;

  if (!editeur_id || !festival_id || !Array.isArray(lignes) || lignes.length === 0) {
    return res
      .status(400)
      .json({ error: 'editeur_id, festival_id et au moins une ligne de zone sont requis.' });
  }

  const normalizedLines: ReservationLineInput[] = normalizeLines(lignes);

  if (normalizedLines.length === 0) {
    return res.status(400).json({
      error:
        'Chaque ligne doit contenir un zone_tarifaire_id et un nombre_tables ou surface_m2 > 0.',
    });
  }

  const totalReservedTables = normalizedLines.reduce(
    (sum, line) => sum + lineTables(line),
    0
  );
  const desiredTablesSum =
    (Number(souhait_grandes_tables) || 0) +
    (Number(souhait_tables_standard) || 0) +
    (Number(souhait_tables_mairie) || 0);
  if (desiredTablesSum > totalReservedTables) {
    return res.status(400).json({
      error:
        'La somme des souhaits (standard + grandes + mairie) ne doit pas dépasser le total réservé.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    
    const zoneInfos = new Map<number, ZoneInfo>();

    for (const line of normalizedLines) {
      const zoneRes = await client.query(
        `SELECT id, festival_id, prix_table, prix_m2, nombre_tables_disponibles, nom 
         FROM zone_tarifaire 
         WHERE id = $1`,
        [line.zone_tarifaire_id]
      );

      const zone = zoneRes.rows[0];
      if (!zone || zone.festival_id !== Number(festival_id)) {
        throw new Error('ZONE_INVALID');
      }

      const tablesNeeded = lineTables(line);
      if (Number(zone.nombre_tables_disponibles) < tablesNeeded) {
        throw new Error('STOCK_INSUFFISANT');
      }

      zoneInfos.set(line.zone_tarifaire_id, {
        prix_table: Number(zone.prix_table) || 0,
        prix_m2: Number(zone.prix_m2) || 0,
        disponibles: Number(zone.nombre_tables_disponibles) || 0,
        nom: zone.nom ?? null,
      });
    }

    const price = computePrice(
      normalizedLines,
      zoneInfos,
      remise_tables_offertes,
      remise_argent,
      prises_electriques
    );


    for (const line of normalizedLines) {
      await client.query(
        `UPDATE zone_tarifaire 
         SET nombre_tables_disponibles = nombre_tables_disponibles - $1 
         WHERE id = $2`,
        [lineTables(line), line.zone_tarifaire_id]
      );
    }

    const workflow = isValidWorkflow(statut_workflow) ? statut_workflow : DEFAULT_WORKFLOW;

    const insertReservation = await client.query(
      `INSERT INTO reservation 
       (editeur_id, festival_id, remise_tables_offertes, remise_argent, prix_total, prix_final,
        editeur_presente_jeux, besoin_animateur, prises_electriques, notes, souhait_grandes_tables,
        souhait_tables_standard, souhait_tables_mairie, statut_workflow) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       RETURNING *`,
      [
        editeur_id,
        festival_id,
        remise_tables_offertes || 0,
        remise_argent || 0,
        price.base,
        price.final,
        editeur_presente_jeux,
        besoin_animateur,
        Number(prises_electriques) || 0,
        notes,
        Number(souhait_grandes_tables) || 0,
        Number(souhait_tables_standard) || 0,
        Number(souhait_tables_mairie) || 0,
        workflow,
      ]
    );

    const reservationId = insertReservation.rows[0]?.id;

    for (const line of normalizedLines) {
      await client.query(
        `INSERT INTO reservation_detail 
          (reservation_id, zone_tarifaire_id, nombre_tables, surface_m2, prix_table_snapshot, prix_m2_snapshot) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reservationId,
          line.zone_tarifaire_id,
          line.nombre_tables,
          line.surface_m2 ?? 0,
          zoneInfos.get(line.zone_tarifaire_id)?.prix_table ?? 0,
          zoneInfos.get(line.zone_tarifaire_id)?.prix_m2 ?? 0,
        ]
      );
    }

    await syncCrmStatus(client, Number(editeur_id), Number(festival_id), workflow);

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


router.get(
  '/festival/:festivalId',
  requireRoles(['super_admin', 'super_organisateur', 'organisateur', 'benevole']),
  async (req, res) => {
  const { festivalId } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        r.*,
        e.nom AS editeur_nom,
        (
          COALESCE(SUM(rd.nombre_tables), 0)
          + COALESCE(SUM(CEIL(COALESCE(rd.surface_m2, 0) / 4.0)), 0)
        ) AS tables_totales,
        lc.last_contact,
        COALESCE(json_agg(
          json_build_object(
            'zone_tarifaire_id', rd.zone_tarifaire_id,
            'nombre_tables', rd.nombre_tables,
            'surface_m2', rd.surface_m2,
            'zone_nom', zt.nom,
            'prix_table', zt.prix_table,
            'prix_m2', zt.prix_m2
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


router.get(
  '/',
  requireRoles(['super_admin', 'super_organisateur', 'organisateur', 'benevole']),
  async (req, res) => {
  const { festival_id, editeur_id } = req.query;

  try {
    let baseQuery = `
      SELECT 
        r.*,
        e.nom AS editeur_nom,
        (
          COALESCE(SUM(rd.nombre_tables), 0)
          + COALESCE(SUM(CEIL(COALESCE(rd.surface_m2, 0) / 4.0)), 0)
        ) AS tables_totales
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
router.get(
  '/:id',
  requireRoles(['super_admin', 'super_organisateur', 'organisateur', 'benevole']),
  async (req, res) => {
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
            'surface_m2', rd.surface_m2,
            'zone_nom', zt.nom,
            'prix_table', zt.prix_table,
            'prix_m2', zt.prix_m2
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

// UPDATE 
router.put('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
  const { id } = req.params;
  const {
    statut_workflow,
    remise_argent,
    remise_tables_offertes,
    editeur_presente_jeux,
    besoin_animateur,
    prises_electriques,
    notes,
    souhait_grandes_tables,
    souhait_tables_standard,
    souhait_tables_mairie,
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
      if (statut_workflow === 'facture' && !reservation.date_facturation) {
        updates.push('date_facturation = NOW()');
      }
      if (statut_workflow === 'facture_payee' && !reservation.date_paiement) {
        updates.push('date_paiement = NOW()');
      }
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
    if (besoin_animateur !== undefined) {
      updates.push(`besoin_animateur = $${paramIndex++}`);
      values.push(besoin_animateur);
    }
    if (prises_electriques !== undefined) {
      updates.push(`prises_electriques = $${paramIndex++}`);
      values.push(prises_electriques);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }
    if (souhait_grandes_tables !== undefined) {
      updates.push(`souhait_grandes_tables = $${paramIndex++}`);
      values.push(souhait_grandes_tables);
    }
    if (souhait_tables_standard !== undefined) {
      updates.push(`souhait_tables_standard = $${paramIndex++}`);
      values.push(souhait_tables_standard);
    }
    if (souhait_tables_mairie !== undefined) {
      updates.push(`souhait_tables_mairie = $${paramIndex++}`);
      values.push(souhait_tables_mairie);
    }

    const existingDetails = await client.query(
      'SELECT zone_tarifaire_id, nombre_tables, surface_m2 FROM reservation_detail WHERE reservation_id = $1',
      [id]
    );
    const existingLines = existingDetails.rows as ReservationLineInput[];

    const linesProvided = Array.isArray(lignes);
    const normalizedLines = linesProvided ? normalizeLines(lignes) : existingLines;
    if (linesProvided && normalizedLines.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error:
          'Chaque ligne doit contenir un zone_tarifaire_id et un nombre_tables ou surface_m2 > 0.',
      });
    }

    const totalReservedTables = normalizedLines.reduce(
      (sum, line) => sum + lineTables(line),
      0
    );
    const desiredGrandes =
      souhait_grandes_tables !== undefined
        ? Number(souhait_grandes_tables) || 0
        : Number(reservation.souhait_grandes_tables ?? 0);
    const desiredStandard =
      souhait_tables_standard !== undefined
        ? Number(souhait_tables_standard) || 0
        : Number(reservation.souhait_tables_standard ?? 0);
    const desiredMairie =
      souhait_tables_mairie !== undefined
        ? Number(souhait_tables_mairie) || 0
        : Number(reservation.souhait_tables_mairie ?? 0);
    const desiredTablesSum = desiredGrandes + desiredStandard + desiredMairie;
    if (desiredTablesSum > totalReservedTables) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error:
          'La somme des souhaits (standard + grandes + mairie) ne doit pas dépasser le total réservé.',
      });
    }

    const zoneInfos = new Map<number, ZoneInfo>();
    for (const line of normalizedLines) {
      const zoneRes = await client.query(
        `SELECT id, festival_id, prix_table, prix_m2, nombre_tables_disponibles, nom 
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
        prix_m2: Number(zone.prix_m2) || 0,
        disponibles: Number(zone.nombre_tables_disponibles) || 0,
        nom: zone.nom ?? null,
      });
    }

    if (linesProvided) {
      const oldMap = new Map<number, number>();
      for (const line of existingLines) {
        oldMap.set(line.zone_tarifaire_id, lineTables(line));
      }
      const newMap = new Map<number, number>();
      for (const line of normalizedLines) {
        newMap.set(line.zone_tarifaire_id, lineTables(line));
      }
      const zoneIds = new Set<number>([...oldMap.keys(), ...newMap.keys()]);

      for (const zoneId of zoneIds) {
        const zoneRes = await client.query(
          `SELECT id, festival_id, nombre_tables_disponibles
           FROM zone_tarifaire
           WHERE id = $1`,
          [zoneId]
        );
        const zone = zoneRes.rows[0];
        if (!zone || zone.festival_id !== Number(reservation.festival_id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Zone tarifaire invalide pour ce festival.' });
        }

        const oldQty = oldMap.get(zoneId) ?? 0;
        const newQty = newMap.get(zoneId) ?? 0;
        const available = Number(zone.nombre_tables_disponibles ?? 0) + oldQty;
        if (newQty > available) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Tables insuffisantes dans une des zones demandées.' });
        }
        await client.query(
          `UPDATE zone_tarifaire
             SET nombre_tables_disponibles = $1
           WHERE id = $2`,
          [available - newQty, zoneId]
        );
      }

      await client.query('DELETE FROM reservation_detail WHERE reservation_id = $1', [id]);
      for (const line of normalizedLines) {
        await client.query(
          `INSERT INTO reservation_detail 
            (reservation_id, zone_tarifaire_id, nombre_tables, surface_m2, prix_table_snapshot, prix_m2_snapshot) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            line.zone_tarifaire_id,
            line.nombre_tables,
            line.surface_m2 ?? 0,
            zoneInfos.get(line.zone_tarifaire_id)?.prix_table ?? 0,
            zoneInfos.get(line.zone_tarifaire_id)?.prix_m2 ?? 0,
          ]
        );
      }
    }

    const effectiveRemiseTables =
      remise_tables_offertes !== undefined ? remise_tables_offertes : reservation.remise_tables_offertes;
    const effectiveRemiseArgent =
      remise_argent !== undefined ? remise_argent : reservation.remise_argent;
    const effectivePrises =
      prises_electriques !== undefined ? prises_electriques : reservation.prises_electriques ?? 0;
    const price = computePrice(
      normalizedLines,
      zoneInfos,
      effectiveRemiseTables,
      effectiveRemiseArgent,
      effectivePrises
    );

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

    if (statut_workflow !== undefined) {
      await syncCrmStatus(client, reservation.editeur_id, reservation.festival_id, statut_workflow);
    }

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

// CREATE facture 
router.post('/:id/factures', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reservationRes = await client.query(
      'SELECT id, festival_id, prix_final, prix_total, statut_workflow, date_facturation FROM reservation WHERE id = $1',
      [id]
    );
    const reservation = reservationRes.rows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const existing = await client.query(
      'SELECT id FROM facture WHERE reservation_id = $1',
      [reservation.id]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Une facture existe déjà pour cette réservation.' });
    }

    const currentStatus = reservation.statut_workflow ?? DEFAULT_WORKFLOW;
    if (!isTransitionAllowed(currentStatus, 'facture')) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Transition de workflow non autorisée.' });
    }

    const amount = Number(reservation.prix_final ?? reservation.prix_total ?? 0);
    const year = new Date().getFullYear();
    const numero = `FAC-${reservation.festival_id}-${year}-${reservation.id}`;

    const factureRes = await client.query(
      `INSERT INTO facture (reservation_id, numero, montant_ttc, statut, emise_le)
       VALUES ($1, $2, $3, 'facture', NOW())
       RETURNING *`,
      [reservation.id, numero, amount]
    );

    await client.query(
      `UPDATE reservation
       SET statut_workflow = 'facture',
           date_facturation = COALESCE(date_facturation, NOW())
       WHERE id = $1`,
      [reservation.id]
    );

    await client.query('COMMIT');
    res.status(201).json({
      message: 'Facture créée',
      facture: factureRes.rows[0],
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err?.code === '23505') {
      res.status(409).json({ error: 'Numéro de facture déjà utilisé.' });
    } else {
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } finally {
    client.release();
  }
});

// CONTACTS
router.post('/:id/contacts', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
  const { id } = req.params;
  const { date_contact, notes, type_contact } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reservationRes = await client.query(
      'SELECT id, editeur_id, festival_id, statut_workflow FROM reservation WHERE id = $1',
      [id]
    );
    const reservation = reservationRes.rows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }

    const { rows } = await client.query(
      `INSERT INTO contact_editeur (editeur_id, festival_id, date_contact, notes, type_contact) 
       VALUES ($1, $2, COALESCE($3, NOW()), $4, $5) 
       RETURNING *`,
      [reservation.editeur_id, reservation.festival_id, date_contact, notes, type_contact]
    );

    await client.query(
      `
      INSERT INTO crm_suivi (editeur_id, festival_id, statut, derniere_relance)
      VALUES ($1, $2, 'contact_pris', NOW())
      ON CONFLICT (editeur_id, festival_id)
      DO UPDATE SET statut = 'contact_pris', derniere_relance = NOW()
      `,
      [reservation.editeur_id, reservation.festival_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Contact enregistré', contact: rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23503') {
      res.status(400).json({ error: "L'éditeur ou le festival n'existe pas." });
    } else {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  } finally {
    client.release();
  }
});

router.get(
  '/:id/contacts',
  requireRoles(['super_admin', 'super_organisateur', 'organisateur', 'benevole']),
  async (req, res) => {
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

// DELETE 
router.delete('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const reservationRes = await client.query(
      'SELECT id, statut_workflow FROM reservation WHERE id = $1',
      [id]
    );
    const reservation = reservationRes.rows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }
    const rawStatus = String(reservation.statut_workflow ?? '')
      .toLowerCase()
      .replace(/\s+/g, '_');
    if (rawStatus === 'facture_payee') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Suppression interdite : facture payée.' });
    }

    const detailRes = await client.query(
      'SELECT zone_tarifaire_id, nombre_tables, surface_m2 FROM reservation_detail WHERE reservation_id = $1',
      [id]
    );

    await client.query('DELETE FROM jeu_festival WHERE reservation_id = $1', [id]);
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
          [lineTables(row as ReservationLineInput), row.zone_tarifaire_id]
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
