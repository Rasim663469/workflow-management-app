import { Router } from 'express';
import pool from '../db/database.js';
import { requireRoles } from '../middleware/auth-admin.js';

const router = Router();

// CRÉER un contact 

router.post('/', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { editeur_id, nom, prenom, email, telephone, role } = req.body;

    if (!editeur_id || !nom || !prenom || !email) {
        return res.status(400).json({ 
            error: 'editeur_id, nom, prenom et email sont requis.' 
        });
    }

    try {
        const editeurCheck = await pool.query('SELECT id FROM editeur WHERE id = $1', [editeur_id]);
        if (editeurCheck.rows.length === 0) {
            return res.status(404).json({ error: 'L\'éditeur spécifié n\'existe pas.' });
        }

        const result = await pool.query(
            `INSERT INTO contact (editeur_id, nom, prenom, email, telephone, role) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [editeur_id, nom, prenom, email, telephone, role]
        );

        res.status(201).json({
            message: 'Contact créé avec succès',
            contact: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur lors de la création.' });
    }
});

// LISTE des contacts 
router.get('/', async (req, res) => {
    const { editeur_id } = req.query;

    try {
        let query = 'SELECT * FROM contact';
        const values = [];

        //On regarde si on veut un editeur précis 
        if (editeur_id) {
            query += ' WHERE editeur_id = $1';
            values.push(editeur_id);
        }
        
        query += ' ORDER BY nom, prenom';

        const { rows } = await pool.query(query, values);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// MODIFIER un contact
router.put('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { id } = req.params;
    const { nom, prenom, email, telephone, role } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nom !== undefined) { updates.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (prenom !== undefined) { updates.push(`prenom = $${paramIndex++}`); values.push(prenom); }
    if (email !== undefined) { updates.push(`email = $${paramIndex++}`); values.push(email); }
    if (telephone !== undefined) { updates.push(`telephone = $${paramIndex++}`); values.push(telephone); }
    if (role !== undefined) { updates.push(`role = $${paramIndex++}`); values.push(role); }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
    }

    values.push(id);

    try {
        const query = `UPDATE contact SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Contact non trouvé.' });
        }

        res.json({ message: 'Contact mis à jour', contact: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

// SUPPRIMER un contact 
router.delete('/:id', requireRoles(['super_admin', 'super_organisateur']), async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM contact WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Contact non trouvé.' });
        res.json({ message: 'Contact supprimé.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
});

export default router;
