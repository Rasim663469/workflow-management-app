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

const seedZones = [
  { nom: 'Zone Premium', nombre_tables_total: 40, prix_table: 120 },
  { nom: 'Zone Standard', nombre_tables_total: 60, prix_table: 80 },
  { nom: 'Zone Découverte', nombre_tables_total: 50, prix_table: 60 },
];



export async function ensureFestivals(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS festival (
      id SERIAL PRIMARY KEY,
      nom TEXT UNIQUE NOT NULL,
      location TEXT,
      nombre_total_tables INTEGER NOT NULL,
      date_debut DATE NOT NULL,
      date_fin DATE NOT NULL,
      description TEXT,
      stock_tables_standard INTEGER NOT NULL DEFAULT 0,
      stock_tables_grandes INTEGER NOT NULL DEFAULT 0,
      stock_tables_mairie INTEGER NOT NULL DEFAULT 0,
      stock_chaises INTEGER NOT NULL DEFAULT 0
    )
  `);

  const seedEnabled = process.env.SEED_DATA === 'true';
  if (!seedEnabled) {
    console.log('ℹ️ Seed festivals/zones désactivé (SEED_DATA != true)');
    return;
  }

  for (const festival of seedFestivals) {
    await pool.query(
      `INSERT INTO festival (nom, location, nombre_total_tables, date_debut, date_fin,
        stock_tables_standard, stock_tables_grandes, stock_tables_mairie, stock_chaises)
       VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0)
       ON CONFLICT (nom) DO NOTHING`,
      [
        festival.nom,
        festival.location,
        festival.nombre_total_tables,
        festival.date_debut,
        festival.date_fin,
      ]
    );
  }

  const { rows } = await pool.query(
    'SELECT id, nom FROM festival WHERE nom = ANY($1::text[])',
    [seedFestivals.map(f => f.nom)]
  );
  for (const festival of rows) {
    for (const zone of seedZones) {
      const prixM2 = zone.prix_table / 4;
      await pool.query(
        `INSERT INTO zone_tarifaire (festival_id, nom, nombre_tables_total, nombre_tables_disponibles, prix_table, prix_m2)
         SELECT $1::int, $2::varchar, $3::int, $3::int, $4::numeric, $5::numeric
         WHERE NOT EXISTS (
           SELECT 1 FROM zone_tarifaire WHERE festival_id = $1 AND nom = $2::varchar
         )`,
        [festival.id, zone.nom, zone.nombre_tables_total, zone.prix_table, prixM2]
      );
    }
  }

  console.log(' Festivals vérifiés ou créés');
}
