#!/usr/bin/env node
// ============================================================================
// TEST DE CHARGE GRID — orchestrateur. Voir README.md.
//
//   MOT_DE_PASSE="..." node scripts/charge/lancer.mjs [options]
//   node scripts/charge/lancer.mjs nettoyer      # purge les vendeurs fictifs, desactive les .test
//   node scripts/charge/lancer.mjs preparer      # prepare le bac a sable seulement
//   node scripts/charge/lancer.mjs empreinte     # affiche l'empreinte d'integrite
//
// Options (valeurs par defaut entre parentheses) :
//   --paliers 10x258,25x258,25x500,40x500   postes x RDV/heure TOTAL
//   --duree 300            secondes de regime etabli par palier
//   --pause 60             secondes entre deux paliers
//   --connexions 30        test de connexions simultanees (0 = non)
//   --attente-quota 330    secondes d'attente apres ce test (fenetre Auth de 5 min)
//   --pacing 10500         ms entre deux connexions pendant la pre-connexion des postes
//   --vendeurs 20          vendeurs fictifs 'CHARGE nn'
//   --amorcage 900         RDV synthetiques inseres avant le test (volume realiste)
//   --perimetre-poste 2    vendeurs d'un perimetre de table emule (0 = filtre reel du front)
//   --modif 0.05 --archive 0.05
//   --ouverture 20         etalement de l'ouverture des postes d'un palier (s)
//   --seuil-erreur 0.20 --seuil-p95 15000   arret automatique (fenetre glissante de 60 s)
//   --delai 60000          delai max d'une requete HTTP (ms)
//   --garder               ne nettoie pas a la fin
// ============================================================================
import { Worker } from 'node:worker_threads';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construire, lireEnv } from './build.mjs';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..', '..');
const sortie = resolve(ici, 'out');
mkdirSync(sortie, { recursive: true });

// ------------------------------------------------------------------ arguments
const argv = process.argv.slice(2);
const sousCommande = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'tout';
const opt = (nom, defaut) => {
  const i = argv.indexOf('--' + nom);
  if (i < 0) return defaut;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const O = {
  paliers: String(opt('paliers', '10x258,25x258,25x500,40x500'))
    .split(',')
    .filter((s) => s !== 'aucun')
    .map((s) => {
      const [n, r] = s.split('x').map(Number);
      return { n, rate: r };
    }),
  duree: Number(opt('duree', 300)),
  pause: Number(opt('pause', 60)),
  connexions: Number(opt('connexions', 30)),
  attenteQuota: Number(opt('attente-quota', 330)),
  pacing: Number(opt('pacing', 10500)),
  vendeurs: Number(opt('vendeurs', 20)),
  amorcage: Number(opt('amorcage', 900)),
  perimetrePoste: Number(opt('perimetre-poste', 2)),
  modif: Number(opt('modif', 0.05)),
  archive: Number(opt('archive', 0.05)),
  ouverture: Number(opt('ouverture', 20)),
  seuilErreur: Number(opt('seuil-erreur', 0.2)),
  seuilP95: Number(opt('seuil-p95', 15000)),
  delai: Number(opt('delai', 60000)),
  garder: Boolean(opt('garder', false)),
};
const CAMPAGNE = 933; // Octobre 2026 : le seul bac a sable autorise
const run = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// -------------------------------------------------------------------- environnement
const env = { ...lireEnv(resolve(racine, 'backend/.env.supabase')), ...lireEnv(resolve(racine, '.env')) };
const URL_SUPABASE = env.VITE_SUPABASE_URL;
const CLE_ANON = env.VITE_SUPABASE_ANON_KEY;
const MOT_DE_PASSE = process.env.MOT_DE_PASSE;

const lien = new URL((env.DIRECT_URL ?? '').split('?')[0]);
const PGENV = {
  ...process.env,
  PGHOST: lien.hostname,
  PGPORT: lien.port || '5432',
  PGDATABASE: lien.pathname.slice(1),
  PGUSER: decodeURIComponent(lien.username),
  PGPASSWORD: decodeURIComponent(lien.password),
  PGSSLMODE: 'require',
  PGCLIENTENCODING: 'UTF8',
};
const PSQL = process.env.PSQL ?? 'C:/Program Files/PostgreSQL/17/bin/psql.exe';

function psql(args, input) {
  const r = spawnSync(PSQL, ['-X', ...args], { env: PGENV, input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('psql a echoue : ' + (r.stderr || '').trim().slice(0, 400));
  return r.stdout;
}
const sql = (requete, vars = []) => psql(['-At', '-F', '|', ...vars, '-c', requete]).trim();
const fichierSql = (nom, vars = []) => psql([...vars, '-f', resolve(ici, nom)]);

// -------------------------------------------------------------------- utilitaires
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pct = (tri, p) => (tri.length === 0 ? null : tri[Math.min(tri.length - 1, Math.max(0, Math.ceil((p / 100) * tri.length) - 1))]);
function stats(valeurs) {
  const v = [...valeurs].sort((a, b) => a - b);
  return {
    n: v.length,
    p50: pct(v, 50),
    p95: pct(v, 95),
    p99: pct(v, 99),
    max: v.length ? v[v.length - 1] : null,
    moy: v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null,
  };
}
const estErreur = (s) => typeof s !== 'number' || s >= 400;

// -------------------------------------------------------------------- empreintes
function empreinte() {
  let t = '';
  for (const c of [1, 2, CAMPAGNE]) t += `== campagne ${c}\n` + fichierSql('empreinte.sql', ['-v', 'c=' + c]) + '\n';
  t += '== global\n' + fichierSql('empreinte-globale.sql');
  return t;
}

// -------------------------------------------------------------------- preparation / nettoyage
function preparer() {
  log('preparation du bac a sable (Octobre 2026)');
  fichierSql('preparer.sql', ['-v', 'nb=' + O.vendeurs]);
  const n = Number(sql(`select count(*) from relance.rdv where campagne_id=${CAMPAGNE}`));
  if (n < O.amorcage) {
    log(`amorcage : +${O.amorcage - n} RDV synthetiques`);
    fichierSql('amorcer.sql', ['-v', 'n=' + (O.amorcage - n)]);
  }
}
function nettoyer() {
  log('nettoyage : archivage + purge des vendeurs fictifs, encadrement archive, comptes .test desactives');
  const sortieNettoyage = fichierSql('nettoyer.sql');
  log(sortieNettoyage.split('\n').filter((l) => /rdv_supprimes|CHARGE|COMMIT|ROLLBACK|UPDATE|admin courant/.test(l)).join(' / ').slice(0, 600));
  return sortieNettoyage;
}

// -------------------------------------------------------------------- workers
const evts = []; // tous les evenements remontes par les postes
const workers = new Map();
let seqMsg = 1;

function lancerWorker(id, login) {
  return new Promise((ok, ko) => {
    const w = new Worker(resolve(ici, 'poste-boot.mjs'), {
      workerData: { id, login, motDePasse: MOT_DE_PASSE, delaiMs: O.delai },
    });
    const attentes = new Map();
    const obj = { id, login, w, attentes, pret: false, connecte: false };
    w.on('message', (m) => {
      if (m.k === 'lot') for (const e of m.items) evts.push(e);
      else if (m.k === 'pret') { obj.pret = true; ok(obj); }
      else if (m.k === 'rep') {
        const a = attentes.get(m.id);
        if (a) { attentes.delete(m.id); m.ok ? a.ok(m.res) : a.ko(new Error(m.erreur)); }
      }
    });
    w.on('error', (e) => { log(`worker ${id} erreur : ${e.message}`); ko(e); });
    workers.set(id, obj);
  });
}
function envoyer(o, msg, timeoutMs = 240000) {
  return new Promise((ok, ko) => {
    const id = seqMsg++;
    const t = setTimeout(() => { o.attentes.delete(id); ko(new Error('timeout commande ' + msg.cmd)); }, timeoutMs);
    o.attentes.set(id, { ok: (r) => { clearTimeout(t); ok(r); }, ko: (e) => { clearTimeout(t); ko(e); } });
    o.w.postMessage({ ...msg, id });
  });
}
async function arreterWorkers() {
  await Promise.all([...workers.values()].map((o) => o.w.terminate().catch(() => undefined)));
  workers.clear();
}

// -------------------------------------------------------------------- echantillonneur pg_stat_activity
const echantillons = [];
let psqlEchantillon = null;
function demarrerEchantillonneur() {
  psqlEchantillon = spawn(PSQL, ['-X', '-At', '-F', '|'], { env: PGENV });
  let tampon = '';
  let courant = [];
  psqlEchantillon.stdout.on('data', (d) => {
    tampon += d.toString();
    let i;
    while ((i = tampon.indexOf('\n')) >= 0) {
      const ligne = tampon.slice(0, i).replace(/\r$/, '');
      tampon = tampon.slice(i + 1);
      if (ligne === 'FIN') {
        echantillons.push({ t: Date.now(), lignes: courant });
        courant = [];
      } else if (ligne) {
        const [datname, app, user, etat, attente, n] = ligne.split('|');
        courant.push({ datname, app, user, etat, attente, n: Number(n) });
      }
    }
  });
  psqlEchantillon.stderr.on('data', () => undefined);
  const boucle = setInterval(() => {
    psqlEchantillon.stdin.write(
      "select coalesce(datname,''), coalesce(application_name,''), coalesce(usename,''), coalesce(state,''), coalesce(wait_event_type,''), count(*) from pg_stat_activity where pid<>pg_backend_pid() and backend_type='client backend' group by 1,2,3,4,5;\n\\echo FIN\n"
    );
  }, 5000);
  return () => { clearInterval(boucle); try { psqlEchantillon.stdin.end(); } catch { /* */ } };
}
function resumeActivite(a, b) {
  const ech = echantillons.filter((e) => e.t >= a && e.t <= b);
  if (ech.length === 0) return { echantillons: 0 };
  const somme = (e, f) => e.lignes.filter(f).reduce((s, l) => s + l.n, 0);
  const total = ech.map((e) => somme(e, () => true));
  const actives = ech.map((e) => somme(e, (l) => l.etat === 'active'));
  const idleTx = ech.map((e) => somme(e, (l) => l.etat.startsWith('idle in transaction')));
  const attente = ech.map((e) => somme(e, (l) => l.etat === 'active' && l.attente !== ''));
  const parApp = {};
  for (const e of ech) {
    const agg = {};
    for (const l of e.lignes) agg[`${l.user}/${l.app || '-'}`] = (agg[`${l.user}/${l.app || '-'}`] ?? 0) + l.n;
    for (const [k, v] of Object.entries(agg)) parApp[k] = Math.max(parApp[k] ?? 0, v);
  }
  const attentes = {};
  for (const e of ech) for (const l of e.lignes) if (l.etat === 'active' && l.attente) attentes[l.attente] = (attentes[l.attente] ?? 0) + l.n;
  const moy = (t) => Math.round((t.reduce((s, x) => s + x, 0) / t.length) * 10) / 10;
  return {
    echantillons: ech.length,
    connexionsTotal: { max: Math.max(...total), moy: moy(total) },
    actives: { max: Math.max(...actives), moy: moy(actives) },
    idleEnTransaction: { max: Math.max(...idleTx) },
    activesEnAttente: { max: Math.max(...attente), moy: moy(attente) },
    maxParUtilisateurApp: Object.fromEntries(Object.entries(parApp).sort((x, y) => y[1] - x[1]).slice(0, 8)),
    typesAttenteCumules: attentes,
  };
}

// -------------------------------------------------------------------- pg_stat_statements
function pgss(limite = 30) {
  return psql([
    '--csv',
    '-c',
    `select calls, round(total_exec_time::numeric,0) as total_ms, round(mean_exec_time::numeric,2) as moy_ms, round(max_exec_time::numeric,0) as max_ms, rows, left(regexp_replace(query,'\\s+',' ','g'),220) as requete from pg_stat_statements order by total_exec_time desc limit ${limite}`,
  ]);
}
const pgssReset = () => sql('select pg_stat_statements_reset()');

// -------------------------------------------------------------------- sante
async function sante(libelle) {
  const r = { libelle, t: new Date().toISOString() };
  const mesurer = async (nom, url, init) => {
    const t0 = Date.now();
    try {
      const rep = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
      r[nom] = { status: rep.status, ms: Date.now() - t0, corps: (await rep.text()).slice(0, 120) };
    } catch (e) {
      r[nom] = { erreur: String(e.message), ms: Date.now() - t0 };
    }
  };
  await mesurer('auth_health', `${URL_SUPABASE}/auth/v1/health`, { headers: { apikey: CLE_ANON } });
  await mesurer('postgrest_anon', `${URL_SUPABASE}/rest/v1/campagne?select=id&limit=1`, {
    headers: { apikey: CLE_ANON, 'Accept-Profile': 'relance' },
  });
  // Une requete authentifiee complete (un seul sign-in) : prouve que Auth + PostgREST + RLS repondent.
  try {
    const t0 = Date.now();
    const rep = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: CLE_ANON, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'encadrant.test@grid.bonyauto-mobile.com', password: MOT_DE_PASSE }),
      signal: AbortSignal.timeout(30000),
    });
    const jeton = rep.ok ? (await rep.json()).access_token : null;
    r.auth_signin = { status: rep.status, ms: Date.now() - t0 };
    if (jeton) {
      const t1 = Date.now();
      const q = await fetch(`${URL_SUPABASE}/rest/v1/campagne?select=id,libelle&order=id`, {
        headers: { apikey: CLE_ANON, Authorization: `Bearer ${jeton}`, 'Accept-Profile': 'relance' },
        signal: AbortSignal.timeout(30000),
      });
      r.postgrest_authentifie = { status: q.status, ms: Date.now() - t1, corps: (await q.text()).slice(0, 160) };
    }
  } catch (e) {
    r.auth_signin = { erreur: String(e.message) };
  }
  log(`sante ${libelle} : auth/health=${r.auth_health?.status ?? r.auth_health?.erreur} (${r.auth_health?.ms}ms), postgrest anon=${r.postgrest_anon?.status ?? r.postgrest_anon?.erreur}, signin=${r.auth_signin?.status ?? r.auth_signin?.erreur}, postgrest authentifie=${r.postgrest_authentifie?.status ?? 'n/a'} (${r.postgrest_authentifie?.ms}ms)`);
  return r;
}

// -------------------------------------------------------------------- agregation
function resumerRequetes(reqs, a, b) {
  const parType = new Map();
  const codes = {};
  const erreurs = new Map();
  for (const e of reqs) {
    const k = e.type;
    if (!parType.has(k)) parType.set(k, { ms: [], codes: {} });
    const p = parType.get(k);
    p.ms.push(e.ms);
    const c = String(e.status);
    p.codes[c] = (p.codes[c] ?? 0) + 1;
    codes[c] = (codes[c] ?? 0) + 1;
    if (estErreur(e.status)) {
      const cle = `${e.type} -> ${e.status} ${e.corps ?? ''}`.slice(0, 200);
      const x = erreurs.get(cle) ?? { n: 0, retryAfter: e.retryAfter };
      x.n++;
      erreurs.set(cle, x);
    }
  }
  const minutes = (b - a) / 60000;
  const nErr = reqs.filter((e) => estErreur(e.status)).length;
  return {
    total: reqs.length,
    parMinute: minutes > 0 ? Math.round(reqs.length / minutes) : null,
    erreurs: nErr,
    tauxErreur: reqs.length ? Math.round((nErr / reqs.length) * 10000) / 100 : 0,
    latenceGlobale: stats(reqs.map((e) => e.ms)),
    codes,
    parType: Object.fromEntries(
      [...parType.entries()].sort((x, y) => y[1].ms.length - x[1].ms.length).map(([k, v]) => [k, { ...stats(v.ms), codes: v.codes }])
    ),
    erreursDistinctes: [...erreurs.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 15).map(([k, v]) => ({ ...v, cle: k })),
  };
}
function resumerOps(ops) {
  const m = new Map();
  for (const o of ops) {
    if (!m.has(o.nom)) m.set(o.nom, { ms: [], echecs: 0, erreurs: {} });
    const x = m.get(o.nom);
    x.ms.push(o.ms);
    if (!o.ok) { x.echecs++; const c = (o.erreur ?? '?').slice(0, 80); x.erreurs[c] = (x.erreurs[c] ?? 0) + 1; }
  }
  return Object.fromEntries([...m.entries()].map(([k, v]) => [k, { ...stats(v.ms), echecs: v.echecs, erreurs: v.echecs ? v.erreurs : undefined }]));
}
function resumerTempsReel(pas, nPostes) {
  // pas = evenements dans la fenetre ; on apparie l'ecriture (tSend) a chaque reception.
  const ecrits = new Map();
  for (const e of pas) if (e.k === 'ecrit') ecrits.set(e.id, e);
  const acks = new Map();
  for (const e of pas) if (e.k === 'ack') acks.set(e.id, e.tAck);
  const delais = [];
  const delaisAck = [];
  const recus = new Set();
  let receptions = 0;
  for (const e of pas) {
    if (e.k !== 'rt') continue;
    const w = ecrits.get(e.id);
    if (!w || w.poste === e.poste) continue;
    receptions++;
    recus.add(e.id);
    delais.push(e.tRecv - w.tSend);
    if (acks.has(e.id)) delaisAck.push(e.tRecv - acks.get(e.id));
  }
  const ecritures = [...ecrits.values()];
  return {
    ecritures: ecritures.length,
    parGenre: ecritures.reduce((a, w) => ((a[w.genre] = (a[w.genre] ?? 0) + 1), a), {}),
    receptions,
    receptionsAttendues: ecritures.length * (nPostes - 1),
    tauxLivraison: ecritures.length ? Math.round((receptions / (ecritures.length * (nPostes - 1))) * 10000) / 100 : null,
    ecrituresJamaisRecues: ecritures.filter((w) => !recus.has(w.id)).length,
    delaiDepuisEnvoiMs: stats(delais),
    delaiDepuisAccuseMs: stats(delaisAck),
  };
}

// -------------------------------------------------------------------- test de connexions simultanees
async function testConnexions(n) {
  log(`test de connexion : ${n} signInWithPassword simultanes depuis la meme IP`);
  const logins = ['admin.test', 'direction.test', 'encadrant.test'];
  const ws = [];
  for (let i = 0; i < n; i++) ws.push(await lancerWorker(1000 + i, logins[i % 3]));
  const t0 = Date.now();
  const res = await Promise.all(ws.map((o) => envoyer(o, { cmd: 'login' }, 120000).catch((e) => ({ ok: false, message: e.message }))));
  const t1 = Date.now();
  await dormir(2500);
  const reqs = evts.filter((e) => e.k === 'req' && e.t0 >= t0 - 50 && e.t0 <= t1 && e.type.startsWith('AUTH POST token'));
  const codes = {};
  for (const e of reqs) codes[e.status] = (codes[e.status] ?? 0) + 1;
  const parStatut = {};
  for (const r of res) parStatut[r.ok ? 'OK' : `${r.statut}/${r.code}`] = (parStatut[r.ok ? 'OK' : `${r.statut}/${r.code}`] ?? 0) + 1;
  const messagesFront = {};
  for (const r of res) if (!r.ok) messagesFront[r.messageFront] = (messagesFront[r.messageFront] ?? 0) + 1;
  const messagesAuth = {};
  for (const r of res) if (!r.ok) messagesAuth[r.message] = (messagesAuth[r.message] ?? 0) + 1;
  const retry = reqs.find((e) => e.retryAfter)?.retryAfter ?? null;
  const out = {
    n,
    dureeMs: t1 - t0,
    reussies: res.filter((r) => r.ok).length,
    echouees: res.filter((r) => !r.ok).length,
    codesHttp: codes,
    parStatutAuth: parStatut,
    messagesAuth,
    messageAfficheParLeFront: messagesFront,
    retryAfter: retry,
    latenceMs: stats(reqs.map((e) => e.ms)),
  };
  await Promise.all(ws.map((o) => o.w.terminate())); // pas de signOut : il revoquerait les sessions du meme compte
  for (const o of ws) workers.delete(o.id);
  evts.length = 0;
  log('connexions simultanees :', JSON.stringify({ reussies: out.reussies, echouees: out.echouees, codesHttp: out.codesHttp }));
  return out;
}

// -------------------------------------------------------------------- palier
function sousEnsemble(id, tous, k) {
  let s = (id * 2654435761) >>> 0;
  const copie = [...tous];
  const pris = [];
  while (pris.length < Math.min(k, copie.length)) {
    s = (s * 1664525 + 1013904223) >>> 0;
    pris.push(copie.splice(s % copie.length, 1)[0]);
  }
  return pris;
}

async function palier(def, index, vendeursIds, pgActivite) {
  const { n, rate } = def;
  const actifs = [...workers.values()].filter((o) => o.connecte).slice(0, n);
  const nom = `palier ${index + 1} : ${n} postes, ${rate} RDV/h`;
  log(`=== ${nom} (${actifs.length} postes connectes) ===`);
  const moyenneMs = (actifs.length * 3600 * 1000) / rate;
  const cfg = (o) => ({
    campagneId: String(CAMPAGNE),
    moyenneMs,
    pModif: O.modif,
    pArchive: O.archive,
    perimetrePoste: O.perimetrePoste,
    sousEnsemble: sousEnsemble(o.id, vendeursIds, Math.max(1, O.perimetrePoste || 2)),
    grosCompte: o.login !== 'encadrant.test',
  });
  const debut = Date.now();
  const resultat = { nom, postes: actifs.length, rdvParHeureCible: rate, intervalleMoyenParPosteS: Math.round(moyenneMs / 1000) };
  const ouvertures = await Promise.all(
    actifs.map(async (o) => {
      await dormir(Math.random() * O.ouverture * 1000);
      return envoyer(o, { cmd: 'ouvrir', params: cfg(o) }, 240000).catch((e) => ({ echec: e.message }));
    })
  );
  const tOuvert = Date.now();
  resultat.ouverture = {
    postesOuverts: ouvertures.filter((o) => !o.echec).length,
    echecs: ouvertures.filter((o) => o.echec).map((o) => o.echec),
    chargementInitialMs: stats(ouvertures.filter((o) => !o.echec).map((o) => o.ms)),
    jusquAuPerimetreMs: stats(ouvertures.filter((o) => !o.echec).map((o) => o.msSaisie)),
    vendeursParPerimetre: stats(ouvertures.filter((o) => !o.echec).map((o) => o.vendeurs)),
    rdvLusParPerimetre: stats(ouvertures.filter((o) => !o.echec).map((o) => o.rdvs)),
  };
  log(`ouverture : ${resultat.ouverture.postesOuverts}/${actifs.length} postes, charge initiale p50=${resultat.ouverture.chargementInitialMs.p50}ms p95=${resultat.ouverture.chargementInitialMs.p95}ms`);
  await Promise.all(actifs.map((o) => envoyer(o, { cmd: 'saisir', params: {} }).catch(() => undefined)));
  const rdvAvant = Number(sql(`select count(*) from relance.rdv where campagne_id=${CAMPAGNE}`));
  resultat.rdvOctobreAvant = rdvAvant;

  // regime etabli + surveillance
  let rupture = null;
  const finPrevue = tOuvert + O.duree * 1000;
  while (Date.now() < finPrevue && !rupture) {
    await dormir(10000);
    const fen = evts.filter((e) => e.k === 'req' && e.t0 >= Date.now() - 60000 && e.t0 >= tOuvert);
    const nErr = fen.filter((e) => estErreur(e.status)).length;
    const p95 = pct(fen.map((e) => e.ms).sort((a, b) => a - b), 95);
    const act = echantillons.length ? echantillons[echantillons.length - 1].lignes.reduce((s, l) => s + (l.etat === 'active' ? l.n : 0), 0) : '?';
    log(`  [${Math.round((Date.now() - tOuvert) / 1000)}s] req/min~${fen.length} erreurs=${fen.length ? Math.round((nErr / fen.length) * 100) : 0}% p95=${p95}ms pg-actives=${act}`);
    if (fen.length >= 30 && nErr / fen.length > O.seuilErreur) rupture = `taux d'erreur ${Math.round((nErr / fen.length) * 100)} % > ${O.seuilErreur * 100} % sur 60 s`;
    else if (fen.length >= 20 && p95 > O.seuilP95) rupture = `p95 ${p95} ms > ${O.seuilP95} ms sur 60 s`;
  }
  const tFin = Date.now();
  await Promise.all(actifs.map((o) => envoyer(o, { cmd: 'fermer' }, 60000).catch(() => undefined)));
  await dormir(3000); // dernier lot d'evenements (1 s) + requetes en vol
  const fenetre = (e, a, b) => e.t0 >= a && e.t0 < b;
  const reqsOuv = evts.filter((e) => e.k === 'req' && fenetre(e, debut, tOuvert));
  const reqsReg = evts.filter((e) => e.k === 'req' && fenetre(e, tOuvert, tFin));
  const opsReg = evts.filter((e) => e.k === 'op' && fenetre(e, tOuvert, tFin));
  const opsOuv = evts.filter((e) => e.k === 'op' && fenetre(e, debut, tOuvert));
  const rtEvts = evts.filter(
    (e) => (e.k === 'ecrit' && e.tSend >= tOuvert && e.tSend < tFin) || e.k === 'ack' || (e.k === 'rt' && e.tRecv >= tOuvert && e.tRecv < tFin + 5000)
  );
  resultat.regimeEtabli = {
    dureeS: Math.round((tFin - tOuvert) / 1000),
    requetes: resumerRequetes(reqsReg, tOuvert, tFin),
    operations: resumerOps(opsReg),
    tempsReel: resumerTempsReel(rtEvts, actifs.length),
  };
  resultat.phaseOuverture = {
    dureeS: Math.round((tOuvert - debut) / 1000),
    requetes: resumerRequetes(reqsOuv, debut, tOuvert),
    operations: resumerOps(opsOuv),
  };
  const subs = {};
  for (const e of evts.filter((e) => e.k === 'sub')) subs[e.etat] = (subs[e.etat] ?? 0) + 1;
  resultat.abonnementsRealtime = subs;
  resultat.rdvOctobreApres = Number(sql(`select count(*) from relance.rdv where campagne_id=${CAMPAGNE}`));
  resultat.activitePostgres = resumeActivite(debut, tFin);
  resultat.pgStatStatementsTop = pgss(15);
  pgssReset();
  resultat.rupture = rupture;
  if (rupture) log(`!!! ARRET AUTOMATIQUE : ${rupture}`);
  log(`palier termine : ${resultat.regimeEtabli.requetes.total} requetes (${resultat.regimeEtabli.requetes.parMinute}/min), erreurs ${resultat.regimeEtabli.requetes.tauxErreur}%, RT livre ${resultat.regimeEtabli.tempsReel.tauxLivraison}% p95 ${resultat.regimeEtabli.tempsReel.delaiDepuisEnvoiMs.p95}ms`);
  evts.length = 0;
  return resultat;
}

// -------------------------------------------------------------------- principal
async function principal() {
  if (!MOT_DE_PASSE && !['nettoyer', 'preparer', 'empreinte'].includes(sousCommande)) {
    console.error('MOT_DE_PASSE requis (variable d\'environnement, jamais en argument).');
    process.exit(1);
  }
  if (sousCommande === 'nettoyer') { console.log(nettoyer()); console.log(empreinte()); return; }
  if (sousCommande === 'preparer') { preparer(); return; }
  if (sousCommande === 'empreinte') { console.log(empreinte()); return; }

  const rapport = { run, options: O, debut: new Date().toISOString(), campagne: CAMPAGNE };
  const arret = () => { log('interruption : nettoyage'); try { nettoyer(); } catch (e) { log(e.message); } process.exit(1); };
  process.on('SIGINT', arret);

  log('construction du bundle (code reel du front)');
  await construire();

  const avant = empreinte();
  writeFileSync(resolve(sortie, `empreinte-avant-${run}.txt`), avant);
  rapport.empreinteAvant = avant;
  let arreter = () => undefined;
  try {
    preparer();
    const vendeursIds = sql("select id from relance.vendeur where nom like 'CHARGE %' order by nom")
      // psql sous Windows rend des \r\n : sans `trim`, aucun identifiant ne
      // correspondait a ceux du front, et presque aucune pose ne partait.
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    rapport.vendeursFictifs = vendeursIds.length;
    rapport.santeAvant = await sante('avant');

    const instantane = pgss(400);
    writeFileSync(resolve(sortie, `pg_stat_statements-avant-${run}.csv`), instantane);
    pgssReset();
    arreter = demarrerEchantillonneur();

    if (O.connexions > 0) {
      rapport.connexionsSimultanees = await testConnexions(O.connexions);
      log(`attente de ${O.attenteQuota} s (fenetre de limitation d'Auth)`);
      await dormir(O.attenteQuota * 1000);
    }

    // Pre-connexion des postes, cadencee : la limite d'Auth par IP (30 connexions / 5 min par defaut)
    // interdit 40 connexions rafales, et le test des connexions simultanees a deja ete fait a part.
    const nMax = O.paliers.length ? Math.max(...O.paliers.map((p) => p.n)) : 0;
    log(`pre-connexion de ${nMax} postes (1 toutes les ${O.pacing} ms)`);
    const logins = (i) => (i % 10 === 0 ? 'admin.test' : i % 10 === 5 ? 'direction.test' : 'encadrant.test');
    const connexionsMs = [];
    const echecsLogin = [];
    for (let i = 1; i <= nMax; i++) {
      const o = await lancerWorker(i, logins(i));
      let r;
      for (let essai = 1; essai <= 4; essai++) {
        r = await envoyer(o, { cmd: 'login' }, 120000);
        if (r.ok) break;
        echecsLogin.push({ poste: i, essai, statut: r.statut, code: r.code, message: r.message });
        log(`  connexion poste ${i} refusee (statut ${r.statut}, ${r.code}) : nouvel essai dans 65 s`);
        await dormir(65000);
      }
      o.connecte = r.ok;
      if (r.ok) connexionsMs.push(r.ms);
      if (i < nMax) await dormir(O.pacing);
    }
    rapport.preConnexion = { postes: nMax, connectes: [...workers.values()].filter((o) => o.connecte).length, connexionMs: stats(connexionsMs), refus: echecsLogin };
    evts.length = 0;

    rapport.paliers = [];
    for (let i = 0; i < O.paliers.length; i++) {
      if (i > 0) { log(`pause ${O.pause} s`); await dormir(O.pause * 1000); }
      const r = await palier(O.paliers[i], i, vendeursIds);
      rapport.paliers.push(r);
      writeFileSync(resolve(sortie, `rapport-${run}.json`), JSON.stringify(rapport, null, 2));
      if (r.rupture) { rapport.arretAutomatique = { palier: i + 1, raison: r.rupture }; break; }
    }
  } catch (e) {
    rapport.erreurFatale = String(e.stack ?? e);
    log('ERREUR : ' + e.message);
  } finally {
    await arreterWorkers();
    arreter();
    await dormir(1500);
    rapport.santeApresTest = await sante('apres test (avant nettoyage)').catch((e) => ({ erreur: String(e) }));
    if (!O.garder) {
      try {
        rapport.nettoyage = nettoyer();
      } catch (e) {
        rapport.nettoyageEchec = String(e);
        log('NETTOYAGE EN ECHEC : ' + e.message + ' -> relancer `node scripts/charge/lancer.mjs nettoyer`');
      }
      const apres = empreinte();
      writeFileSync(resolve(sortie, `empreinte-apres-${run}.txt`), apres);
      rapport.empreinteApres = apres;
      rapport.empreintesIdentiques = apres === avant;
    }
    rapport.fin = new Date().toISOString();
    rapport.santeFinale = await sante('finale').catch((e) => ({ erreur: String(e) }));
    writeFileSync(resolve(sortie, `rapport-${run}.json`), JSON.stringify(rapport, null, 2));
    log(`rapport : scripts/charge/out/rapport-${run}.json`);
  }
}

await principal();
process.exit(0);
