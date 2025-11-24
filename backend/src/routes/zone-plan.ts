import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

router.post('/', async (req, res) => {
    const { festival_id, zone_tarifaire_id, nom, nombre_tables } = req.body;

    if (!festival_id || !zone_tarifaire_id || !nombre_tables || !nom) {
        return res.status(400).json({ 
            error: 'festival_id, zone_tarifaire_id, nombre_tables et nom sont requis' 
        });
    }

    try {
        const result = await pool.query(
            'INSERT INTO zone_plan (festival_id, zone_tarifaire_id, nom, nombre_tables) VALUES ($1, $2, $3, $4) RETURNING *',
            [festival_id, zone_tarifaire_id, nom, nombre_tables]
        );

        res.status(201).json({
            message: 'Zone plan créée avec succès',
            zone_plan: result.rows[0]  
        });

    } catch (err: any) {
        if (err.code === '23503') {
            res.status(400).json({ 
                error: 'Le festival_id ou zone_tarifaire_id n\'existe pas' 
            });
        } 
        else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
        
    }
});


router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { rows } = await pool.query(
            'SELECT id, festival_id, zone_tarifaire_id, nom, nombre_tables FROM zone_plan WHERE id = $1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Zone plan non trouvée' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/', async (_req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, festival_id, zone_tarifaire_id, nom, nombre_tables FROM zone_plan ORDER BY nom'
        );
        
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, nombre_tables, festival_id, zone_tarifaire_id } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nom !== undefined) {
        updates.push(`nom = $${paramIndex}`);
        values.push(nom);
        paramIndex++;
    }

    if (nombre_tables !== undefined) {
        updates.push(`nombre_tables = $${paramIndex}`);
        values.push(nombre_tables);
        paramIndex++;
    }

    if (festival_id !== undefined) {
        updates.push(`festival_id = $${paramIndex}`);
        values.push(festival_id);
        paramIndex++;
    }

    if (zone_tarifaire_id !== undefined) {
        updates.push(`zone_tarifaire_id = $${paramIndex}`);
        values.push(zone_tarifaire_id);
        paramIndex++;
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    values.push(id);

    try {
        const query = `
            UPDATE zone_plan 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Zone plan non trouvée' });
        }

        res.json({
            message: 'Zone plan mise à jour avec succès',
            zone_plan: rows[0]
        });

    } catch (err: any) {
        if (err.code === '23503') {
            res.status(400).json({ 
                error: 'Le festival_id ou zone_tarifaire_id référencé n\'existe pas' 
            });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});


router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { rowCount } = await pool.query(
            'DELETE FROM zone_plan WHERE id = $1',
            [id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Zone plan non trouvée' });
        }

        res.status(200).json({ message: 'Zone plan supprimée avec succès' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
    }
});

export default router;