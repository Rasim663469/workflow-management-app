import pool from './database.js';

const WORKFLOW_STATUSES = ['present', 'facture', 'facture_payee', 'annulée'];

export async function ensureReservationWorkflow(): Promise<void> {
  const allowed = WORKFLOW_STATUSES.map(status => `'${status}'`).join(',');
  await pool.query(
    `
    UPDATE reservation
    SET statut_workflow = CASE
      WHEN statut_workflow IN ('facture', 'facture_payee', 'annulée') THEN statut_workflow
      ELSE 'present'
    END
    WHERE statut_workflow IS NULL
       OR statut_workflow NOT IN (${allowed})
    `
  );
  await pool.query('ALTER TABLE reservation DROP CONSTRAINT IF EXISTS chk_statut_workflow');
  await pool.query(
    `ALTER TABLE reservation
     ALTER COLUMN statut_workflow SET DEFAULT 'present'`
  );
  await pool.query(
    `ALTER TABLE reservation
     ADD CONSTRAINT chk_statut_workflow CHECK (statut_workflow IN (${allowed}))`
  );
  console.log('Workflow réservation vérifié');
}
