import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

// Liste des éditeurs (visibles par tout utilisateur authentifié)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, login, role FROM users WHERE role = $1 ORDER BY login',
      ['editeur']
    );

    const mapped = rows.map(row => ({
      id: String(row.id ?? row.login),
      login: row.login,
      name: row.login,
      description: 'Compte éditeur',
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des éditeurs' });
  }
});

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
      id: String(row.id ?? `${row.nom}-${row.editeur_id}`),
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

export default router;
