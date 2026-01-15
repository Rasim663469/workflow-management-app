import bcrypt from 'bcryptjs';
import pool from './database.js';

type SeedEditeur = {
  login: string;
  name: string;
  password: string;
};

const seedEditeurs: SeedEditeur[] = [
  {
    login: 'editeur1',
    name: 'Editeur 1',
    password: 'editeur123',
  },
  {
    login: 'editeur2',
    name: 'Editeur 2',
    password: 'editeur123',
  },
];

export async function ensureEditeurs(): Promise<void> {
  // Table editeur simple (nom et login uniques)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS editeur (
      id SERIAL PRIMARY KEY,
      nom TEXT UNIQUE NOT NULL,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      description TEXT
    )
  `);

  // Si la colonne login n'existe pas (anciens schémas), on l'ajoute et on la peuple
  await pool.query(`ALTER TABLE editeur ADD COLUMN IF NOT EXISTS login TEXT`);
  await pool.query(`UPDATE editeur SET login = nom WHERE login IS NULL`);
  await pool.query(`ALTER TABLE editeur ALTER COLUMN login SET NOT NULL`);
  // Assurer la présence du hash (évite le NOT NULL si table existante)
  await pool.query(`ALTER TABLE editeur ADD COLUMN IF NOT EXISTS password_hash TEXT`);

  for (const editeur of seedEditeurs) {
    const hash = await bcrypt.hash(editeur.password, 10);

    // Crée le compte utilisateur "éditeur"
    const userInsert = await pool.query(
      `INSERT INTO users (login, password_hash, role)
       VALUES ($1, $2, 'editeur')
       ON CONFLICT (login) DO UPDATE SET login = EXCLUDED.login
       RETURNING id`,
      [editeur.login, hash]
    );

    const userId = userInsert.rows[0]?.id;

    if (userId) {
      // Associe une fiche éditeur avec le même id
      await pool.query(
        `INSERT INTO editeur (id, nom, login, password_hash, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [userId, editeur.name, editeur.login, hash, 'Compte éditeur initial']
      );
    }
  }

  console.log('👍 Comptes éditeur vérifiés ou créés');
}
