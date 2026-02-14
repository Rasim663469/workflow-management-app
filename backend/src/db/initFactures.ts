import pool from './database.js';

export async function ensureFactures(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS facture (
      id SERIAL PRIMARY KEY,
      reservation_id INT NOT NULL UNIQUE,
      numero TEXT UNIQUE NOT NULL,
      montant_ttc DECIMAL(10,2) NOT NULL,
      statut VARCHAR(20) NOT NULL DEFAULT 'facture',
      emise_le TIMESTAMP NOT NULL DEFAULT NOW(),
      payee_le TIMESTAMP,
      CONSTRAINT fk_facture_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservation(id)
        ON DELETE CASCADE,
      CONSTRAINT chk_facture_statut CHECK (statut IN ('facture', 'payee'))
    );
  `);
  console.log(' Factures verifiees');
}
