// ============================================================================
// CREATION D'UNE MIGRATION EN ENVIRONNEMENT NON INTERACTIF
//
// `prisma migrate dev` refuse de tourner sans terminal interactif, y compris avec
// `--create-only` des lors que la base porte deja des migrations. C'est le cas du
// PowerShell embarque utilise pour travailler sur ce projet.
//
// Ce script fait ce que `migrate dev` aurait fait, en trois etapes explicites :
//   1. `migrate diff` entre la base LIVE et `schema.prisma` -> le SQL a appliquer
//   2. ecriture du dossier de migration horodate
//   3. rien d'autre : c'est `prisma migrate deploy` qui applique
//
// Usage :  node scripts/nouvelle-migration.mjs <nom_en_snake_case>
// Puis  :  npm --prefix backend run migrate:deploy
//
// L'horodatage est genere ici et non par Prisma : deux migrations creees la meme
// seconde entreraient en collision, d'ou la seconde de precision plus un suffixe
// si le dossier existe deja.
// ============================================================================

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(racine, 'backend');

const nom = process.argv[2];
if (!nom || !/^[a-z0-9_]+$/.test(nom)) {
  console.error('Usage : node scripts/nouvelle-migration.mjs <nom_en_snake_case>');
  process.exit(1);
}

const sql = execFileSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-schema-datasource',
    'prisma/schema.prisma',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { cwd: backend, encoding: 'utf8', shell: true }
).trim();

if (sql === '' || sql.includes('This is an empty migration')) {
  console.log('Aucun changement a migrer : la base correspond deja a schema.prisma.');
  process.exit(0);
}

const h = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
let dossier = join(backend, 'prisma', 'migrations', `${h}_${nom}`);
let n = 1;
while (existsSync(dossier)) dossier = join(backend, 'prisma', 'migrations', `${h}_${nom}_${++n}`);

mkdirSync(dossier, { recursive: true });
writeFileSync(join(dossier, 'migration.sql'), sql + '\n', 'utf8');

console.log(`Migration ecrite : ${dossier}`);
console.log('\n--- SQL ---');
console.log(sql);
console.log('\nRelire le SQL ci-dessus, PUIS appliquer :');
console.log('  npm --prefix backend run migrate:deploy');
