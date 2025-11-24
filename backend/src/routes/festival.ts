import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

//creation d'un festival
router.post('/', async (req, res) => {
    const {nom,location,nombre_total_tables,date_debut,date_fin} = req.body;

    if (!nom || !location || !nombre_total_tables || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'nom,location, nombre_total_tables,date_debut,date_fin requis' });
  }

  try {
    await pool.query(
      'INSERT INTO festival (nom,location,nombre_total_tables,date_debut,date_fin) VALUES ($1, $2, $3, $4,$5)',
      [nom,location,nombre_total_tables,date_debut,date_fin]
    );
    res.status(201).json({
    message: 'Festival créé avec succès',
  
    });

  }catch (err: any){
    if (err.code === '23505') {
      res.status(409).json({ error: 'Nom déjà existant' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
});

//recupérer un festival 
router.get('/festival', async (req, res) => {
  const festival = req.festival;

  const { rows } = await pool.query(
    'SELECT nom,location,nombre_total_tables,date_debut,date_fin FROM festival WHERE nom=$1',
    [festival?.nom]
  );

  res.json(rows[0]);
});

// Liste de tous les festivals (adaptée au DTO attendu par le front)
router.get('/', async (_req, res) => {
  try{
  const { rows } = await pool.query(
    'SELECT id, nom, location, nombre_total_tables, date_debut, date_fin FROM festival ORDER BY nom'
  );

    res.json(rows);


  } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


// Mise à jour d'un festival
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, nombre_total_tables, date_debut, date_fin } = req.body;

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (nom !== undefined) {
    updates.push(`nom = $${paramIndex}`);
    values.push(nom);
    paramIndex++;
  }

  if (nombre_total_tables !== undefined) {
    updates.push(`nombre_total_tables = $${paramIndex}`);
    values.push(nombre_total_tables);
    paramIndex++;
  }

  if (date_debut !== undefined) {
    updates.push(`date_debut = $${paramIndex}`);
    values.push(date_debut);
    paramIndex++;
  }

  if (date_fin !== undefined) {
    updates.push(`date_fin = $${paramIndex}`);
    values.push(date_fin);
    paramIndex++;
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  }

  values.push(id);

  try {
    const query = `
      UPDATE festival 
      SET ${updates.join(', ')} //transforme le tableau en une chaine de caractere 
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

//Supprimer un festival
router.delete('/:id', async (req, res) => {
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
//stat total du festival
export default router;
