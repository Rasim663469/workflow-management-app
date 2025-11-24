import bcrypt from 'bcryptjs';
import pool from './database.js';

type SeedEditeur = {
  login: string;
  password: string;
};

const seedEditeurs: SeedEditeur[] = [
  {
    login: 'editeur1',
    password: 'editeur123',
  },
  {
    login: 'editeur2',
    password: 'editeur123',
  },
];

export async function ensureEditeurs(): Promise<void> {
  for (const editeur of seedEditeurs) {
    const hash = await bcrypt.hash(editeur.password, 10);

    await pool.query(
      `INSERT INTO users (login, password_hash, role)
       VALUES ($1, $2, 'editeur')
       ON CONFLICT (login) DO NOTHING`,
      [editeur.login, hash]
    );
  }

  console.log('👍 Comptes éditeur vérifiés ou créés');
}
