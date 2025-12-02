import pool from './database.js';

type SeedJeu = {
  editeurLogin: string;
  nom: string;
  auteurs?: string;
  ageMin?: number;
  ageMax?: number;
  typeJeu?: string;
};

const seedJeux: SeedJeu[] = [
  {
    editeurLogin: 'editeur1',
    nom: 'Rasim',
    auteurs: 'rasim',
    ageMin: 12,
    ageMax: 99,
    typeJeu: 'Stratégie SF',
  },
  {
    editeurLogin: 'editeur2',
    nom: 'ayoub',
    auteurs: 'ayoub',
    ageMin: 6,
    ageMax: 14,
    typeJeu: 'Familial',
  },
];

async function getEditeurIdsByLogin(): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    'SELECT id, login FROM users WHERE role = $1',
    ['editeur']
  );

  return new Map(rows.map(row => [row.login as string, Number(row.id)]));
}

export async function ensureJeux(): Promise<void> {


  await pool.query(`
    CREATE TABLE IF NOT EXISTS jeu (
      id SERIAL PRIMARY KEY,
      editeur_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nom TEXT NOT NULL,
      auteurs TEXT,
      age_min INTEGER,
      age_max INTEGER,
      type_jeu TEXT,
      CONSTRAINT uq_jeu_editeur_nom UNIQUE (editeur_id, nom)
    )
  `);

  const editeurIds = await getEditeurIdsByLogin();

  for (const jeu of seedJeux) {
    const editeurId = editeurIds.get(jeu.editeurLogin);

    if (!editeurId) {
      console.warn(
        `Warning: aucun éditeur trouvé pour le login ${jeu.editeurLogin}, jeu "${jeu.nom}" ignoré.`
      );
      continue;
    }

    await pool.query(
      `INSERT INTO jeu (editeur_id, nom, auteurs, age_min, age_max, type_jeu)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (editeur_id, nom) DO NOTHING`,
      [
        editeurId,
        jeu.nom,
        jeu.auteurs ?? null,
        jeu.ageMin ?? null,
        jeu.ageMax ?? null,
        jeu.typeJeu ?? null,
      ]
    );
  }

  console.log('👍 Jeux vérifiés ou créés');
}
