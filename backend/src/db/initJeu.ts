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
    nom: 'Chroniques du Royaume',
    auteurs: 'A. Martin',
    ageMin: 10,
    ageMax: 99,
    typeJeu: 'Strategie',
  },
  {
    editeurLogin: 'editeur1',
    nom: 'Voyage Arctique',
    auteurs: 'S. Legrand',
    ageMin: 8,
    ageMax: 99,
    typeJeu: 'Familial',
  },
  {
    editeurLogin: 'editeur2',
    nom: 'Cites Perdues',
    auteurs: 'N. Bernard',
    ageMin: 12,
    ageMax: 99,
    typeJeu: 'Aventure',
  },
  {
    editeurLogin: 'editeur2',
    nom: 'Mecanismes',
    auteurs: 'T. Dupont',
    ageMin: 14,
    ageMax: 99,
    typeJeu: 'Expert',
  },
];

async function getEditeurIdsByLogin(): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    'SELECT id, login FROM editeur'
  );
  return new Map(rows.map(row => [row.login as string, Number(row.id)]));
}

export async function ensureJeux(): Promise<void> {
  // Vérifier si la table jeu existe et la supprimer si elle référence encore users
  await pool.query(`
    DROP TABLE IF EXISTS jeu CASCADE
  `);

  // Créer la table jeu avec référence à editeur (pas users)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS jeu (
      id SERIAL PRIMARY KEY,
      editeur_id INTEGER NOT NULL REFERENCES editeur(id) ON DELETE CASCADE,
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
        `  Aucun éditeur trouvé pour le login "${jeu.editeurLogin}", jeu "${jeu.nom}" ignoré.`
      );
      continue;
    }

    await pool.query(
      `INSERT INTO jeu (editeur_id, nom, auteurs, age_min, age_max, type_jeu)
       VALUES ($1, $2, $3, $4, $5, $6)`,
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

  console.log(' Jeux vérifiés ou créés');
}
