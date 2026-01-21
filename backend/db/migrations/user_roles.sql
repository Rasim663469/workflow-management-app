ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_user_role;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'benevole';

UPDATE users SET role = 'super_admin' WHERE role = 'admin';
UPDATE users SET role = 'benevole' WHERE role IN ('user', 'editeur') OR role IS NULL;

ALTER TABLE users
  ADD CONSTRAINT chk_user_role CHECK (role IN (
    'super_admin',
    'super_organisateur',
    'organisateur',
    'benevole'
  ));
