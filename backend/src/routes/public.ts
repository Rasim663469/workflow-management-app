import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Bienvenue sur l’API publique (accès libre)' });
});

export default router;
