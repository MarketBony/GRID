// ============================================================================
// EXTRACTION DU FICHIER DE SUIVI — fondation de `test:suivi`.
//
// Lit `SUIVI_RDV_PHONING_BONY_3.xlsx` (le suivi des RDV de juin, tenu a la main
// par l'utilisateur) et en tire, pour chaque RDV : le vendeur, le site, la source
// (Relance / Showroom) et le resultat ecrit dans la case. RIEN D'AUTRE : ni nom
// de client ni vehicule — `test:suivi` n'en a pas besoin, et ce fichier finit
// dans le depot.
//
// Le classeur range un RDV comme une POSITION : un bloc par vendeur, une section
// par marque, cinq jours en colonnes de trois cellules (client, source, resultat).
// On relit la geometrie une fois, ici, pour ne plus jamais avoir a le faire.
//
// Usage : node scripts/extraire-suivi.mjs "<chemin du .xlsx>"
// ============================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx-js-style');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const chemin = process.argv[2];
if (!chemin) {
  console.error('Usage : node scripts/extraire-suivi.mjs "<chemin du .xlsx>"');
  process.exit(1);
}

const wb = XLSX.readFile(chemin);
const ONGLETS = { CLF: 'CLERMONT-FERRAND', MOZ: 'MOZAC', USS: 'USSEL', MASS: 'MASSAGETTES' };
const COLONNES_JOUR = [1, 4, 7, 10, 13]; // B, E, H, K, N : client ; +1 source ; +2 resultat

const lignes = [];
for (const [onglet, site] of Object.entries(ONGLETS)) {
  const ws = wb.Sheets[onglet];
  const plage = XLSX.utils.decode_range(ws['!ref']);
  const val = (r, c) => {
    const cellule = ws[XLSX.utils.encode_cell({ r, c })];
    return cellule ? String(cellule.v).trim() : '';
  };
  let vendeur = null;
  for (let r = plage.s.r; r <= plage.e.r; r++) {
    const a = val(r, 0);
    if (a.startsWith('▌')) {
      vendeur = a.replace('▌', '').trim();
      continue;
    }
    // Une ligne de creneau commence par « 9H00-10H00 » ; les en-tetes de section
    // (RENAULT, DACIA) et les lignes vides sont ignores.
    if (!vendeur || !/^\d{1,2}H\d{2}-\d{1,2}H\d{2}$/i.test(a)) continue;
    for (const c of COLONNES_JOUR) {
      const client = val(r, c);
      if (!client) continue;
      lignes.push({ vendeur, site, source: val(r, c + 1), resultat: val(r, c + 2) });
    }
  }
}

const corps = lignes
  .map((l) => `  ${JSON.stringify(l)},`)
  .join('\n');
writeFileSync(
  join(racine, 'backend/prisma/suivi-juin-source.ts'),
  `// GENERE par scripts/extraire-suivi.mjs — ne pas modifier a la main.
// Les ${lignes.length} RDV du fichier de suivi de juin : vendeur, site, source, resultat.
// Aucun nom de client, aucun vehicule.

export interface LigneSuiviSource {
  vendeur: string;
  site: string;
  /// « Relance », « Showroom », ou vide quand la case n'a pas ete remplie.
  source: string;
  /// Le texte ecrit dans la case resultat, tel quel. Vide = a traiter.
  resultat: string;
}

export const SUIVI_JUIN: LigneSuiviSource[] = [
${corps}
];
`
);
console.log(`${lignes.length} RDV extraits.`);
