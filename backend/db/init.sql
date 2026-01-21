-- ===========================
-- TABLE : USERS
-- ===========================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'benevole',
  CONSTRAINT chk_user_role CHECK (role IN (
    'super_admin',
    'super_organisateur',
    'organisateur',
    'benevole'
  ))
);

-- ===========================
-- TABLE : EDITEUR
-- ===========================
CREATE TABLE IF NOT EXISTS editeur (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(255),
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  description TEXT,
  type_reservant VARCHAR(20) NOT NULL DEFAULT 'editeur',
  est_reservant BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_type_reservant CHECK (type_reservant IN (
    'editeur',
    'prestataire',
    'boutique',
    'animation',
    'association'
  ))
);

-- ===========================
-- TABLE : FESTIVAL
-- ===========================
CREATE TABLE IF NOT EXISTS festival (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) UNIQUE NOT NULL,
    location VARCHAR(255),
    nombre_total_tables INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    description TEXT,
    stock_tables_standard INT NOT NULL DEFAULT 0,
    stock_tables_grandes INT NOT NULL DEFAULT 0,
    stock_tables_mairie INT NOT NULL DEFAULT 0,
    stock_chaises INT NOT NULL DEFAULT 0
);

-- ===========================
-- TABLE : ZONE_TARIFAIRE
-- ===========================
CREATE TABLE IF NOT EXISTS zone_tarifaire (
    id SERIAL PRIMARY KEY,
    festival_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    nombre_tables_total INT NOT NULL,
    nombre_tables_disponibles INT NOT NULL,
    prix_table DECIMAL(10,2) NOT NULL,
    prix_m2 DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_zone_tarifaire_festival
        FOREIGN KEY (festival_id) REFERENCES festival(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : ZONE_PLAN
-- ===========================
CREATE TABLE IF NOT EXISTS zone_plan (
    id SERIAL PRIMARY KEY,
    festival_id INT NOT NULL,
    zone_tarifaire_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    nombre_tables INT NOT NULL,
    CONSTRAINT fk_zone_plan_festival
        FOREIGN KEY (festival_id) REFERENCES festival(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_zone_plan_zone_tarifaire
        FOREIGN KEY (zone_tarifaire_id) REFERENCES zone_tarifaire(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : CONTACT
-- ===========================
CREATE TABLE IF NOT EXISTS contact (
    id SERIAL PRIMARY KEY,
    editeur_id INT NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    role VARCHAR(100),
    CONSTRAINT fk_contact_editeur
        FOREIGN KEY (editeur_id) REFERENCES editeur(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : JEU
-- ===========================
CREATE TABLE IF NOT EXISTS jeu (
    id SERIAL PRIMARY KEY,
    editeur_id INT NOT NULL,
    nom VARCHAR(255) NOT NULL,
    auteurs VARCHAR(255),
    age_min INT,
    age_max INT,
    type_jeu VARCHAR(100),
    CONSTRAINT fk_jeu_editeur
        FOREIGN KEY (editeur_id) REFERENCES editeur(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : RESERVATION
-- ===========================
CREATE TABLE IF NOT EXISTS reservation (
    id SERIAL PRIMARY KEY,
    editeur_id INT NOT NULL,
    festival_id INT NOT NULL,
    remise_tables_offertes INT,
    remise_argent DECIMAL(10,2),
    prix_total DECIMAL(10,2),
    prix_final DECIMAL(10,2),
    editeur_presente_jeux BOOLEAN DEFAULT FALSE,
    besoin_animateur BOOLEAN DEFAULT FALSE,
    prises_electriques INT NOT NULL DEFAULT 0,
    date_facturation TIMESTAMP,
    date_paiement TIMESTAMP,
    notes TEXT,
    souhait_grandes_tables INT NOT NULL DEFAULT 0,
    souhait_tables_standard INT NOT NULL DEFAULT 0,
    souhait_tables_mairie INT NOT NULL DEFAULT 0,
    statut_workflow VARCHAR(30) NOT NULL DEFAULT 'pas_de_contact',
    CONSTRAINT chk_statut_workflow CHECK (statut_workflow IN (
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
      'annulée'
    )),
    CONSTRAINT fk_reservation_editeur
        FOREIGN KEY (editeur_id) REFERENCES editeur(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reservation_festival
        FOREIGN KEY (festival_id) REFERENCES festival(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : CONTACT_EDITEUR
-- ===========================
CREATE TABLE IF NOT EXISTS contact_editeur (
    id SERIAL PRIMARY KEY,
    editeur_id INT NOT NULL,
    festival_id INT NOT NULL,
    date_contact TIMESTAMP NOT NULL,
    type_contact VARCHAR(20),
    notes TEXT,
    CONSTRAINT fk_contact_editeur_editeur
        FOREIGN KEY (editeur_id) REFERENCES editeur(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_contact_editeur_festival
        FOREIGN KEY (festival_id) REFERENCES festival(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : RESERVATION_DETAIL
-- ===========================
CREATE TABLE IF NOT EXISTS reservation_detail (
    id SERIAL PRIMARY KEY,
    reservation_id INT NOT NULL,
    zone_tarifaire_id INT NOT NULL,
    nombre_tables INT NOT NULL,
    surface_m2 DECIMAL(10,2) NOT NULL DEFAULT 0,
    prix_zone DECIMAL(10,2),
    prix_table_snapshot DECIMAL(10,2),
    prix_m2_snapshot DECIMAL(10,2),
    CONSTRAINT fk_res_detail_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservation(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_res_detail_zone_tarifaire
        FOREIGN KEY (zone_tarifaire_id) REFERENCES zone_tarifaire(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : FACTURE
-- ===========================
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

-- ===========================
-- TABLE : JEU_FESTIVAL
-- ===========================
CREATE TABLE IF NOT EXISTS jeu_festival (
    id SERIAL PRIMARY KEY,
    jeu_id INT NOT NULL,
    reservation_id INT NOT NULL,
    zone_plan_id INT,
    quantite INT NOT NULL,
    nombre_tables_allouees DECIMAL(4,2),
    type_table VARCHAR(20) NOT NULL DEFAULT 'standard',
    tables_utilisees DECIMAL(4,2) NOT NULL DEFAULT 1,
    liste_demandee BOOLEAN DEFAULT FALSE,
    liste_obtenue BOOLEAN DEFAULT FALSE,
    jeux_recus BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_jf_jeu
        FOREIGN KEY (jeu_id) REFERENCES jeu(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_jf_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservation(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_jf_zone_plan
        FOREIGN KEY (zone_plan_id) REFERENCES zone_plan(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : CRM_SUIVI (suivi avant réservation)
-- ===========================
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
