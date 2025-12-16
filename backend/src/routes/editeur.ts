import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/database.js';

const router = Router();

const isAdmin = (req: Express.Request) => req.user?.role === 'admin';

// CRÉER un éditeur (admin uniquement) : crée aussi le compte user associé
router.post('/', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { nom, description } = req.body;
  const normalizedName = typeof nom === 'string' ? nom.trim() : '';

  if (!normalizedName) {
    return res.status(400).json({ error: 'Le nom est requis.' });
  }

  try {
    const passwordHash = await bcrypt.hash('editeur123', 10);

    // Crée le compte user
    const userInsert = await pool.query(
      `INSERT INTO users (login, password_hash, role)
       VALUES ($1, $2, 'editeur')
       ON CONFLICT (login) DO NOTHING
       RETURNING id, login`,
      [normalizedName, passwordHash]
    );

    const user = userInsert.rows[0];
    if (!user) {
      return res.status(409).json({ error: 'Un éditeur avec ce nom existe déjà.' });
    }

    // Crée/associe la fiche éditeur avec le même id
    await pool.query(
      `INSERT INTO editeur (id, nom, login, password_hash, description)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, normalizedName, normalizedName, passwordHash, description?.trim() || null]
    );

    res.status(201).json({
      message: 'Éditeur créé avec succès',
      editeur: {
        id: user.id,
        name: normalizedName,
        login: user.login,
        description: description?.trim() || null,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la création.' });
  }
});

// LISTE des éditeurs (authentifiés)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.nom, e.login, e.description
         FROM editeur e
        ORDER BY e.nom`
    );

    const mapped = rows.map(row => ({
      id: row.id,
      name: row.nom,
      login: row.login,
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
    const { rows } = await pool.query(
      'SELECT id, nom, login, description FROM editeur WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }

    const editeur = rows[0];
    res.json({
      id: editeur.id,
      name: editeur.nom,
      login: editeur.login,
      description: editeur.description,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Jeux d'un éditeur (authentifiés)
router.get('/:id/jeux', async (req, res) => {
  const editeurId = Number(req.params.id);
  if (!Number.isInteger(editeurId)) {
    return res.status(400).json({ error: 'Identifiant éditeur invalide' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, editeur_id, nom, auteurs, age_min, age_max, type_jeu
         FROM jeu
        WHERE editeur_id = $1
        ORDER BY nom`,
      [editeurId]
    );

    const mapped = rows.map(row => ({
      id: row.id,
      editeurId: row.editeur_id,
      name: row.nom,
      authors: row.auteurs,
      ageMin: row.age_min,
      ageMax: row.age_max,
      type: row.type_jeu,
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des jeux' });
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
        RETURNING id, nom, login, description
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
        login: editeur.login,
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
