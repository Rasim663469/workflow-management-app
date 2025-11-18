import pool from './database.js';

const seedFestivals = [
  {
    nom: 'Festival du Jeu 2025',
    location: 'Paris',
    nombre_total_tables: 150,
    date_debut: '2025-06-15',
    date_fin: '2025-06-18',
  },
  {
    nom: 'Convention Manga 2025',
    location: 'Lyon',
    nombre_total_tables: 100,
    date_debut: '2025-09-10',
    date_fin: '2025-09-12',
  },
];



export async function ensureFestivals(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS festival (
      id SERIAL PRIMARY KEY,
      nom TEXT UNIQUE NOT NULL,
      location TEXT,
      nombre_total_tables INTEGER NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL
    )
  `);

  for (const festival of seedFestivals) {
    await pool.query(
      `INSERT INTO festival (nom,location, nombre_total_tables, date_debut, date_fin)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (nom) DO NOTHING`,
      [festival.nom,festival.location, festival.nombre_total_tables, festival.date_debut, festival.date_fin]
    );
  }

  console.log('👍 Festivals vérifiés ou créés');
}