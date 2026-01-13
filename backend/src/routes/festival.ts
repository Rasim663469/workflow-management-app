import { Router } from 'express';
import pool from '../db/database.js';
import { requireAdmin } from '../middleware/auth-admin.js';

const router = Router();

// CREATE + zones tarifaires
router.post('/', async (req, res) => {
  const { nom, location, nombre_total_tables, date_debut, date_fin, zones } = req.body;

  if (!nom || !location || !nombre_total_tables || !date_debut || !date_fin) {
    return res
      .status(400)
      .json({ error: 'nom, location, nombre_total_tables, date_debut, date_fin sont requis' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'INSERT INTO festival (nom, location, nombre_total_tables, date_debut, date_fin) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nom, location, nombre_total_tables, date_debut, date_fin]
    );
    const festival = rows[0];

    if (Array.isArray(zones)) {
      for (const zone of zones) {
        const nomZone = zone.nom ?? zone.name ?? 'Zone';
        const nbTables = Number(zone.nombre_tables ?? zone.totalTables ?? 0);
        const prixTable = Number(zone.prix_table ?? zone.pricePerTable ?? 0);
        const prixM2 = Number(zone.prix_m2 ?? zone.pricePerM2 ?? prixTable / 4.5);

        await client.query(
          `INSERT INTO zone_tarifaire (festival_id, nom, nombre_tables_total, nombre_tables_disponibles, prix_table, prix_m2)
           VALUES ($1, $2, $3, $3, $4, $5)`,
          [festival.id, nomZone, nbTables, prixTable, prixM2]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Festival créé avec succès',
      festival,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      res.status(409).json({ error: 'Nom de festival déjà existant' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } finally {
    client.release();
  }
});

// READ ALL avec zones agrégées pour l’affichage (champs essentiels)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        f.id,
        f.nom AS name,
        f.location,
        f.date_debut AS date,
        f.nombre_total_tables AS "totalTables",
        COALESCE(json_agg(
          json_build_object(
            'name', zt.nom,
            'totalTables', zt.nombre_tables_total,
            'availableTables', zt.nombre_tables_disponibles,
            'pricePerTable', zt.prix_table,
            'pricePerM2', zt.prix_m2
          )
        ) FILTER (WHERE zt.id IS NOT NULL), '[]') AS "tariffZones"
      FROM festival f
      LEFT JOIN zone_tarifaire zt ON zt.festival_id = f.id
      GROUP BY f.id
      ORDER BY f.date_debut DESC
      `
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// READ ONE avec zones
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        f.id,
        f.nom AS name,
        f.location,
        f.date_debut AS date,
        f.nombre_total_tables AS "totalTables",
        COALESCE(json_agg(
          json_build_object(
            'name', zt.nom,
            'totalTables', zt.nombre_tables_total,
            'availableTables', zt.nombre_tables_disponibles,
            'pricePerTable', zt.prix_table,
            'pricePerM2', zt.prix_m2
          )
        ) FILTER (WHERE zt.id IS NOT NULL), '[]') AS "tariffZones"
      FROM festival f
      LEFT JOIN zone_tarifaire zt ON zt.festival_id = f.id
      WHERE f.id = $1
      GROUP BY f.id
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Festival non trouvé' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// UPDATE 
router.patch('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { nom, location, nombre_total_tables, date_debut, date_fin, description } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (nom !== undefined) { updates.push(`nom = $${paramIndex++}`); values.push(nom); }
    if (location !== undefined) { updates.push(`location = $${paramIndex++}`); values.push(location); }
    if (nombre_total_tables !== undefined) { updates.push(`nombre_total_tables = $${paramIndex++}`); values.push(nombre_total_tables); }
    if (date_debut !== undefined) { updates.push(`date_debut = $${paramIndex++}`); values.push(date_debut); }
    if (date_fin !== undefined) { updates.push(`date_fin = $${paramIndex++}`); values.push(date_fin); }
    if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    values.push(id);

    try {
        const query = `
            UPDATE festival 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Festival non trouvé' });
        }

        res.json({
            message: 'Festival mis à jour avec succès',
            festival: rows[0]
        });

    } catch (err: any) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Ce nom est déjà utilisé' });
        } else {
            console.error(err);
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
});

// DELETE 
router.delete('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {

        const { rowCount } = await pool.query(
            'DELETE FROM festival WHERE id = $1',
            [id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Festival non trouvé' });
        }

        res.status(200).json({ message: 'Festival supprimé avec succès' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression' });
    }
});



export default router;
