// ============================================================================
// EXTRACTION DU SEED DEPUIS `seed_referentiels.sql`
//
// Traduit une fois pour toutes le SQL d'origine en donnees TypeScript, plutot que
// de recopier 99 noms de vendeurs a la main. Ce script n'est PAS branche sur le
// build : il a servi une fois, son resultat (`backend/prisma/donnees-source.ts`)
// est versionne, et `seed_referentiels.sql` part en reference obsolete.
//
// Il est conserve pour la tracabilite : si un doute nait sur un nom ou une
// affectation, on peut rejouer l'extraction et comparer.
//
// Les comptes attendus viennent de MODELE-DONNEES.md section 5, qui les donne
// comme surs : 4 plaques, 19 sites, 99 vendeurs, 8 tables, 48 affectations.
// Le script ECHOUE si un compte ne tombe pas — une extraction partielle qui
// passerait en silence est exactement ce qu'on ne veut pas.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(join(racine, 'seed_referentiels.sql'), 'utf8');

const ATTENDU = { plaques: 4, sites: 19, vendeurs: 99, tables: 8, affectations: 48 };

// ---------------------------------------------------------------- plaques
const plaques = [
  ...sql.matchAll(
    /insert into plaque \(libelle, alias, ordre\) values \('([^']+)', (?:'([^']+)'|null), (\d+)\);/g
  ),
].map((m) => ({ libelle: m[1], alias: m[2] ?? null, ordre: Number(m[3]) }));

// ---------------------------------------------------------------- sites
// La ligne MDP est commentee dans le SQL source (onglet vide, site a confirmer) :
// le `^` avec le flag `m` l'exclut, une ligne commencant par `--` ne matche pas.
const sites = [
  ...sql.matchAll(
    /^insert into site \(code, libelle, plaque_id\) select '([^']+)', '([^']+)', id from plaque where libelle = '([^']+)';/gm
  ),
].map((m) => ({ code: m[1], libelle: m[2], plaque: m[3] }));

// ---------------------------------------------------------------- vendeurs
// Les trois booleens du SQL d'origine deviennent une liste de codes de marque :
// les marques sont desormais des DONNEES (interdit n.3), plus des colonnes.
const vendeurs = [
  ...sql.matchAll(
    /^insert into vendeur \([^)]*\) select '([^']+)', id, (true|false), (true|false), (true|false) from site where code = '([^']+)';/gm
  ),
].map((m) => {
  const marques = [];
  if (m[2] === 'true') marques.push('RENAULT');
  if (m[3] === 'true') marques.push('DACIA');
  if (m[4] === 'true') marques.push('ALPINE');
  return { nom: m[1], site: m[5], marques };
});

// ---------------------------------------------------------------- tables de juin
const tables = [
  ...sql.matchAll(
    /^insert into table_phoning \(session_id, libelle, ordre\)\s*\nselect s\.id, '([^']+)', \d+\n(?:.*\n)*?where c\.libelle = '([^']+)' and p\.libelle = '([^']+)';/gm
  ),
].map((m) => ({ libelleSource: m[1], campagne: m[2], plaque: m[3] }));

// ---------------------------------------------------------------- affectations
const affectations = [
  ...sql.matchAll(
    /where c\.libelle = '([^']+)' and p\.libelle = '([^']+)'\s*\n\s*and tp\.libelle = '([^']+)' and v\.nom = '([^']+)';/g
  ),
].map((m) => ({ campagne: m[1], plaque: m[2], tableSource: m[3], vendeur: m[4] }));

// ---------------------------------------------------------------- controles
const obtenu = {
  plaques: plaques.length,
  sites: sites.length,
  vendeurs: vendeurs.length,
  tables: tables.length,
  affectations: affectations.length,
};

const ecarts = Object.entries(ATTENDU).filter(([cle, n]) => obtenu[cle] !== n);
if (ecarts.length) {
  console.error('EXTRACTION INCOMPLETE — comptes attendus vs obtenus :');
  for (const [cle, n] of ecarts) console.error(`  ${cle} : attendu ${n}, obtenu ${obtenu[cle]}`);
  process.exit(1);
}

// Un vendeur reference par une affectation mais absent de la liste des 99 serait
// un chef de table (ils n'ont pas de bloc de saisie) ou une faute de frappe. On
// veut le savoir, pas le decouvrir a l'execution du seed.
const nomsVendeurs = new Set(vendeurs.map((v) => v.nom));
const inconnus = [...new Set(affectations.map((a) => a.vendeur))].filter((n) => !nomsVendeurs.has(n));
if (inconnus.length) {
  console.error('AFFECTATIONS VERS DES VENDEURS INCONNUS :', inconnus);
  process.exit(1);
}

// Le libelle des tables portait le nom du chef (`SEVERINE BESSON - TABLE 1`).
// On le scinde : le libelle devient `Table N`, le chef devient une donnee a part,
// rattachee plus tard par `chef_utilisateur_id`.
const tablesNormalisees = tables.map((t) => {
  const [chefBrut, tableBrut] = t.libelleSource.split(/\s+[—-]\s+/);
  const numero = (tableBrut ?? '').match(/(\d+)/)?.[1] ?? '1';
  return {
    libelleSource: t.libelleSource,
    campagne: t.campagne,
    plaque: t.plaque,
    libelle: `Table ${numero}`,
    ordre: Number(numero),
    chef: chefBrut.trim(),
  };
});

const sortie = `// ============================================================================
// DONNEES SOURCE — extraites de \`seed_referentiels.sql\` par
// \`scripts/extraire-seed.mjs\`. NE PAS EDITER A LA MAIN : rejouer l'extraction.
//
// Origine : tableau_phoning_reltel_JUIN_(2).xlsx.
// Comptes verifies a l'extraction : ${obtenu.plaques} plaques, ${obtenu.sites} sites,
// ${obtenu.vendeurs} vendeurs, ${obtenu.tables} tables, ${obtenu.affectations} affectations.
//
// ATTENTION SUR \`marques\` — cette donnee N'EXISTE PAS dans le fichier Excel :
// tous les blocs vendeur y portent une section Renault ET une section Dacia,
// quelle que soit la realite du terrain. Ce qui suit est donc un PLACEHOLDER, a
// corriger vendeur par vendeur via l'ecran A3 AVANT la mise en service. Tant que
// ce n'est pas fait, la regle R-C.1 ne protege rien.
// ============================================================================

export const PLAQUES = ${JSON.stringify(plaques, null, 2)} as const;

export const SITES = ${JSON.stringify(sites, null, 2)} as const;

export const VENDEURS = ${JSON.stringify(vendeurs, null, 2)} as const;

/// Tables de juin 2026. \`chef\` est le nom lu dans le libelle d'origine : aucun de
/// ces 8 encadrants ne figure parmi les ${obtenu.vendeurs} vendeurs, ils n'ont pas de bloc de
/// saisie. Ils deviennent des utilisateurs, rattaches par \`chefUtilisateurId\`.
export const TABLES_JUIN = ${JSON.stringify(tablesNormalisees, null, 2)} as const;

export const AFFECTATIONS_JUIN = ${JSON.stringify(affectations, null, 2)} as const;
`;

const cible = join(racine, 'backend', 'prisma', 'donnees-source.ts');
writeFileSync(cible, sortie, 'utf8');

console.log('Extraction OK');
for (const [cle, n] of Object.entries(obtenu)) console.log(`  ${cle.padEnd(14)} ${n}`);
console.log(`\nChefs de table : ${[...new Set(tablesNormalisees.map((t) => t.chef))].join(', ')}`);
console.log(`\nEcrit dans ${cible}`);
