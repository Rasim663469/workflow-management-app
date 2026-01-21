import { Router } from 'express';
import pool from '../db/database.js';
import bcrypt from 'bcryptjs';
import { requireRoles } from '../middleware/auth-admin.js';

const router = Router();


router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await pool.query(
    'SELECT id, login, role FROM users WHERE id = $1',
    [id]
  );
  res.json(rows[0] || null);
});

// Création d'un utilisateur
router.post('/', requireRoles(['super_admin']), async (req, res) => {
  const { login, password, role } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login et mot de passe requis' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const normalizedRole =
      typeof role === 'string'
        ? role.trim()
        : 'benevole';
    const allowedRoles = new Set([
      'super_admin',
      'super_organisateur',
      'organisateur',
      'benevole',
    ]);
    const finalRole = allowedRoles.has(normalizedRole) ? normalizedRole : 'benevole';

    await pool.query(
      'INSERT INTO users (login, password_hash, role) VALUES ($1, $2, $3)',
      [login, hash, finalRole]
    );

    res.status(201).json({ message: 'Utilisateur créé' });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Login déjà existant' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
});

// Récupération du profil utilisateur (authentifié)
router.get('/me', async (req, res) => {
  const user = req.user;

  const { rows } = await pool.query(
    'SELECT id, login, role FROM users WHERE id=$1',
    [user?.id]
  );

  res.json(rows[0]);
});

// Mise à jour du rôle (super admin)
router.patch('/:id/role', requireRoles(['super_admin']), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = new Set([
    'super_admin',
    'super_organisateur',
    'organisateur',
    'benevole',
  ]);
  const normalizedRole = typeof role === 'string' ? role.trim() : '';
  if (!allowedRoles.has(normalizedRole)) {
    return res.status(400).json({ error: 'Role invalide.' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, login, role',
      [normalizedRole, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    res.json({ message: 'Role mis à jour', user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suppression d'un utilisateur (super admin)
router.delete('/:id', requireRoles(['super_admin']), async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;

  if (currentUserId && Number(id) === Number(currentUserId)) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' });
  }

  try {
    const { rows } = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const userRole = rows[0].role;
    if (userRole === 'super_admin') {
      const countRes = await pool.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin'"
      );
      const count = countRes.rows[0]?.count ?? 0;
      if (count <= 1) {
        return res.status(400).json({ error: 'Le dernier super admin ne peut pas être supprimé.' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste de tous les utilisateurs (réservée aux admins)
router.get('/', requireRoles(['super_admin']), async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id, login, role FROM users ORDER BY id'
  );

  res.json(rows);
});


export default router;
