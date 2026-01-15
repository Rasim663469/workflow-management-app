BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS staging_editeur;
DROP TABLE IF EXISTS staging_jeu;
DROP TABLE IF EXISTS staging_typejeu;
DROP TABLE IF EXISTS staging_mecanism;
DROP TABLE IF EXISTS staging_jeu_mecanism;

CREATE TEMP TABLE staging_editeur (
  idEditeur TEXT,
  libelleEditeur TEXT,
  exposant TEXT,
  distributeur TEXT,
  logoEditeur TEXT
);

CREATE TEMP TABLE staging_jeu (
  idJeu TEXT,
  libelleJeu TEXT,
  auteurJeu TEXT,
  nbMinJoueurJeu TEXT,
  nbMaxJoueurJeu TEXT,
  noticeJeu TEXT,
  idEditeur TEXT,
  idTypeJeu TEXT,
  agemini TEXT,
  prototype TEXT,
  duree TEXT,
  theme TEXT,
  description TEXT,
  imageJeu TEXT,
  videoRegle TEXT
);

CREATE TEMP TABLE staging_typejeu (
  idTypeJeu TEXT,
  libelleTypeJeu TEXT,
  idZone TEXT
);

CREATE TEMP TABLE staging_mecanism (
  idMecanism TEXT,
  mecaName TEXT,
  mecaDesc TEXT
);

CREATE TEMP TABLE staging_jeu_mecanism (
  id TEXT,
  idJeu TEXT,
  idMecanism TEXT
);

\copy staging_editeur FROM '/tmp/editeur.csv' WITH (FORMAT csv, HEADER true, QUOTE '"')
\copy staging_jeu FROM '/tmp/jeu.csv' WITH (FORMAT csv, HEADER true, QUOTE '"')
\copy staging_typejeu FROM '/tmp/typeJeu.csv' WITH (FORMAT csv, HEADER true, QUOTE '"')
\copy staging_mecanism FROM '/tmp/mecanism.csv' WITH (FORMAT csv, HEADER true, QUOTE '"')
\copy staging_jeu_mecanism FROM '/tmp/jeu_mecanism.csv' WITH (FORMAT csv, HEADER true, QUOTE '"')

-- Some games reference editors missing from editeur.csv, so add placeholders
WITH missing_editeurs AS (
  SELECT DISTINCT sj.idEditeur
  FROM staging_jeu sj
  WHERE NULLIF(sj.idEditeur, '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM staging_editeur se WHERE se.idEditeur = sj.idEditeur
    )
)
INSERT INTO users (id, login, password_hash, role)
SELECT
  me.idEditeur::int,
  'editeur' || me.idEditeur,
  crypt('editeur123', gen_salt('bf')),
  'editeur'
FROM missing_editeurs me
ON CONFLICT (id) DO NOTHING;

-- Users + editeurs (login different from nom)
INSERT INTO users (id, login, password_hash, role)
SELECT
  se.idEditeur::int,
  'editeur' || se.idEditeur,
  crypt('editeur123', gen_salt('bf')),
  'editeur'
FROM staging_editeur se
ON CONFLICT (id) DO NOTHING;

INSERT INTO editeur (id, nom, login, password_hash, description)
SELECT
  u.id,
  se.libelleEditeur,
  u.login,
  u.password_hash,
  NULL
FROM staging_editeur se
JOIN users u ON u.id = se.idEditeur::int
ON CONFLICT (id) DO NOTHING;

INSERT INTO editeur (id, nom, login, password_hash, description)
SELECT
  u.id,
  'Editeur inconnu ' || u.id,
  u.login,
  u.password_hash,
  NULL
FROM users u
JOIN (
  SELECT DISTINCT sj.idEditeur::int AS id
  FROM staging_jeu sj
  WHERE NULLIF(sj.idEditeur, '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM staging_editeur se WHERE se.idEditeur::int = sj.idEditeur::int
    )
) missing ON missing.id = u.id
ON CONFLICT (id) DO NOTHING;

-- Reference tables for types and mecanisms
CREATE TABLE IF NOT EXISTS type_jeu_ref (
  id INTEGER PRIMARY KEY,
  libelle TEXT NOT NULL,
  zone_id INTEGER
);

CREATE TABLE IF NOT EXISTS mecanisme (
  id INTEGER PRIMARY KEY,
  nom TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS jeu_mecanisme (
  id SERIAL PRIMARY KEY,
  jeu_id INTEGER NOT NULL REFERENCES jeu(id) ON DELETE CASCADE,
  mecanisme_id INTEGER NOT NULL REFERENCES mecanisme(id) ON DELETE CASCADE,
  UNIQUE (jeu_id, mecanisme_id)
);

INSERT INTO type_jeu_ref (id, libelle, zone_id)
SELECT
  st.idTypeJeu::int,
  st.libelleTypeJeu,
  NULLIF(st.idZone, '')::int
FROM staging_typejeu st
ON CONFLICT (id) DO NOTHING;

INSERT INTO mecanisme (id, nom, description)
SELECT
  sm.idMecanism::int,
  sm.mecaName,
  NULLIF(sm.mecaDesc, '')
FROM staging_mecanism sm
ON CONFLICT (id) DO NOTHING;

-- Jeux (id from CSV)
INSERT INTO jeu (id, editeur_id, nom, auteurs, age_min, age_max, type_jeu)
SELECT
  sj.idJeu::int,
  sj.idEditeur::int,
  sj.libelleJeu,
  NULLIF(sj.auteurJeu, ''),
  NULLIF(sj.agemini, '')::int,
  NULLIF(sj.agemini, '')::int,
  tr.libelle
FROM staging_jeu sj
LEFT JOIN type_jeu_ref tr ON tr.id = sj.idTypeJeu::int
ON CONFLICT (id) DO NOTHING;

INSERT INTO jeu_mecanisme (jeu_id, mecanisme_id)
SELECT
  jm.idJeu::int,
  jm.idMecanism::int
FROM staging_jeu_mecanism jm
ON CONFLICT DO NOTHING;

-- Fix sequences
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('editeur', 'id'), COALESCE((SELECT MAX(id) FROM editeur), 1), true);
SELECT setval(pg_get_serial_sequence('jeu', 'id'), COALESCE((SELECT MAX(id) FROM jeu), 1), true);
SELECT setval(pg_get_serial_sequence('jeu_mecanisme', 'id'), COALESCE((SELECT MAX(id) FROM jeu_mecanisme), 1), true);

COMMIT;
