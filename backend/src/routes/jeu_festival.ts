import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

const TABLE_AREA_M2 = 4;
const ALLOWED_TABLE_TYPES = ['standard', 'grande', 'mairie'] as const;

function normalizeTableType(value: unknown): string {
    const normalized = String(value ?? '').toLowerCase();
    if (ALLOWED_TABLE_TYPES.includes(normalized as any)) return normalized;
    return 'standard';
}

async function getReservation(reservationId: number) {
    const { rows } = await pool.query(
        'SELECT id, festival_id FROM reservation WHERE id = $1',
        [reservationId]
    );
    return rows[0];
}

async function getZonePlan(zonePlanId: number) {
    const { rows } = await pool.query(
        'SELECT id, festival_id, zone_tarifaire_id, nombre_tables FROM zone_plan WHERE id = $1',
        [zonePlanId]
    );
    return rows[0];
}

async function getReservedTables(reservationId: number, zoneTarifaireId: number) {
    const { rows } = await pool.query(
        'SELECT nombre_tables, surface_m2 FROM reservation_detail WHERE reservation_id = $1 AND zone_tarifaire_id = $2',
        [reservationId, zoneTarifaireId]
    );
    const totals = rows.reduce(
        (sum: number, row: any) =>
            sum + Number(row.nombre_tables ?? 0) + Math.ceil(Number(row.surface_m2 ?? 0) / TABLE_AREA_M2),
        0
    );
    return totals;
}

async function getUsedTablesInZonePlan(zonePlanId: number, excludeId?: number) {
    const values: any[] = [zonePlanId];
    let query = 'SELECT COALESCE(SUM(tables_utilisees), 0) AS total FROM jeu_festival WHERE zone_plan_id = $1';
    if (excludeId) {
        values.push(excludeId);
        query += ` AND id <> $2`;
    }
    const { rows } = await pool.query(query, values);
    return Number(rows[0]?.total ?? 0);
}

async function getUsedTablesInReservationZone(reservationId: number, zoneTarifaireId: number, excludeId?: number) {
    const values: any[] = [reservationId, zoneTarifaireId];
    let query = `
        SELECT COALESCE(SUM(jf.tables_utilisees), 0) AS total
        FROM jeu_festival jf
        JOIN zone_plan zp ON jf.zone_plan_id = zp.id
        WHERE jf.reservation_id = $1 AND zp.zone_tarifaire_id = $2
    `;
    if (excludeId) {
        values.push(excludeId);
        query += ` AND jf.id <> $3`;
    }
    const { rows } = await pool.query(query, values);
    return Number(rows[0]?.total ?? 0);
}

router.post('/', async (req, res) => {
    const { 
        jeu_id, 
        reservation_id, 
        zone_plan_id, 
        quantite, 
        nombre_tables_allouees,
        type_table,
        tables_utilisees,
        liste_demandee,
        liste_obtenue,
        jeux_recus
    } = req.body;

    if (!jeu_id || !reservation_id || !quantite) {
        return res.status(400).json({ 
            error: 'jeu_id, reservation_id et quantite sont requis.' 
        });
    }

    try {
        const reservation = await getReservation(Number(reservation_id));
        if (!reservation) {
            return res.status(400).json({ error: 'Réservation invalide.' });
        }

        if (zone_plan_id) {
            const zonePlan = await getZonePlan(Number(zone_plan_id));
            if (!zonePlan) {
                return res.status(400).json({ error: 'Zone plan invalide.' });
            }
            if (Number(zonePlan.festival_id) !== Number(reservation.festival_id)) {
                return res.status(400).json({ error: 'Zone plan et réservation doivent appartenir au même festival.' });
            }

            const reservedTables = await getReservedTables(Number(reservation_id), Number(zonePlan.zone_tarifaire_id));
            if (reservedTables <= 0) {
                return res.status(400).json({ error: 'Aucune table réservée dans la zone tarifaire liée à cette zone plan.' });
            }

            const usedInZone = await getUsedTablesInReservationZone(Number(reservation_id), Number(zonePlan.zone_tarifaire_id));
            const tablesUsed = Number(tables_utilisees ?? nombre_tables_allouees ?? 0);
            if (usedInZone + tablesUsed > reservedTables) {
                return res.status(400).json({ error: 'Tables allouées dépassent la réservation sur cette zone tarifaire.' });
            }

            const usedInPlan = await getUsedTablesInZonePlan(Number(zone_plan_id));
            if (usedInPlan + tablesUsed > Number(zonePlan.nombre_tables)) {
                return res.status(400).json({ error: 'Capacité de la zone du plan dépassée.' });
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO jeu_festival 
            (jeu_id, reservation_id, zone_plan_id, quantite, nombre_tables_allouees, type_table, tables_utilisees, liste_demandee, liste_obtenue, jeux_recus) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [
                jeu_id,
                reservation_id,
                zone_plan_id ?? null,
                quantite,
                nombre_tables_allouees || 0,
                normalizeTableType(type_table),
                tables_utilisees || 1,
                Boolean(liste_demandee),
                Boolean(liste_obtenue),
                Boolean(jeux_recus)
            ]
        );

        res.status(201).json({
            message: 'Jeu ajouté à la réservation',
            jeu_festival: rows[0]
        });

    } catch (err: any) {
        console.error(err);
        if (err.code === '23503') {
            res.status(400).json({ error: 'Le jeu, la réservation ou la zone spécifiée n\'existe pas.' });
        } else {
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
});

// GET 
router.get('/', async (req, res) => {
    const { reservation_id, festival_id } = req.query;

    if (!reservation_id && !festival_id) {
        return res.status(400).json({ error: 'reservation_id ou festival_id est requis.' });
    }

    try {
        let query = `
            SELECT 
                jf.*, 
                j.nom AS nom_jeu, 
                j.type_jeu,
                zp.nom AS nom_zone,
                r.festival_id
            FROM jeu_festival jf
            JOIN jeu j ON jf.jeu_id = j.id
            JOIN reservation r ON jf.reservation_id = r.id
            LEFT JOIN zone_plan zp ON jf.zone_plan_id = zp.id
        `;
        const values: any[] = [];
        if (reservation_id) {
            values.push(reservation_id);
            query += ` WHERE jf.reservation_id = $1`;
        } else if (festival_id) {
            values.push(festival_id);
            query += ` WHERE r.festival_id = $1`;
        }
        query += ' ORDER BY j.nom ASC';

        const { rows } = await pool.query(query, values);
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// UPDATE 
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        quantite, 
        nombre_tables_allouees, 
        type_table,
        tables_utilisees,
        zone_plan_id,
        liste_demandee, 
        liste_obtenue, 
        jeux_recus 
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (quantite !== undefined) { updates.push(`quantite = $${paramIndex++}`); values.push(quantite); }
    if (nombre_tables_allouees !== undefined) { updates.push(`nombre_tables_allouees = $${paramIndex++}`); values.push(nombre_tables_allouees); }
    if (type_table !== undefined) { updates.push(`type_table = $${paramIndex++}`); values.push(normalizeTableType(type_table)); }
    if (tables_utilisees !== undefined) { updates.push(`tables_utilisees = $${paramIndex++}`); values.push(tables_utilisees); }
    if (zone_plan_id !== undefined) { updates.push(`zone_plan_id = $${paramIndex++}`); values.push(zone_plan_id); }
    if (liste_demandee !== undefined) { updates.push(`liste_demandee = $${paramIndex++}`); values.push(liste_demandee); }
    if (liste_obtenue !== undefined) { updates.push(`liste_obtenue = $${paramIndex++}`); values.push(liste_obtenue); }
    if (jeux_recus !== undefined) { updates.push(`jeux_recus = $${paramIndex++}`); values.push(jeux_recus); }

    if (updates.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

    values.push(id);

    try {
        const current = await pool.query('SELECT * FROM jeu_festival WHERE id = $1', [id]);
        const existing = current.rows[0];
        if (!existing) return res.status(404).json({ error: 'Ligne introuvable' });

        const reservation = await getReservation(Number(existing.reservation_id));
        if (!reservation) {
            return res.status(400).json({ error: 'Réservation invalide.' });
        }

        const nextZonePlanId = zone_plan_id !== undefined ? zone_plan_id : existing.zone_plan_id;
        const nextTablesUsed = Number(tables_utilisees ?? nombre_tables_allouees ?? existing.tables_utilisees ?? 0);

        if (nextZonePlanId) {
            const zonePlan = await getZonePlan(Number(nextZonePlanId));
            if (!zonePlan) {
                return res.status(400).json({ error: 'Zone plan invalide.' });
            }
            if (Number(zonePlan.festival_id) !== Number(reservation.festival_id)) {
                return res.status(400).json({ error: 'Zone plan et réservation doivent appartenir au même festival.' });
            }

            const reservedTables = await getReservedTables(Number(existing.reservation_id), Number(zonePlan.zone_tarifaire_id));
            if (reservedTables <= 0) {
                return res.status(400).json({ error: 'Aucune table réservée dans la zone tarifaire liée à cette zone plan.' });
            }

            const usedInZone = await getUsedTablesInReservationZone(Number(existing.reservation_id), Number(zonePlan.zone_tarifaire_id), Number(id));
            if (usedInZone + nextTablesUsed > reservedTables) {
                return res.status(400).json({ error: 'Tables allouées dépassent la réservation sur cette zone tarifaire.' });
            }

            const usedInPlan = await getUsedTablesInZonePlan(Number(nextZonePlanId), Number(id));
            if (usedInPlan + nextTablesUsed > Number(zonePlan.nombre_tables)) {
                return res.status(400).json({ error: 'Capacité de la zone du plan dépassée.' });
            }
        }

        const query = `UPDATE jeu_festival SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const { rows } = await pool.query(query, values);

        if (rows.length === 0) return res.status(404).json({ error: 'Ligne introuvable' });

        res.json({ message: 'Mise à jour effectuée', data: rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { rowCount } = await pool.query('DELETE FROM jeu_festival WHERE id = $1', [id]);

        if (rowCount === 0) return res.status(404).json({ error: 'Ligne introuvable' });

        res.json({ message: 'Jeu retiré de la réservation' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
