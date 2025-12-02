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
  // Table editeur simple (nom unique)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS editeur (
      id SERIAL PRIMARY KEY,
      nom TEXT UNIQUE NOT NULL,
      description TEXT
    )
  `);

  for (const editeur of seedEditeurs) {
    const hash = await bcrypt.hash(editeur.password, 10);

    await pool.query(
      `INSERT INTO editeur (login, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (login) DO NOTHING`,
      [editeur.login, hash]
    );
  }

  console.log('👍 Comptes éditeur vérifiés ou créés');
}
