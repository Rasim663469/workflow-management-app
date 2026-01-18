-- Phase 1 migration: reservants, stock, prises, CRM, placement

ALTER TABLE editeur
  ADD COLUMN IF NOT EXISTS type_reservant VARCHAR(20) NOT NULL DEFAULT 'editeur',
  ADD COLUMN IF NOT EXISTS est_reservant BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_type_reservant'
  ) THEN
    ALTER TABLE editeur
      ADD CONSTRAINT chk_type_reservant CHECK (type_reservant IN (
        'editeur',
        'prestataire',
        'boutique',
        'animation',
        'association'
      ));
  END IF;
END $$;

ALTER TABLE festival
  ADD COLUMN IF NOT EXISTS stock_tables_standard INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_tables_grandes INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_tables_mairie INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_chaises INT NOT NULL DEFAULT 0;

ALTER TABLE reservation
  ADD COLUMN IF NOT EXISTS besoin_animateur BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prises_electriques INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_facturation TIMESTAMP,
  ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMP,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS souhait_grandes_tables INT NOT NULL DEFAULT 0;

ALTER TABLE reservation_detail
  ADD COLUMN IF NOT EXISTS surface_m2 DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prix_table_snapshot DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS prix_m2_snapshot DECIMAL(10,2);

ALTER TABLE jeu_festival
  ALTER COLUMN zone_plan_id DROP NOT NULL;

ALTER TABLE jeu_festival
  ADD COLUMN IF NOT EXISTS type_table VARCHAR(20) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS tables_utilisees DECIMAL(4,2) NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_crm_statut'
  ) THEN
    CREATE TABLE IF NOT EXISTS crm_suivi (
      id SERIAL PRIMARY KEY,
      editeur_id INT NOT NULL,
      festival_id INT NOT NULL,
      statut VARCHAR(30) NOT NULL DEFAULT 'pas_de_contact',
      derniere_relance TIMESTAMP,
      notes TEXT,
      CONSTRAINT uq_crm_suivi UNIQUE (editeur_id, festival_id),
      CONSTRAINT fk_crm_suivi_editeur
          FOREIGN KEY (editeur_id) REFERENCES editeur(id)
          ON DELETE CASCADE,
      CONSTRAINT fk_crm_suivi_festival
          FOREIGN KEY (festival_id) REFERENCES festival(id)
          ON DELETE CASCADE,
      CONSTRAINT chk_crm_statut CHECK (statut IN (
        'pas_de_contact',
        'contact_pris',
        'discussion_en_cours',
        'sera_absent',
        'considere_absent',
        'present'
      ))
    );
  END IF;
END $$;
