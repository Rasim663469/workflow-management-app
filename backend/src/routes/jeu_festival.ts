import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

router.post('/', async (req, res) => {
    const { 
        jeu_id, 
        reservation_id, 
        zone_plan_id, 
        quantite, 
        nombre_tables_allouees 
    } = req.body;

    if (!jeu_id || !reservation_id || !zone_plan_id || !quantite) {
        return res.status(400).json({ 
            error: 'jeu_id, reservation_id, zone_plan_id et quantite sont requis.' 
        });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO jeu_festival 
            (jeu_id, reservation_id, zone_plan_id, quantite, nombre_tables_allouees) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *`,
            [jeu_id, reservation_id, zone_plan_id, quantite, nombre_tables_allouees || 0]
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
    const { reservation_id } = req.query;

    if (!reservation_id) {
        return res.status(400).json({ error: 'Le paramètre reservation_id est requis.' });
    }

    try {
        // On récupère aussi le nom du jeu et le nom de la zone pour l'affichage
        const query = `
            SELECT 
                jf.*, 
                j.nom AS nom_jeu, 
                j.type_jeu,
                zp.nom AS nom_zone
            FROM jeu_festival jf
            JOIN jeu j ON jf.jeu_id = j.id
            JOIN zone_plan zp ON jf.zone_plan_id = zp.id
            WHERE jf.reservation_id = $1
            ORDER BY j.nom ASC
        `;

        const { rows } = await pool.query(query, [reservation_id]);
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
        liste_demandee, 
        liste_obtenue, 
        jeux_recus 
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (quantite !== undefined) { updates.push(`quantite = $${paramIndex++}`); values.push(quantite); }
    if (nombre_tables_allouees !== undefined) { updates.push(`nombre_tables_allouees = $${paramIndex++}`); values.push(nombre_tables_allouees); }
    if (liste_demandee !== undefined) { updates.push(`liste_demandee = $${paramIndex++}`); values.push(liste_demandee); }
    if (liste_obtenue !== undefined) { updates.push(`liste_obtenue = $${paramIndex++}`); values.push(liste_obtenue); }
    if (jeux_recus !== undefined) { updates.push(`jeux_recus = $${paramIndex++}`); values.push(jeux_recus); }

    if (updates.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

    values.push(id);

    try {
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