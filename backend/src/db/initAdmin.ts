import pool from './database.js';
import bcrypt from 'bcryptjs';

type SeedUser = {
  login: string;
  password: string;
  role: 'super_admin' | 'super_organisateur' | 'organisateur' | 'benevole';
};

const seedUsers: SeedUser[] = [
  { login: 'superadmin', password: 'admin', role: 'super_admin' },
  { login: 'superorg', password: 'superorg', role: 'super_organisateur' },
  { login: 'organisateur', password: 'organisateur', role: 'organisateur' },
  { login: 'benevole', password: 'benevole', role: 'benevole' },
];

export async function ensureAdmin() {
  const { rows } = await pool.query('SELECT id, role FROM users');
  const hasSuperAdmin = rows.some(row => row.role === 'super_admin');
  const hasInvalidRole = rows.some(
    row =>
      !['super_admin', 'super_organisateur', 'organisateur', 'benevole'].includes(row.role)
  );

  if (rows.length > 0 && hasSuperAdmin && !hasInvalidRole) {
    console.log('👍 Comptes utilisateurs existants conservés');
    return;
  }

  await pool.query('TRUNCATE users RESTART IDENTITY');

  for (const user of seedUsers) {
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO users (login, password_hash, role)
       VALUES ($1, $2, $3)`,
      [user.login, hash, user.role]
    );
  }

  console.log('👍 Comptes utilisateurs réinitialisés');
}
