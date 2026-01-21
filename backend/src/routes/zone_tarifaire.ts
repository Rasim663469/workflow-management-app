import { Router } from 'express';
import pool from '../db/database.js';
import { requireRoles } from '../middleware/auth-admin.js';

const router = Router();

// CRÉATION 
router.post('/', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { festival_id, nom, nombre_tables_total, prix_table, prix_m2 } = req.body;

    if (!festival_id || !nom || !nombre_tables_total || prix_table === undefined) {
        return res.status(400).json({ 
            error: 'festival_id, nom, nombre_tables_total et prix_table sont requis.' 
        });
    }

    try {
        //Au départ, tables_disponibles = tables_total
        const result = await pool.query(
            `INSERT INTO zone_tarifaire 
            (festival_id, nom, nombre_tables_total, nombre_tables_disponibles, prix_table, prix_m2) 
            VALUES ($1, $2, $3, $3, $4, $5) 
            RETURNING *`,
            [festival_id, nom, nombre_tables_total, prix_table, prix_m2 ?? (prix_table / 4)]
        );

        res.status(201).json({
            message: 'Zone tarifaire créée',
            zone: result.rows[0]
        });

    } catch (err: any) {
        if (err.code === '23503') {
            res.status(400).json({ error: 'Le festival spécifié n\'existe pas.' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
});

// GET ALL ou FESTIVAL_ID
router.get('/', async (req, res) => {
    const { festival_id } = req.query;
    
    try {
        let query = 'SELECT * FROM zone_tarifaire';
        const values = [];

        if (festival_id) {
            query += ' WHERE festival_id = $1';
            values.push(festival_id);
        }

        query += ' ORDER BY nom';

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// MISE À JOUR 
router.put('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { id } = req.params;
    const { nom, nombre_tables_total, prix_table, prix_m2 } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    let currentTotal: number | null = null;
    let currentAvailable: number | null = null;

    if (nom !== undefined) { updates.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (nombre_tables_total !== undefined) {
        const nextTotal = Number(nombre_tables_total);
        if (!Number.isFinite(nextTotal) || nextTotal < 0) {
            return res.status(400).json({ error: 'nombre_tables_total invalide.' });
        }

        try {
            const { rows } = await pool.query(
                'SELECT nombre_tables_total, nombre_tables_disponibles FROM zone_tarifaire WHERE id = $1',
                [id]
            );
            if (rows.length === 0) return res.status(404).json({ error: 'Zone non trouvée' });
            currentTotal = Number(rows[0].nombre_tables_total ?? 0);
            currentAvailable = Number(rows[0].nombre_tables_disponibles ?? 0);
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erreur serveur' });
        }

        const usedTables = Math.max(0, currentTotal - currentAvailable);
        if (nextTotal < usedTables) {
            return res.status(400).json({
                error: 'nombre_tables_total ne peut pas être inférieur aux tables déjà réservées.',
            });
        }

        updates.push(`nombre_tables_total = $${paramIndex++}`);
        values.push(nextTotal);

        updates.push(`nombre_tables_disponibles = $${paramIndex++}`);
        values.push(nextTotal - usedTables);
    }
    if (prix_table !== undefined) { updates.push(`prix_table = $${paramIndex++}`); values.push(prix_table); }
    if (prix_m2 !== undefined) { updates.push(`prix_m2 = $${paramIndex++}`); values.push(prix_m2); }
    
   

    if (updates.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

    values.push(id);

    try {
        const query = `UPDATE zone_tarifaire SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const { rows } = await pool.query(query, values);

        if (rows.length === 0) return res.status(404).json({ error: 'Zone non trouvée' });

        res.json({ message: 'Zone mise à jour', zone: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// SUPPRESSION 
router.delete('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { id } = req.params;
    try {
        const usage = await pool.query(
            'SELECT COUNT(*) AS total FROM reservation_detail WHERE zone_tarifaire_id = $1',
            [id]
        );
        if (Number(usage.rows[0]?.total ?? 0) > 0) {
            return res.status(400).json({ error: 'Impossible de supprimer: réservations existantes.' });
        }

        const { rowCount } = await pool.query('DELETE FROM zone_tarifaire WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Zone non trouvée' });
        res.json({ message: 'Zone supprimée' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
