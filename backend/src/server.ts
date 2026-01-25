import fs from 'fs';
import https from 'https';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRouter from './routes/auth.js';
import { verifyToken } from './middleware/token-management.js';
import { requireRoles } from './middleware/auth-admin.js';
import usersRouter from './routes/users.js';
import publicRouter from './routes/public.js';
import festivalRouter from './routes/festival.js'
import { ensureAdmin } from './db/initAdmin.js';
import { ensureFestivals } from './db/initFestivals.js';
import { waitForDatabase } from './db/database.js';
import { ensureReservationWorkflow } from './db/initReservation.js';
import { ensureFactures } from './db/initFactures.js';

import zoneTarifaireRouter from './routes/zone_tarifaire.js';
import jeuRouter from './routes/jeu.js';
import contatcRouter from './routes/contact.js'
import contactEditeurRouter from './routes/contact_editeur.js';
import zonePlanRouter from './routes/zone-plan.js'
import jeuFestivalRoutes from './routes/jeu_festival.js';
import editeurRouter from './routes/editeur.js';
import reservationRouter from './routes/reservation.js';
import mecanismeRouter from './routes/mecanisme.js';
import typeJeuRouter from './routes/type_jeu.js';
import crmSuiviRouter from './routes/crm_suivi.js';
import factureRouter from './routes/facture.js';


// Création de l’application Express
const app = express();


app.use((req, res, next) => {
  
  res.setHeader('X-Content-Type-Options', 'nosniff');

  
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  
  res.setHeader('Referrer-Policy', 'no-referrer');

  
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

 
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  next();
});


app.use(morgan('dev'));

// Middleware JSON et cookies
app.use(express.json());
app.use(cookieParser());

// Configuration CORS
app.use(cors({
  origin: ["https://localhost:8080", "https://localhost:4200"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


const key = fs.readFileSync('./certs/localhost-key.pem');
const cert = fs.readFileSync('./certs/localhost.pem');

app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', verifyToken, usersRouter);
app.use('/zones-tarifaires', verifyToken, zoneTarifaireRouter);
app.use('/api/zones-tarifaires', verifyToken, zoneTarifaireRouter);
app.use('/jeux', jeuRouter);
app.use('/api/jeux', jeuRouter);
app.use('/api/contacts', verifyToken, contatcRouter);
app.use('/zone-plans', verifyToken, zonePlanRouter);
app.use('/api/zone-plans', verifyToken, zonePlanRouter);
app.use('api/festival', verifyToken, festivalRouter);
app.use('/api/editeurs', editeurRouter);
app.use('/api/reservations', verifyToken, reservationRouter);
app.use('/api/crm', verifyToken, crmSuiviRouter);
app.use('/api/mecanismes', mecanismeRouter);
app.use('/api/types-jeu', typeJeuRouter);
app.use('/jeu_festival', verifyToken, jeuFestivalRoutes);
app.use('/api/jeu_festival', verifyToken, jeuFestivalRoutes);
app.use('/contact_editeur', verifyToken, contactEditeurRouter);
app.use('/api/contact_editeur', verifyToken, contactEditeurRouter);
app.use('/api/admin', verifyToken, requireRoles(['super_admin']), (req, res) => {
  res.json({ message: 'Welcome admin' });
});
app.use('/api/factures', verifyToken, requireRoles(['super_admin', 'super_organisateur']), factureRouter);

app.use('/api/festivals', festivalRouter);

//HTTPS
https.createServer({ key, cert }, app).listen(4000, () => {
  console.log(' Serveur API démarré sur https://localhost:4000');
});

void (async () => {
  await waitForDatabase();
  await ensureReservationWorkflow();
  await ensureFactures();
  await ensureAdmin();
  await ensureFestivals();
  console.log(' Initialisation DB terminée');
})().catch(err => {
  console.error('Erreur pendant l\'initialisation DB', err);
});
