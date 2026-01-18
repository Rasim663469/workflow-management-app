import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

const ALLOWED_STATUSES = [
  'pas_de_contact',
  'contact_pris',
  'discussion_en_cours',
  'sera_absent',
  'considere_absent',
  'present',
] as const;

function isValidStatus(value: unknown): value is (typeof ALLOWED_STATUSES)[number] {
  return typeof value === 'string' && ALLOWED_STATUSES.includes(value as any);
}

// Liste CRM par festival
router.get('/', async (req, res) => {
  const { festival_id } = req.query;
  if (!festival_id) {
    return res.status(400).json({ error: 'festival_id est requis' });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT
        e.id AS editeur_id,
        e.nom AS editeur_nom,
        e.type_reservant,
        e.est_reservant,
        cs.statut,
        cs.derniere_relance,
        COALESCE(cnt.total_contacts, 0) AS total_contacts,
        cnt.last_contact
      FROM editeur e
      LEFT JOIN crm_suivi cs
        ON cs.editeur_id = e.id AND cs.festival_id = $1
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS total_contacts, MAX(date_contact) AS last_contact
        FROM contact_editeur c
        WHERE c.editeur_id = e.id AND c.festival_id = $1
      ) cnt ON true
      ORDER BY e.nom ASC
      `,
      [festival_id]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Upsert CRM status (festival + editeur)
router.post('/', async (req, res) => {
  const { editeur_id, festival_id, statut, notes } = req.body;

  if (!editeur_id || !festival_id) {
    return res.status(400).json({ error: 'editeur_id et festival_id sont requis' });
  }

  if (statut !== undefined && !isValidStatus(statut)) {
    return res.status(400).json({ error: 'Statut CRM invalide' });
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO crm_suivi (editeur_id, festival_id, statut, derniere_relance, notes)
      VALUES ($1, $2, COALESCE($3, 'pas_de_contact'), CASE WHEN $3 = 'contact_pris' THEN NOW() ELSE NULL END, $4)
      ON CONFLICT (editeur_id, festival_id)
      DO UPDATE SET
        statut = COALESCE(EXCLUDED.statut, crm_suivi.statut),
        notes = COALESCE(EXCLUDED.notes, crm_suivi.notes),
        derniere_relance = CASE
          WHEN EXCLUDED.statut = 'contact_pris' THEN NOW()
          ELSE crm_suivi.derniere_relance
        END
      RETURNING *;
      `,
      [editeur_id, festival_id, statut ?? null, notes ?? null]
    );

    res.status(201).json({ message: 'Statut CRM enregistré', suivi: rows[0] });
  } catch (err: any) {
    console.error(err);
    if (err.code === '23503') {
      res.status(400).json({ error: "L'éditeur ou le festival n'existe pas." });
    } else {
      res.status(500).json({ error: 'Erreur serveur.' });
    }
  }
});

export default router;
