import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/database.js';

const router = Router();

const isAdmin = (req: Express.Request) => req.user?.role === 'admin';
const ALLOWED_TYPES = ['editeur', 'prestataire', 'boutique', 'animation', 'association'] as const;

function normalizeType(value: unknown): string {
  if (typeof value !== 'string') return 'editeur';
  const normalized = value.trim().toLowerCase();
  return ALLOWED_TYPES.includes(normalized as any) ? normalized : 'editeur';
}

// CRÉER un éditeur (admin uniquement) : crée aussi le compte user associé
router.post('/', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { nom, login, description, type_reservant, est_reservant } = req.body;
  const normalizedName = typeof nom === 'string' ? nom.trim() : '';
  const normalizedLogin = typeof login === 'string' ? login.trim() : '';

  if (!normalizedName || !normalizedLogin) {
    return res.status(400).json({ error: 'Le nom et le login sont requis.' });
  }

  if (normalizedName === normalizedLogin) {
    return res.status(400).json({ error: 'Le login doit être différent du nom.' });
  }

  try {
    const passwordHash = await bcrypt.hash('editeur123', 10);

    // Crée le compte user
    const userInsert = await pool.query(
      `INSERT INTO users (login, password_hash, role)
       VALUES ($1, $2, 'editeur')
       ON CONFLICT (login) DO NOTHING
       RETURNING id, login`,
      [normalizedLogin, passwordHash]
    );

    const user = userInsert.rows[0];
    if (!user) {
      return res.status(409).json({ error: 'Un éditeur avec ce login existe déjà.' });
    }

    // Crée/associe la fiche éditeur avec le même id
    await pool.query(
      `INSERT INTO editeur (id, nom, login, password_hash, description, type_reservant, est_reservant)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        user.id,
        normalizedName,
        normalizedLogin,
        passwordHash,
        description?.trim() || null,
        normalizeType(type_reservant),
        est_reservant !== undefined ? Boolean(est_reservant) : true,
      ]
    );

    res.status(201).json({
      message: 'Éditeur créé avec succès',
      editeur: {
        id: user.id,
        name: normalizedName,
        login: user.login,
        description: description?.trim() || null,
        type_reservant: normalizeType(type_reservant),
        est_reservant: est_reservant !== undefined ? Boolean(est_reservant) : true,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la création.' });
  }
});

// LISTE des éditeurs (authentifiés)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.nom, e.login, e.description, e.type_reservant, e.est_reservant
         FROM editeur e
        ORDER BY e.nom`
    );

    const mapped = rows.map(row => ({
      id: row.id,
      name: row.nom,
      login: row.login,
      description: row.description,
      type_reservant: row.type_reservant,
      est_reservant: row.est_reservant,
    }));
    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération.' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT id, nom, login, description, type_reservant, est_reservant FROM editeur WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }

    const editeur = rows[0];
    res.json({
      id: editeur.id,
      name: editeur.nom,
      login: editeur.login,
      description: editeur.description,
      type_reservant: editeur.type_reservant,
      est_reservant: editeur.est_reservant,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Jeux d'un éditeur (authentifiés)
router.get('/:id/jeux', async (req, res) => {
  const editeurId = Number(req.params.id);
  if (!Number.isInteger(editeurId)) {
    return res.status(400).json({ error: 'Identifiant éditeur invalide' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT 
         j.id,
         j.editeur_id,
         j.nom,
         j.auteurs,
         j.age_min,
         j.age_max,
         j.type_jeu,
         COALESCE(
           json_agg(DISTINCT m.nom) FILTER (WHERE m.id IS NOT NULL),
           '[]'
         ) AS mecanismes
       FROM jeu j
       LEFT JOIN jeu_mecanisme jm ON jm.jeu_id = j.id
       LEFT JOIN mecanisme m ON m.id = jm.mecanisme_id
       WHERE j.editeur_id = $1
       GROUP BY j.id
       ORDER BY j.nom`,
      [editeurId]
    );

    const mapped = rows.map(row => ({
      id: row.id,
      editeurId: row.editeur_id,
      name: row.nom,
      authors: row.auteurs,
      ageMin: row.age_min,
      ageMax: row.age_max,
      type: row.type_jeu,
      mecanismes: row.mecanismes ?? [],
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors du chargement des jeux' });
  }
});

// MODIFIER un éditeur (admin)
router.put('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { id } = req.params;
  const { nom, login, description, type_reservant, est_reservant } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const normalizedName = typeof nom === 'string' ? nom.trim() : undefined;
  const normalizedLogin = typeof login === 'string' ? login.trim() : undefined;

  const current = await pool.query('SELECT nom, login FROM editeur WHERE id = $1', [id]);
  if (current.rows.length === 0) {
    return res.status(404).json({ error: 'Éditeur non trouvé.' });
  }
  const currentName = current.rows[0].nom as string;
  const currentLogin = current.rows[0].login as string;

  if (normalizedName !== undefined) {
    const candidateLogin = normalizedLogin ?? currentLogin;
    if (normalizedName === candidateLogin) {
      return res.status(400).json({ error: 'Le login doit être différent du nom.' });
    }
    updates.push(`nom = $${paramIndex}`);
    values.push(normalizedName);
    paramIndex++;
  }

  if (normalizedLogin !== undefined) {
    const candidateName = normalizedName ?? currentName;
    if (normalizedLogin === candidateName) {
      return res.status(400).json({ error: 'Le login doit être différent du nom.' });
    }
    updates.push(`login = $${paramIndex}`);
    values.push(normalizedLogin);
    paramIndex++;
  }

  if (description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    values.push(description);
    paramIndex++;
  }
  if (type_reservant !== undefined) {
    updates.push(`type_reservant = $${paramIndex}`);
    values.push(normalizeType(type_reservant));
    paramIndex++;
  }
  if (est_reservant !== undefined) {
    updates.push(`est_reservant = $${paramIndex}`);
    values.push(Boolean(est_reservant));
    paramIndex++;
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucune donnée à mettre à jour.' });
  }

  values.push(id);

  const query = `
        UPDATE editeur 
        SET ${updates.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING id, nom, login, description
    `;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(query, values);

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }

    const editeur = rows[0];
    if (normalizedLogin !== undefined) {
      await client.query('UPDATE users SET login = $1 WHERE id = $2', [normalizedLogin, id]);
    }
    await client.query('COMMIT');
    client.release();
    res.json({
      message: 'Éditeur mis à jour avec succès',
      editeur: {
        id: editeur.id,
        name: editeur.nom,
        login: editeur.login,
        description: editeur.description,
      },
    });
  } catch (err) {
    console.error(err);
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    } finally {
      client.release();
    }
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour.' });
  }
});

// SUPPRIMER un éditeur (admin)
router.delete('/:id', async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Accès réservé aux admins' });
  }

  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query('DELETE FROM editeur WHERE id = $1', [id]);

    if (rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Éditeur non trouvé.' });
    }

    await client.query('DELETE FROM users WHERE id = $1 AND role = $2', [id, 'editeur']);
    await client.query('COMMIT');
    client.release();
    res.json({ message: 'Éditeur supprimé avec succès.' });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
  }
});

export default router;
