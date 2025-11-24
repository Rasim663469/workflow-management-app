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

export default router;
