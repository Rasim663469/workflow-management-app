import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db/database.js';
import { verifyToken, createAccessToken, createRefreshToken } from '../middleware/token-management.js';
import { JWT_SECRET } from '../config/env.js';
import type { TokenPayload } from '../types/token-payload.js';

const router = Router();

// --- LOGIN ---
router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) return res.status(400).json({ error: 'Missing credentials' });

  const { rows } = await pool.query('SELECT * FROM users WHERE login=$1', [login]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Unknown user' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password' });

  const accessToken = createAccessToken({ id: user.id, role: user.role });
  const refreshToken = createRefreshToken({ id: user.id, role: user.role });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ message: 'Authentication successful', user: { login: user.login, role: user.role } });
});

// --- LOGOUT ---
router.post('/logout', (_req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ message: 'Logged out successfully' });
});

// --- WHOAMI ---
router.get('/whoami', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

router.post('/register', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (login, password_hash, role)
       VALUES ($1, $2, 'user')
       RETURNING id, login, role`,
      [login, hashed]
    );

    res.status(201).json({
      message: 'Utilisateur créé',
      user: rows[0],
    });
  } catch (err: any) {
    if (err.code === '23505') {
      // doublon PostgreSQL
      return res.status(409).json({ error: 'Login déjà utilisé' });
    }

    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


router.post('/refresh', (req, res) => {
  const refresh = req.cookies?.refresh_token;

  if (!refresh) {
    return res.status(401).json({ error: 'Refresh token manquant' });
  }

  try {
    const decoded = jwt.verify(refresh, JWT_SECRET) as TokenPayload;
    const newAccess = createAccessToken({ id: decoded.id, role: decoded.role });

    res.cookie('access_token', newAccess, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ message: 'Token renouvelé' });
  } catch {
    res.status(403).json({ error: 'Refresh token invalide ou expiré' });
  }
});



export default router;
