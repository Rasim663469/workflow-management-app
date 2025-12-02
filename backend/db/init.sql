CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);

-- ===========================
-- TABLE : FESTIVAL
-- ===========================

CREATE TABLE festival (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(255) UNIQUE NOT NULL,
    nombre_total_tables INT NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL
);

-- ===========================
-- TABLE : ZONE_TARIFAIRE
-- ===========================
CREATE TABLE zone_tarifaire (
    id INT PRIMARY KEY AUTO_INCREMENT,
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
CREATE TABLE zone_plan (
    id INT PRIMARY KEY AUTO_INCREMENT,
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
-- TABLE : EDITEUR
-- ===========================
CREATE TABLE editeur (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(255) NOT NULL,
    description TEXT
);

-- ===========================
-- TABLE : CONTACT
-- ===========================
CREATE TABLE contact (
    id INT PRIMARY KEY AUTO_INCREMENT,
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
CREATE TABLE jeu (
    id INT PRIMARY KEY AUTO_INCREMENT,
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
CREATE TABLE reservation (
    id INT PRIMARY KEY AUTO_INCREMENT,
    editeur_id INT NOT NULL,
    festival_id INT NOT NULL,
    remise_tables_offertes INT,
    remise_argent DECIMAL(10,2),
    prix_total DECIMAL(10,2),
    prix_final DECIMAL(10,2),
    editeur_presente_jeux BOOLEAN DEFAULT FALSE,
    statut_workflow ENUM('brouillon','envoyée','validée','annulée') NOT NULL DEFAULT 'brouillon',

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
CREATE TABLE contact_editeur (
    id INT PRIMARY KEY AUTO_INCREMENT,
    editeur_id INT NOT NULL,
    festival_id INT NOT NULL,
    date_contact DATETIME NOT NULL,
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
CREATE TABLE reservation_detail (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reservation_id INT NOT NULL,
    zone_tarifaire_id INT NOT NULL,
    nombre_tables INT NOT NULL,
    prix_zone DECIMAL(10,2),

    CONSTRAINT fk_res_detail_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservation(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_res_detail_zone_tarifaire
        FOREIGN KEY (zone_tarifaire_id) REFERENCES zone_tarifaire(id)
        ON DELETE CASCADE
);

-- ===========================
-- TABLE : JEU_FESTIVAL
-- ===========================
CREATE TABLE jeu_festival (
    id INT PRIMARY KEY AUTO_INCREMENT,
    jeu_id INT NOT NULL,
    reservation_id INT NOT NULL,
    zone_plan_id INT NOT NULL,
    quantite INT NOT NULL,
    nombre_tables_allouees DECIMAL(4,2),
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


INSERT INTO festival (nom, nombre_total_tables, date_debut, date_fin) 
VALUES ('Festival du Jeu 2025', 150, '2025-06-15', '2025-06-18');
 