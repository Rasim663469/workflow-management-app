ALTER TABLE reservation
  ADD COLUMN IF NOT EXISTS souhait_tables_standard INT NOT NULL DEFAULT 0;

ALTER TABLE reservation
  ADD COLUMN IF NOT EXISTS souhait_tables_mairie INT NOT NULL DEFAULT 0;
