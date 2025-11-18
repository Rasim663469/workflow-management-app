import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();

//creation d'un festival
router.post('/', async (req, res) => {
    const {nom,nombre_total_tables,date_debut,date_fin} = req.body;

    if (!nom || !nombre_total_tables || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'nom,nombre_total_tables,date_debut,date_fin requis' });
  }

  try {
    await pool.query(
      'INSERT INTO festival (nom,nombre_total_tables,date_debut,date_fin) VALUES ($1, $2, $3, $4)',
      [nom,nombre_total_tables,date_debut,date_fin]
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
    'SELECT nom,nombre_total_tables,date_debut,date_fin FROM festival WHERE nom=$1',
    [festival?.nom]
  );

  res.json(rows[0]);
});

// Liste de tous les festival 
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT nom,nombre_total_tables,date_debut,date_fin FROM festival ORDER BY nom'
  );
  res.json(rows);
});


