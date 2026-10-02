// Point d'entree d'un worker : instrumente `fetch` AVANT de charger le code du front
// (le client Supabase est cree a l'import de services/supabase.ts), puis delegue a poste.mjs.
import { parentPort, workerData } from 'node:worker_threads';

const fetchReel = globalThis.fetch;
let tampon = [];
const emit = (e) => tampon.push(e);
setInterval(() => {
  if (tampon.length) { parentPort.postMessage({ k: 'lot', items: tampon }); tampon = []; }
}, 1000).unref();

const DELAI = workerData.delaiMs ?? 60_000;

function classer(url, methode) {
  let p;
  try { p = new URL(url); } catch { return methode + ' ?'; }
  const c = p.pathname;
  if (c.startsWith('/auth/v1/')) return 'AUTH ' + methode + ' ' + c.slice('/auth/v1/'.length);
  if (c.startsWith('/rest/v1/rpc/')) return 'RPC ' + c.slice('/rest/v1/rpc/'.length);
  if (c.startsWith('/rest/v1/')) return methode + ' ' + c.slice('/rest/v1/'.length);
  if (c.includes('realtime')) return 'RT-HTTP ' + methode;
  return methode + ' ' + c;
}

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const methode = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const type = classer(url, methode);
  const t0 = Date.now();
  const delai = AbortSignal.timeout(DELAI);
  const signal = init?.signal ? AbortSignal.any([init.signal, delai]) : delai;
  try {
    const r = await fetchReel(input, { ...init, signal });
    const e = { k: 'req', poste: workerData.id, type, status: r.status, t0, ms: Date.now() - t0 };
    if (r.status >= 400) {
      try {
        e.corps = (await r.clone().text()).slice(0, 160);
        const ra = r.headers.get('retry-after');
        if (ra) e.retryAfter = ra;
      } catch { /* ignore */ }
    }
    emit(e);
    return r;
  } catch (err) {
    const timeout = delai.aborted;
    emit({ k: 'req', poste: workerData.id, type, status: timeout ? 'TIMEOUT' : 'NETERR:' + (err?.cause?.code ?? err?.name ?? 'inconnu'), t0, ms: Date.now() - t0, corps: String(err?.message ?? err).slice(0, 120) });
    throw err;
  }
};

const { creerPoste } = await import('./.build/poste.mjs');
const poste = creerPoste({ ...workerData, emit });

parentPort.on('message', async (m) => {
  try {
    const res = await poste.commande(m);
    parentPort.postMessage({ k: 'rep', id: m.id, ok: true, res });
  } catch (err) {
    parentPort.postMessage({ k: 'rep', id: m.id, ok: false, erreur: String(err?.message ?? err) });
  }
});
parentPort.postMessage({ k: 'pret' });
