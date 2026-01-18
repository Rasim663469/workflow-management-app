import { Router } from 'express';
import pool from '../db/database.js';

const router = Router();
const DEFAULT_WORKFLOW = 'pas_de_contact';
const PAYEE_ALLOWED_FROM = new Set(['facture', 'facture_payee']);

router.get('/reservation/:reservationId', async (req, res) => {
  const { reservationId } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM facture WHERE reservation_id = $1',
      [reservationId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Facture introuvable' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id/payee', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const factureRes = await client.query(
      'SELECT id, reservation_id, statut, payee_le FROM facture WHERE id = $1',
      [id]
    );
    const facture = factureRes.rows[0];
    if (!facture) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Facture introuvable' });
    }

    if (facture.statut === 'payee') {
      await client.query('ROLLBACK');
      return res.json({ message: 'Facture deja payee', facture });
    }

    const reservationRes = await client.query(
      'SELECT id, statut_workflow, date_paiement FROM reservation WHERE id = $1',
      [facture.reservation_id]
    );
    const reservation = reservationRes.rows[0];
    if (!reservation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation introuvable' });
    }

    const currentStatus = reservation.statut_workflow ?? DEFAULT_WORKFLOW;
    if (!PAYEE_ALLOWED_FROM.has(currentStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Transition de workflow non autorisee.' });
    }

    const updatedFacture = await client.query(
      `UPDATE facture
       SET statut = 'payee',
           payee_le = COALESCE(payee_le, NOW())
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query(
      `UPDATE reservation
       SET statut_workflow = 'facture_payee',
           date_paiement = COALESCE(date_paiement, NOW())
       WHERE id = $1`,
      [facture.reservation_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Facture marquee comme payee', facture: updatedFacture.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

export default router;
