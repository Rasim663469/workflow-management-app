import { Router } from 'express';
import pool from '../db/database.js';
import { requireRoles } from '../middleware/auth-admin.js';

const router = Router();

// CREATE : Ajouter une note de contact
router.post('/', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { editeur_id, festival_id, date_contact, notes, type_contact } = req.body;

    if (!editeur_id || !festival_id) {
        return res.status(400).json({ error: 'editeur_id et festival_id sont requis.' });
    }

    try {
        // Si date_contact n'est pas fourni, on utilise NOW() via SQL
        const normalizedType = typeof type_contact === 'string'
            ? type_contact.trim().toLowerCase()
            : null;

        const query = `
            INSERT INTO contact_editeur (editeur_id, festival_id, date_contact, notes, type_contact) 
            VALUES ($1, $2, COALESCE($3, NOW()), $4, $5) 
            RETURNING *
        `;
        
        const { rows } = await pool.query(query, [
            editeur_id,
            festival_id,
            date_contact,
            notes,
            normalizedType || null
        ]);

        res.status(201).json({
            message: 'Contact enregistré',
            contact: rows[0]
        });

    } catch (err: any) {
        console.error(err);
        if (err.code === '23503') {
            res.status(400).json({ error: 'L\'éditeur ou le festival n\'existe pas.' });
        } else {
            res.status(500).json({ error: 'Erreur serveur.' });
        }
    }
});

// get 
router.get('/', async (req, res) => {
    const { editeur_id, festival_id } = req.query;

    try {
        // On joint avec la table EDITEUR pour avoir le nom directement
        let query = `
            SELECT c.*, e.nom as nom_editeur 
            FROM contact_editeur c
            JOIN editeur e ON c.editeur_id = e.id
        `;
        const values = [];
        const conditions = [];

        if (editeur_id) {
            conditions.push(`c.editeur_id = $${conditions.length + 1}`);
            values.push(editeur_id);
        }

        if (festival_id) {
            conditions.push(`c.festival_id = $${conditions.length + 1}`);
            values.push(festival_id);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY c.date_contact DESC';

        const { rows } = await pool.query(query, values);
        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// UPDATE 
router.put('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { id } = req.params;
    const { date_contact, notes, type_contact } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (date_contact !== undefined) { updates.push(`date_contact = $${paramIndex++}`); values.push(date_contact); }
    if (notes !== undefined) { updates.push(`notes = $${paramIndex++}`); values.push(notes); }
    if (type_contact !== undefined) {
        updates.push(`type_contact = $${paramIndex++}`);
        values.push(
            typeof type_contact === 'string' ? type_contact.trim().toLowerCase() : null
        );
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Rien à modifier' });

    values.push(id);

    try {
        const query = `UPDATE contact_editeur SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const { rows } = await pool.query(query, values);

        if (rows.length === 0) return res.status(404).json({ error: 'Contact introuvable' });

        res.json({ message: 'Contact mis à jour', contact: rows[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE
router.delete('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { id } = req.params;

    try {
        const { rowCount } = await pool.query('DELETE FROM contact_editeur WHERE id = $1', [id]);

        if (rowCount === 0) return res.status(404).json({ error: 'Contact introuvable' });

        res.json({ message: 'Contact supprimé' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
