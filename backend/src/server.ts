import fs from 'fs';
import https from 'https';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import authRouter from './routes/auth.js';
import { verifyToken } from './middleware/token-management.js';
import { requireAdmin } from './middleware/auth-admin.js';
import usersRouter from './routes/users.js';
import publicRouter from './routes/public.js';
import festivalRouter from './routes/festival.js'
import { ensureAdmin } from './db/initAdmin.js';
import { ensureFestivals } from './db/initFestivals.js';
<<<<<<< HEAD
import zoneTarifaireRouter from './routes/zone_tarifaire.js';
import jeuRouter from './routes/jeu.js';
import contatcRouter from './routes/contact.js'
import editeurROuter from './routes/editeur.js'
import zonePlanRouter from './routes/zone-plan.js'
=======
import { ensureEditeurs } from './db/initEditeur.js';


>>>>>>> origin/main

// Création de l’application Express
const app = express();

// Ajout manuel des principaux en-têtes HTTP de sécurité
app.use((req, res, next) => {
  // Empêche le navigateur d’interpréter un fichier d’un autre type MIME -> attaque : XSS via upload malveillant
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Interdit l'intégration du site dans des iframes externes -> attaque : Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Évite que les URL avec paramètres sensibles apparaissent dans les en-têtes "Referer" -> attaque : Token ou paramètres dans l’URL
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Politique de ressources : seules les ressources du même site peuvent être chargées -> attaque : Fuite de données statiques
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Politique d'ouverture inter-origine (Empêche le partage de contexte entre onglets) -> attaque : de type Spectre - isolation des fenêtres
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Politique d'intégration inter-origine (empêche les inclusions non sûres : force l’isolation complète des ressources intégrées)
  // -> Attaques par chargement de scripts
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

  next();
});

// Log des requêtes : Visualiser le flux de requêtes entre Angular et Express
app.use(morgan('dev'));

// Middleware JSON et cookies
app.use(express.json());
app.use(cookieParser());

// Configuration CORS : autoriser le front Angular en HTTPS local
app.use(cors({
  origin: ["https://localhost:8080", "https://localhost:4200"],
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// Chargement du certificat et clé générés par mkcert (étape 0)
const key = fs.readFileSync('./certs/localhost-key.pem');
const cert = fs.readFileSync('./certs/localhost.pem');

// Lancement du serveur HTTPS
https.createServer({ key, cert }, app).listen(4000, () => {
  console.log('👍 Serveur API démarré sur https://localhost:4000');
});

await ensureAdmin();
await ensureEditeurs();
await ensureFestivals();
app.use('/api/public', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', verifyToken, usersRouter);
app.use('/zones-tarifaires', zoneTarifaireRouter);
app.use('/jeux', jeuRouter);
app.use('/contacts', contatcRouter);
app.use('/zone-plans', zonePlanRouter);
app.use('api/festival',festivalRouter);
app.use('/api/editeurs', verifyToken, (await import('./routes/editeurs.js')).default);
app.use('/api/admin', verifyToken, requireAdmin, (req, res) => {
  res.json({ message: 'Welcome admin' });
});
app.use('/api/festivals', verifyToken,  (await import('./routes/festival.js')).default);
