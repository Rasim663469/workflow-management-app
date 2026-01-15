import pool from './database.js';

const WORKFLOW_STATUSES = [
  'brouillon',
  'pas_de_contact',
  'contact_pris',
  'discussion_en_cours',
  'sera_absent',
  'considere_absent',
  'present',
  'facture',
  'facture_payee',
  'envoyée',
  'validée',
  'annulée',
];

export async function ensureReservationWorkflow(): Promise<void> {
  const allowed = WORKFLOW_STATUSES.map(status => `'${status}'`).join(',');
  await pool.query('ALTER TABLE reservation DROP CONSTRAINT IF EXISTS chk_statut_workflow');
  await pool.query(
    `ALTER TABLE reservation
     ALTER COLUMN statut_workflow SET DEFAULT 'pas_de_contact'`
  );
  await pool.query(
    `ALTER TABLE reservation
     ADD CONSTRAINT chk_statut_workflow CHECK (statut_workflow IN (${allowed}))`
  );
  console.log('👍 Workflow réservation vérifié');
}
