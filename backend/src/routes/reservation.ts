import { Router } from 'express';
import pool from '../db/database.js';


const router = Router();

// CREATE 
router.post('/', async (req, res) => {
    const { 
        editeur_id, 
        festival_id, 
        remise_tables_offertes, 
        remise_argent, 
        prix_total, 
        prix_final, 
        editeur_presente_jeux, 
        statut_workflow,
        zone_tarifaire_id 
    } = req.body;

    if (!editeur_id || !festival_id || !zone_tarifaire_id) {
        return res.status(400).json({ error: 'Tous les champs sont requis, y compris la zone tarifaire.' });
    }
    
    try {
        // On tente de décrémenter le stock
        const updateZone = await pool.query(
            `UPDATE zone_tarifaire 
             SET nombre_tables_disponibles = nombre_tables_disponibles - 1 
             WHERE id = $1 AND nombre_tables_disponibles > 0 
             RETURNING *`,
            [zone_tarifaire_id]
        );

        if (updateZone.rowCount === 0) {
            return res.status(400).json({ error: 'Plus de tables disponibles dans cette zone ou zone invalide.' });
        }

        const result = await pool.query(
            `INSERT INTO reservation 
            (editeur_id, festival_id, remise_tables_offertes, remise_argent, prix_total, prix_final, editeur_presente_jeux, statut_workflow) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *`,
            [editeur_id, festival_id, remise_tables_offertes, remise_argent, prix_total, prix_final, editeur_presente_jeux, statut_workflow]
        );

        // 3. On lie la réservation à la zone dans le détail
        await pool.query(
            `INSERT INTO reservation_detail (reservation_id, zone_tarifaire_id, nombre_tables) VALUES ($1, $2, 1)`,
            [result.rows[0].id, zone_tarifaire_id]
        );

        res.status(201).json({
            message: 'Réservation créée et stock décrémenté', 
            reservation: result.rows[0],
            zone_update: updateZone.rows[0]
        });

    } catch (err) {
        console.error(err);
        const dbError = err as { code?: string };
        if (dbError.code === '23503') {
            res.status(400).json({ error: 'Le festival, l\'éditeur ou la zone spécifié n\'existe pas.' });
        } else {
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
});

// READ
router.get('/', async (req, res) => {

    const { festival_id, editeur_id } = req.query;
    
    try {
        let query = 'SELECT * FROM reservation';
        const values = [];

        if (festival_id) {
            query += ' WHERE festival_id = $1';
            values.push(festival_id);
        }
        
        if (editeur_id) {
            query += values.length > 0 ? ' AND editeur_id = $2' : ' WHERE editeur_id = $1';
            values.push(editeur_id);
        }

        query += ' ORDER BY id DESC';

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
        statut_workflow, 
        remise_argent, 
        prix_final, 
        editeur_presente_jeux 
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (statut_workflow !== undefined) { updates.push(`statut_workflow = $${paramIndex++}`); values.push(statut_workflow); }
    if (remise_argent !== undefined) { updates.push(`remise_argent = $${paramIndex++}`); values.push(remise_argent); }
    if (prix_final !== undefined) { updates.push(`prix_final = $${paramIndex++}`); values.push(prix_final); }
    if (editeur_presente_jeux !== undefined) { updates.push(`editeur_presente_jeux = $${paramIndex++}`); values.push(editeur_presente_jeux); }

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

// DELETE
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const detailRes = await pool.query(
            'SELECT zone_tarifaire_id, nombre_tables FROM reservation_detail WHERE reservation_id = $1',
            [id]
        );

        const deleteRes = await pool.query('DELETE FROM reservation WHERE id = $1 RETURNING *', [id]);

        if (deleteRes.rowCount === 0) {
            return res.status(404).json({ error: 'Réservation non trouvée' });
        }

        // Si la réservation avait réservé des tables
        if (detailRes.rows.length > 0) {
            const { zone_tarifaire_id, nombre_tables } = detailRes.rows[0];
            await pool.query(
                `UPDATE zone_tarifaire 
                 SET nombre_tables_disponibles = nombre_tables_disponibles + $1 
                 WHERE id = $2`,
                [nombre_tables, zone_tarifaire_id]
            );
        }

        res.json({ message: 'Réservation supprimée et tables remises en stock.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
