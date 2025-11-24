import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

// CRÉATION 
router.post('/', async (req, res) => {
    const { editeur_id, nom, auteurs, age_min, age_max, type_jeu } = req.body;

    // Seuls editeur_id et nom sont  obligatoires
    if (!editeur_id || !nom) {
        return res.status(400).json({ error: 'editeur_id et nom sont requis.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO jeu (editeur_id, nom, auteurs, age_min, age_max, type_jeu) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [editeur_id, nom, auteurs || null, age_min || null, age_max || null, type_jeu || null]
        );

        res.status(201).json({
            message: 'Jeu créé avec succès',
            jeu: result.rows[0]
        });

    } catch (err: any) {
        if (err.code === '23503') {
            res.status(400).json({ error: 'L\'éditeur spécifié n\'existe pas.' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
});

// GET ALL  ou UN EDITEUR 
router.get('/', async (req, res) => {
    const { editeur_id } = req.query;
    
    try {
        let query = 'SELECT * FROM jeu';
        const values = [];
        //Si on veut un éditeur précis
        if (editeur_id) {
            query += ' WHERE editeur_id = $1';
            values.push(editeur_id);
        }

        query += ' ORDER BY nom';

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// GET PAR ID JEUX
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM jeu WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Jeu non trouvé' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// MISE À JOUR 
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { nom, auteurs, age_min, age_max, type_jeu } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nom !== undefined) { updates.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (auteurs !== undefined) { updates.push(`auteurs = $${paramIndex++}`); values.push(auteurs); }
    if (age_min !== undefined) { updates.push(`age_min = $${paramIndex++}`); values.push(age_min); }
    if (age_max !== undefined) { updates.push(`age_max = $${paramIndex++}`); values.push(age_max); }
    if (type_jeu !== undefined) { updates.push(`type_jeu = $${paramIndex++}`); values.push(type_jeu); }

    if (updates.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

    values.push(id);

    try {
        const query = `UPDATE jeu SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const { rows } = await pool.query(query, values);

        if (rows.length === 0) return res.status(404).json({ error: 'Jeu non trouvé' });

        res.json({ message: 'Jeu mis à jour', jeu: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// SUPPRESSION 
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM jeu WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Jeu non trouvé' });
        res.json({ message: 'Jeu supprimé' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;