import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

// CRÉER un éditeur 
router.post('/', async (req, res) => {
  const { nom, description } = req.body;
  if (!nom) {
    return res.status(400).json({ error: 'Le nom est requis.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO editeur (nom, description) VALUES ($1, $2) RETURNING *',
      [nom, description || null]
    );
    res.status(201).json({
      message: 'Éditeur créé avec succès',
      editeur: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la création.' });
  }
});

// LISTE des éditeurs
router.get('/', async (req, res) => {
  const { sort } = req.query;
  let orderBy = 'id ASC';
  if (sort === 'nom') orderBy = 'nom ASC';
  if (sort === 'nom_desc') orderBy = 'nom DESC';
  
  try {
    const query = `SELECT * FROM editeur ORDER BY ${orderBy}`;
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération.' });
  }
});

// RÉCUPÉRER un éditeur par ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM editeur WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// 🆕 RÉCUPÉRER LES JEUX d'un éditeur
router.get('/:id/jeux', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Vérifier que l'éditeur existe
    const editeurCheck = await pool.query(
      'SELECT id FROM editeur WHERE id = $1',
      [id]
    );
    
    if (editeurCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }
    
    // Récupérer les jeux de l'éditeur
    const { rows } = await pool.query(
      `SELECT id, editeur_id, nom, auteurs, age_min, age_max, type_jeu 
       FROM jeu 
       WHERE editeur_id = $1 
       ORDER BY nom ASC`,
      [id]
    );
    
    // Renvoi en camelCase pour coller au modèle front
    const jeux = rows.map(row => ({
      id: String(row.id),
      editeurId: Number(row.editeur_id),
      name: row.nom,
      authors: row.auteurs,
      ageMin: row.age_min,
      ageMax: row.age_max,
      type: row.type_jeu
    }));
    
    res.json(jeux);
  } catch (err) {
    console.error('Erreur lors de la récupération des jeux:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des jeux.' });
  }
});

// MODIFIER un éditeur 
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, description } = req.body;
  
  // Construction dynamique de la requête pour ne modifier que ce qui est envoyé
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  if (nom !== undefined) {
    updates.push(`nom = $${paramIndex}`);
    values.push(nom);
    paramIndex++;
  }
  
  if (description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    values.push(description);
    paramIndex++;
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
  }
  
  values.push(id);
  const query = `
    UPDATE editeur 
    SET ${updates.join(', ')} 
    WHERE id = $${paramIndex}
    RETURNING *
  `;
  
  try {
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }
    res.json({
      message: 'Éditeur mis à jour avec succès',
      editeur: rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour.' });
  }
});

// SUPPRIMER un éditeur 
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM editeur WHERE id = $1',
      [id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }
    res.json({ message: 'Éditeur supprimé avec succès.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
  }
});

export default router;
