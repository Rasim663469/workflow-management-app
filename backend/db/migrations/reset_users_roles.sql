BEGIN;

-- Supprimer les anciens users "editeur"
DELETE FROM users WHERE role = 'editeur';

-- Supprimer les anciens comptes editeur générés (login editeur*)
DELETE FROM users WHERE login ILIKE 'editeur%';

-- Forcer les rôles invalides en benevole
UPDATE users
SET role = 'benevole'
WHERE role IS NULL OR role NOT IN ('super_admin','super_organisateur','organisateur','benevole');

-- Créer les comptes par défaut si absents
INSERT INTO users (login, password_hash, role)
SELECT 'superadmin', crypt('admin', gen_salt('bf')), 'super_admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'superadmin');

INSERT INTO users (login, password_hash, role)
SELECT 'superorg', crypt('superorg', gen_salt('bf')), 'super_organisateur'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'superorg');

INSERT INTO users (login, password_hash, role)
SELECT 'organisateur', crypt('organisateur', gen_salt('bf')), 'organisateur'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'organisateur');

INSERT INTO users (login, password_hash, role)
SELECT 'benevole', crypt('benevole', gen_salt('bf')), 'benevole'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE login = 'benevole');

COMMIT;
