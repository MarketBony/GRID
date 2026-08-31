// L'ordre de ces deux premiers imports compte.
import './utils/json'; // patch BigInt.toJSON — AVANT toute route, sinon 500 opaque
import 'express-async-errors'; // les rejets async atteignent le middleware d'erreur

import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { errorHandler } from './middleware/errorHandler';
import { setupRealtime, withEmitterContext } from './realtime';
import { verifierInvariants } from './utils/verifierInvariants';
import authRoutes from './routes/auth';
import referentielsRoutes from './routes/referentiels';
import vendeursRoutes from './routes/vendeurs';
import campagnesRoutes from './routes/campagnes';
import saisieRoutes from './routes/saisie';
import rdvRoutes from './routes/rdv';
import dashboardRoutes from './routes/dashboard';
import tablesRoutes from './routes/tables';
import utilisateursRoutes from './routes/utilisateurs';

dotenv.config();

const app = express();
const serveurHttp = http.createServer(app);

// En developpement, le front est servi par Vite sur 3000 et proxifie /api et
// /socket.io vers ce serveur : les requetes arrivent donc en meme origine et CORS
// ne sert a rien. En production, Caddy sert le front et l'API sous le MEME
// domaine (`grid.bonyauto-mobile.com`), donc CORS ne sert a rien non plus.
// D'ou une origine explicitement restreinte plutot qu'un `*` : si un jour une
// requete cross-origin apparait, on veut le savoir, pas la voir passer.
const originesAutorisees = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const io = new Server(serveurHttp, {
  cors: { origin: originesAutorisees, methods: ['GET', 'POST', 'PUT', 'PATCH'] },
});

app.use(cors({ origin: originesAutorisees }));
app.use(express.json({ limit: '1mb' }));

// Contexte d'emission : memorise le `x-socket-id` de l'appelant pour la duree de
// la requete, afin que `emettre` ne renvoie pas l'evenement a son propre auteur.
// A MONTER AVANT LES ROUTES.
app.use(withEmitterContext);

app.get('/api/sante', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/referentiels', referentielsRoutes);
app.use('/api/vendeurs', vendeursRoutes);
app.use('/api/campagnes', campagnesRoutes);
app.use('/api/saisie', saisieRoutes);
app.use('/api/rdv', rdvRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);

// APRES toutes les routes.
app.use(errorHandler);

setupRealtime(io);

const port = Number(process.env.PORT ?? 3001);

// Le controle de coherence code <-> base tourne AVANT d'ecouter. Un serveur qui
// accepte des valeurs que l'autre moitie du systeme rejettera est pire qu'un
// serveur qui refuse de demarrer : la premiere erreur n'apparaitrait qu'a la
// premiere saisie, en pleine campagne.
verifierInvariants()
  .then(() => {
    serveurHttp.listen(port, () => {
      console.log(`[relance] API sur http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('\n[relance] DEMARRAGE REFUSE\n');
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
