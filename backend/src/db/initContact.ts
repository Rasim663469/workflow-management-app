import pool from './database.js';

type SeedContact = {
  editeurNom: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role?: string;
};

const seedContacts: SeedContact[] = [
  {
    editeurNom: 'Editeur 1',
    nom: 'Martin',
    prenom: 'Alice',
    email: 'alice.martin@editeur1.test',
    telephone: '0600000001',
    role: 'Responsable salons',
  },
  {
    editeurNom: 'Editeur 1',
    nom: 'Bernard',
    prenom: 'Nicolas',
    email: 'nicolas.bernard@editeur1.test',
    telephone: '0600000002',
    role: 'Commercial',
  },
  {
    editeurNom: 'Editeur 2',
    nom: 'Morel',
    prenom: 'Clara',
    email: 'clara.morel@editeur2.test',
    telephone: '0600000003',
    role: 'Chargee de com',
  },
  {
    editeurNom: 'Editeur 2',
    nom: 'Rossi',
    prenom: 'Emma',
    email: 'emma.rossi@editeur2.test',
    telephone: '0600000004',
    role: 'Evenementiel',
  },
];

export async function ensureContacts(): Promise<void> {
  const { rows } = await pool.query('SELECT id, nom FROM editeur');
  const editeurIds = new Map(rows.map(row => [row.nom as string, Number(row.id)]));

  for (const contact of seedContacts) {
    const editeurId = editeurIds.get(contact.editeurNom);
    if (!editeurId) continue;

    await pool.query(
      `INSERT INTO contact (editeur_id, nom, prenom, email, telephone, role)
       SELECT $1::int, $2::text, $3::text, $4::varchar, $5::varchar, $6::varchar
       WHERE NOT EXISTS (
         SELECT 1 FROM contact WHERE email = $4::varchar
       )`,
      [
        editeurId,
        contact.nom,
        contact.prenom,
        contact.email,
        contact.telephone ?? null,
        contact.role ?? null,
      ]
    );
  }

  console.log('👍 Contacts éditeur vérifiés ou créés');
}
