// Bundle le VRAI code du front (services/*, constantes de hooks/) pour un worker Node.
// Les deux variables VITE_* sont figees par --define, comme le fait `vite build`.
// Le resultat (.build/) contient la cle publique : il est ignore par git.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '..', '..');

export function lireEnv(chemin) {
  const env = {};
  try {
    for (const ligne of readFileSync(chemin, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(ligne);
      if (!m) continue;
      let v = m[2];
      if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
      env[m[1]] = v;
    }
  } catch { /* fichier absent */ }
  return env;
}

export async function construire() {
  const env = { ...lireEnv(resolve(racine, 'backend/.env.supabase')), ...lireEnv(resolve(racine, '.env')) };
  const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const cle = process.env.VITE_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  if (!url || !cle) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY introuvables (.env).');
  await build({
    entryPoints: [resolve(ici, 'poste.ts')],
    outfile: resolve(ici, '.build/poste.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external', // supabase-js, react : resolus depuis node_modules a l'execution
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(cle),
    },
    logLevel: 'warning',
  });
  return { url };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await construire();
  console.log('bundle ecrit dans scripts/charge/.build/poste.mjs');
}
