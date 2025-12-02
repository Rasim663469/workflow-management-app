import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

const isAdmin = (req: Express.Request) => req.user?.role === 'admin';

// CRÉER un éditeur (admin uniquement)
router.post('/', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { nom, description } = req.body;

  if (!nom) {
    return res.status(400).json({ error: 'Le nom est requis.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO editeur (nom, description)
       VALUES ($1, $2)
       ON CONFLICT (nom) DO NOTHING
       RETURNING id, nom, description`,
      [nom.trim(), description?.trim() || null]
    );

    const editeur = result.rows[0];
    if (!editeur) {
      return res.status(409).json({ error: 'Un éditeur avec ce nom existe déjà.' });
    }

    res.status(201).json({
      message: 'Éditeur créé avec succès',
      editeur: {
        id: editeur.id,
        name: editeur.nom,
        login: editeur.nom,
        description: editeur.description,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la création.' });
  }
});

// LISTE des éditeurs (authentifiés)
router.get('/', async (req, res) => {
  const { sort } = req.query;

  let orderBy = 'id ASC';
  if (sort === 'nom') orderBy = 'nom ASC';
  if (sort === 'nom_desc') orderBy = 'nom DESC';

  try {
    const query = `SELECT id, nom, description FROM editeur ORDER BY ${orderBy}`;

    const { rows } = await pool.query(query);
    const mapped = rows.map(row => ({
      id: row.id,
      name: row.nom,
      login: row.nom,
      description: row.description,
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération.' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query('SELECT id, nom, description FROM editeur WHERE id = $1', [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }

    const editeur = rows[0];
    res.json({
      id: editeur.id,
      name: editeur.nom,
      login: editeur.nom,
      description: editeur.description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// MODIFIER un éditeur (admin)
router.put('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { id } = req.params;
  const { nom, description } = req.body;

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
        RETURNING id, nom, description
    `;

  try {
    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }

    const editeur = rows[0];
    res.json({
      message: 'Éditeur mis à jour avec succès',
      editeur: {
        id: editeur.id,
        name: editeur.nom,
        login: editeur.nom,
        description: editeur.description,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour.' });
  }
});

// SUPPRIMER un éditeur (admin)
router.delete('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { id } = req.params;

  try {
    const { rowCount } = await pool.query('DELETE FROM editeur WHERE id = $1', [id]);

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
