import pool from './database.js';

type SeedEditeur = {
  name: string;
};

const seedEditeurs: SeedEditeur[] = [
  {
    name: 'Editeur 1',
  },
  {
    name: 'Editeur 2',
  },
];

export async function ensureEditeurs(): Promise<void> {
  // Table editeur (nom unique)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS editeur (
      id SERIAL PRIMARY KEY,
      nom TEXT UNIQUE NOT NULL,
      description TEXT
    )
  `);

  for (const editeur of seedEditeurs) {
    await pool.query(
      `INSERT INTO editeur (nom, description)
       VALUES ($1, $2)
       ON CONFLICT (nom) DO NOTHING`,
      [editeur.name, 'Compte éditeur initial']
    );
  }

  console.log(' Comptes éditeur vérifiés ou créés');
}
