import { Router } from 'express';
import pool from '../db/database.js';
import { requireAdmin } from '../middleware/auth-admin.js';

const router = Router();

// CREATE 
// CREATE 
router.post('/', requireAdmin, async (req, res) => {
    const { nom, location, nombre_total_tables, date_debut, date_fin, description } = req.body;

    if (!nom || !location || !nombre_total_tables || !date_debut || !date_fin || !description) {
        return res.status(400).json({ error: 'nom, location, nombre_total_tables, date_debut, date_fin, description sont requis' });
    }

    try {
        const { rows } = await pool.query(
            'INSERT INTO festival (nom, location, nombre_total_tables, date_debut, date_fin, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [nom, location, nombre_total_tables, date_debut, date_fin, description]
        );

        res.status(201).json({
            message: 'Festival créé avec succès',
            festival: rows[0]
        });

    } catch (err: any) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Nom de festival déjà existant' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

// READ ALL 
router.get('/', async (_req, res) => {
    try {
        // Ajout des alias (AS "nomEnCamelCase")
        const { rows } = await pool.query(
            `SELECT 
                id, 
                nom, 
                location, 
                nombre_total_tables AS "totalTables", 
                date_debut AS "dateDebut", 
                date_fin AS "dateFin", 
                description 
             FROM festival 
             ORDER BY date_debut DESC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// READ ONE 
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'SELECT * FROM festival WHERE id = $1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Festival non trouvé' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// UPDATE 
// UPDATE 
router.patch('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nom, location, nombre_total_tables, date_debut, date_fin, description } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nom !== undefined) { updates.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (location !== undefined) { updates.push(`location = $${paramIndex++}`); values.push(location); }
    if (nombre_total_tables !== undefined) { updates.push(`nombre_total_tables = $${paramIndex++}`); values.push(nombre_total_tables); }
    if (date_debut !== undefined) { updates.push(`date_debut = $${paramIndex++}`); values.push(date_debut); }
    if (date_fin !== undefined) { updates.push(`date_fin = $${paramIndex++}`); values.push(date_fin); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    values.push(id);

    try {
        const query = `
            UPDATE festival 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Festival non trouvé' });
        }

        res.json({
            message: 'Festival mis à jour avec succès',
            festival: rows[0]
        });

    } catch (err: any) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ce nom est déjà utilisé' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

// DELETE 
// DELETE 
router.delete('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {

        const { rowCount } = await pool.query(
            'DELETE FROM festival WHERE id = $1',
            [id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Festival non trouvé' });
        }

        res.status(200).json({ message: 'Festival supprimé avec succès' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
    }
});



export default router;