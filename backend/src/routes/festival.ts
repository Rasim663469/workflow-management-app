import { Router } from 'express';
import pool from '../db/database.js';
import { requireRoles } from '../middleware/auth-admin.js';
import { verifyToken } from '../middleware/token-management.js';

const router = Router();

// CREATE + zones tarifaires
router.post(
  '/',
  verifyToken,
  requireRoles(['super_admin', 'super_organisateur']),
  async (req, res) => {
  const {
    nom,
    location,
    nombre_total_tables,
    date_debut,
    date_fin,
    description,
    zones,
    stock_tables_standard = 0,
    stock_tables_grandes = 0,
    stock_tables_mairie = 0,
    stock_chaises = 0,
  } = req.body;

  if (!nom || !location || !nombre_total_tables || !date_debut || !date_fin) {
    return res
      .status(400)
      .json({ error: 'nom, location, nombre_total_tables, date_debut, date_fin sont requis' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Option recommandée : on garde tous les champs de stock
    const { rows } = await client.query(
      `INSERT INTO festival 
        (nom, location, nombre_total_tables, date_debut, date_fin, description, 
         stock_tables_standard, stock_tables_grandes, stock_tables_mairie, stock_chaises)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        nom,
        location,
        nombre_total_tables,
        date_debut,
        date_fin,
        description ?? null,
        Number(stock_tables_standard) || 0,
        Number(stock_tables_grandes) || 0,
        Number(stock_tables_mairie) || 0,
        Number(stock_chaises) || 0,
      ]
    );
    const festival = rows[0];

    if (Array.isArray(zones)) {
      for (const zone of zones) {
        const nomZone = zone.nom ?? zone.name ?? 'Zone';
        const nbTables = Number(zone.nombre_tables ?? zone.totalTables ?? 0);
        const prixTable = Number(zone.prix_table ?? zone.pricePerTable ?? 0);
        const prixM2 = Number(zone.prix_m2 ?? zone.pricePerM2 ?? prixTable / 4);

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

// READ ALL avec zones agrégées pour l'affichage (champs essentiels)
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        f.id,
        f.nom AS name,
        f.location,
        f.date_debut AS "dateDebut",
        f.date_fin AS "dateFin",
        f.description,
        f.nombre_total_tables AS "totalTables",
        f.stock_tables_standard AS "stockTablesStandard",
        f.stock_tables_grandes AS "stockTablesGrandes",
        f.stock_tables_mairie AS "stockTablesMairie",
        f.stock_chaises AS "stockChaises",
        COALESCE(json_agg(
          DISTINCT jsonb_build_object(

            'id', zt.id,
            'name', zt.nom,
            'totalTables', zt.nombre_tables_total,
            'availableTables', zt.nombre_tables_disponibles,
            'pricePerTable', zt.prix_table,
            'pricePerM2', zt.prix_m2
          )
        ) FILTER (WHERE zt.id IS NOT NULL), '[]') AS "tariffZones",
        COALESCE(json_agg(
          DISTINCT jsonb_build_object(
            'id', e.id,
            'name', e.nom
          )
        ) FILTER (WHERE e.id IS NOT NULL), '[]') AS "editeurs"
      FROM festival f
      LEFT JOIN zone_tarifaire zt ON zt.festival_id = f.id
      LEFT JOIN reservation r ON r.festival_id = f.id
      LEFT JOIN editeur e ON e.id = r.editeur_id
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

// STOCK USAGE
router.get('/:id/stock', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        f.id AS "festivalId",
        f.stock_tables_standard AS "stockTablesStandard",
        f.stock_tables_grandes AS "stockTablesGrandes",
        f.stock_tables_mairie AS "stockTablesMairie",
        f.stock_chaises AS "stockChaises",
        COALESCE(SUM(CASE WHEN jf.type_table = 'standard' THEN jf.tables_utilisees ELSE 0 END), 0) AS "usedStandard",
        COALESCE(SUM(CASE WHEN jf.type_table = 'grande' THEN jf.tables_utilisees ELSE 0 END), 0) AS "usedGrandes",
        COALESCE(SUM(CASE WHEN jf.type_table = 'mairie' THEN jf.tables_utilisees ELSE 0 END), 0) AS "usedMairie"
      FROM festival f
      LEFT JOIN reservation r ON r.festival_id = f.id
      LEFT JOIN jeu_festival jf ON jf.reservation_id = r.id AND jf.zone_plan_id IS NOT NULL
      WHERE f.id = $1
      GROUP BY f.id
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Festival non trouvé' });
    }

    const row = rows[0];
    const usedStandard = Number(row.usedStandard ?? 0);
    const usedGrandes = Number(row.usedGrandes ?? 0);
    const usedMairie = Number(row.usedMairie ?? 0);
    const usedTotal = usedStandard + usedGrandes + usedMairie;
    const usedChaises = usedTotal * 6;

    res.json({
      festivalId: row.festivalId,
      totals: {
        standard: Number(row.stockTablesStandard ?? 0),
        grandes: Number(row.stockTablesGrandes ?? 0),
        mairie: Number(row.stockTablesMairie ?? 0),
        chaises: Number(row.stockChaises ?? 0),
      },
      used: {
        standard: usedStandard,
        grandes: usedGrandes,
        mairie: usedMairie,
        chaises: usedChaises,
      },
      remaining: {
        standard: Number(row.stockTablesStandard ?? 0) - usedStandard,
        grandes: Number(row.stockTablesGrandes ?? 0) - usedGrandes,
        mairie: Number(row.stockTablesMairie ?? 0) - usedMairie,
        chaises: Number(row.stockChaises ?? 0) - usedChaises,
      },
    });
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
        f.date_debut AS "dateDebut",
        f.date_fin AS "dateFin",
        f.description,
        f.nombre_total_tables AS "totalTables",
        f.stock_tables_standard AS "stockTablesStandard",
        f.stock_tables_grandes AS "stockTablesGrandes",
        f.stock_tables_mairie AS "stockTablesMairie",
        f.stock_chaises AS "stockChaises",
        COALESCE(json_agg(
          DISTINCT jsonb_build_object(
            'id', zt.id,
            'name', zt.nom,
            'totalTables', zt.nombre_tables_total,
            'availableTables', zt.nombre_tables_disponibles,
            'pricePerTable', zt.prix_table,
            'pricePerM2', zt.prix_m2
          )
        ) FILTER (WHERE zt.id IS NOT NULL), '[]') AS "tariffZones",
        COALESCE(json_agg(
          DISTINCT jsonb_build_object(
            'id', e.id,
            'name', e.nom
          )
        ) FILTER (WHERE e.id IS NOT NULL), '[]') AS "editeurs"
      FROM festival f
      LEFT JOIN zone_tarifaire zt ON zt.festival_id = f.id
      LEFT JOIN reservation r ON r.festival_id = f.id
      LEFT JOIN editeur e ON e.id = r.editeur_id
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
router.patch(
  '/:id',
  verifyToken,
  requireRoles(['super_admin', 'super_organisateur']),
  async (req, res) => {
  const { id } = req.params;
  const {
    nom,
    location,
    nombre_total_tables,
    date_debut,
    date_fin,
    description,
    stock_tables_standard,
    stock_tables_grandes,
    stock_tables_mairie,
    stock_chaises,
  } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (nom !== undefined) { updates.push(`nom = $${paramIndex++}`); values.push(nom); }
  if (location !== undefined) { updates.push(`location = $${paramIndex++}`); values.push(location); }
  if (nombre_total_tables !== undefined) { updates.push(`nombre_total_tables = $${paramIndex++}`); values.push(nombre_total_tables); }
  if (date_debut !== undefined) { updates.push(`date_debut = $${paramIndex++}`); values.push(date_debut); }
  if (date_fin !== undefined) { updates.push(`date_fin = $${paramIndex++}`); values.push(date_fin); }
  if (description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(description); }
  if (stock_tables_standard !== undefined) { updates.push(`stock_tables_standard = $${paramIndex++}`); values.push(stock_tables_standard); }
  if (stock_tables_grandes !== undefined) { updates.push(`stock_tables_grandes = $${paramIndex++}`); values.push(stock_tables_grandes); }
  if (stock_tables_mairie !== undefined) { updates.push(`stock_tables_mairie = $${paramIndex++}`); values.push(stock_tables_mairie); }
  if (stock_chaises !== undefined) { updates.push(`stock_chaises = $${paramIndex++}`); values.push(stock_chaises); }

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
router.delete(
  '/:id',
  verifyToken,
  requireRoles(['super_admin', 'super_organisateur']),
  async (req, res) => {
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

// READ games for a festival
router.get('/:id/games', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT 
        j.id,
        j.nom AS name,
        j.auteurs,
        j.age_min AS "ageMin",
        j.age_max AS "ageMax",
        j.type_jeu AS "typeJeu",
        e.nom AS "editeurName",
        e.id AS "editeurId",
        jf.quantite,
        jf.tables_utilisees AS "tablesUtilisees"
      FROM jeu_festival jf
      JOIN jeu j ON j.id = jf.jeu_id
      JOIN reservation r ON r.id = jf.reservation_id
      JOIN editeur e ON e.id = j.editeur_id
      WHERE r.festival_id = $1
      ORDER BY e.nom, j.nom`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});



export default router;
