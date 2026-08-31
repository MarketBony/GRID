// ============================================================================
// EXTRACTION DEPUIS LE FICHIER EXCEL SOURCE
//
// Complete `extraire-seed.mjs`, qui ne lisait que le SQL d'origine. Ce script lit
// le classeur lui-meme et en tire trois choses que le SQL ne portait pas :
//
//   1. Le TYPE (VN / VO) de chaque vendeur, donne explicitement par l'onglet
//      RESULTATS. C'etait la moitie du point bloquant n.1 : elle disparait.
//   2. Les marques de chaque site, lues dans l'EN-TETE du bloc RESULTATS
//      (`REN`/`DAC`, ou `ALP` pour le site Alpine).
//   3. Les TOTAUX ATTENDUS de la campagne de juin — par vendeur, par site, par
//      table. Ce sont les chiffres de reference du critere de recette n.4 :
//      « les totaux de l'outil et ceux du fichier concordent a l'unite ».
//
// CE QUE CE SCRIPT NE DEDUIT PAS, deliberement : les marques AUTORISEES d'un
// vendeur. Les colonnes REN et DAC donnent une ACTIVITE, pas une autorisation. Un
// vendeur a `REN 0 / DAC 20` peut etre Dacia seul, ou n'avoir simplement rien
// vendu en Renault cette campagne. Deviner ici produirait des refus
// incomprehensibles en pleine session, des semaines plus tard.
//
// Usage : node scripts/extraire-xlsx.mjs "<chemin du .xlsx>"
// ============================================================================

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx-js-style');

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const chemin =
  process.argv[2] ?? 'C:/Users/Operateur/Downloads/tableau phoning reltel JUIN (2).xlsx';

const wb = XLSX.readFile(chemin);

const norm = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cel = (ws, r, c) => {
  const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  return ws[ref]?.v ?? null;
};

// ---------------------------------------------------------------- RESULTATS
const ws = wb.Sheets['RÉSULTATS'];
if (!ws) throw new Error("Onglet RESULTATS introuvable");
const plage = XLSX.utils.decode_range(ws['!ref']);

const vendeurs = [];
const sites = [];

for (let r = 1; r <= plage.e.r + 1; r++) {
  for (let c = 1; c <= plage.e.c + 1; c++) {
    if (norm(cel(ws, r, c)) !== 'VENDEUR') continue;

    // Le nom du site est juste au-dessus de la colonne VENDEUR.
    const nomSite = cel(ws, r - 1, c);
    if (!nomSite) continue;

    // En-tete des marques : `REN` + `DAC`, ou `ALP` seul.
    const codesMarque = [];
    for (const dc of [1, 2, 3]) {
      const h = norm(cel(ws, r, c + dc));
      if (h === 'REN') codesMarque.push('RENAULT');
      else if (h === 'DAC') codesMarque.push('DACIA');
      else if (h === 'ALP') codesMarque.push('ALPINE');
    }

    // Colonne RDV : celle dont l'en-tete est `RDV`.
    let colRdv = null;
    for (let dc = 1; dc <= 6; dc++) {
      if (norm(cel(ws, r, c + dc)) === 'RDV') {
        colRdv = c + dc;
        break;
      }
    }

    const bloc = { nom: String(nomSite).trim(), codesMarque, totaux: {} };

    for (let l = r + 1; l <= plage.e.r + 1; l++) {
      const brut = cel(ws, l, c);
      if (brut === null || String(brut).trim() === '') {
        // Une ligne vide seule ne termine pas le bloc (VN et VO en sont separes).
        if (cel(ws, l + 1, c) === null) break;
        continue;
      }
      const etiquette = norm(brut);
      const valeurRdv = colRdv ? cel(ws, l, colRdv) : null;

      if (etiquette === 'TOTAL VN') {
        bloc.totaux.vn = valeurRdv;
        continue;
      }
      if (etiquette === 'TOTAL VO') {
        bloc.totaux.vo = valeurRdv;
        continue;
      }
      if (etiquette === 'TOTAL AFFAIRE') {
        bloc.totaux.total = valeurRdv;
        break;
      }

      const type = norm(cel(ws, l, c + 1));
      if (type !== 'VN' && type !== 'VO') continue;

      vendeurs.push({
        nom: String(brut).trim(),
        site: bloc.nom,
        type,
        // Chiffres de juin 2026, pour la verification uniquement.
        ren: codesMarque.includes('RENAULT') ? (cel(ws, l, c + 2) ?? 0) : null,
        dac: codesMarque.includes('DACIA') ? (cel(ws, l, c + 3) ?? 0) : null,
        rdv: valeurRdv ?? 0,
      });
    }

    sites.push(bloc);
  }
}

// ---------------------------------------------------------------- TABLES
const tables = [];
for (const nomOnglet of wb.SheetNames.filter((n) => n.startsWith('TABLES'))) {
  const wt = wb.Sheets[nomOnglet];
  const pt = XLSX.utils.decode_range(wt['!ref']);
  for (let c = 1; c <= pt.e.c + 1; c++) {
    if (norm(cel(wt, 3, c)) !== 'VENDEUR') continue;
    const chef = cel(wt, 1, c);
    const libelle = cel(wt, 2, c);
    // Colonne RDV du bloc : en-tete `RDV` sur la meme ligne.
    let colRdv = null;
    for (let dc = 1; dc <= 5; dc++) {
      if (norm(cel(wt, 3, c + dc)) === 'RDV') {
        colRdv = c + dc;
        break;
      }
    }
    let total = null;
    for (let l = 10; l <= pt.e.r + 1; l++) {
      const v = colRdv ? cel(wt, l, colRdv) : null;
      if (typeof v === 'number') {
        total = v;
        break;
      }
    }
    tables.push({
      onglet: nomOnglet,
      chef: String(chef ?? '').trim(),
      libelle: String(libelle ?? '').trim(),
      total,
    });
  }
}

// ---------------------------------------------------------------- RDV, onglet par onglet
//
// GEOMETRIE, relevee et verifiee sur les 19 onglets site :
//
//   ligne 1          en-tetes de jour, colonnes C a G
//   ligne 2          COUNTA du jour pour TOUT le site
//   ligne 4  + 27k   nom du vendeur, colonne B
//   ligne 6  + 27k   libelle de la 1re section (une marque), colonne B, puis 11 creneaux
//   ligne 17 + 27k   libelle de la 2e section, puis 11 creneaux
//
// Le pas de 27 lignes est une RIGIDITE DU GABARIT EXCEL, pas une regle metier : le
// site ALPINE n'a qu'une seule section et son bloc s'arrete a la ligne 16 + 27k.
// C'est ce qui a fait comprendre la vraie regle — une section par marque autorisee.
//
// La cellule contient le nom du client en TEXTE LIBRE, parfois enrichi :
// « RAGOT 208 » (le vehicule), « CHOMEILLE* » (une marque de suivi). On la reprend
// telle quelle : la structurer davantage serait inventer une donnee.
const NON_SITES = new Set(['RANK', 'SUIVI', 'RÉSULTATS', 'TABLES(EAA)', 'TABLES(SUD)']);
const PAS = 27;

/// Horaires attendus, DANS L'ORDRE. Servent de controle de calage : si le bloc d'un
/// vendeur est decale d'une ligne, l'horaire lu ne tombe plus sur celui attendu et
/// l'extraction s'arrete. Sans ce controle, un decalage produirait des RDV rattaches
/// au mauvais creneau — silencieusement, et avec un total juste.
const HORAIRES_ATTENDUS = [
  '8H00-9H00', '9H00-10H00', '10H00-11H00', '11H00-12H00', '12H00-13H00', '13H00-14H00',
  '14H00-15H00', '15H00-16H00', '16H00-17H00', '17H00-18H00', '18H00-19H00',
];

/// Codes des creneaux tels que le modele les porte (`campagne_creneau.code`).
const CODES_CRENEAU = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00',
  '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00', '18:00-19:00',
];

/// Les 5 jours de juin 2026, dans l'ordre des colonnes C a G.
const JOURS_JUIN = ['2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15'];

const normHoraire = (v) => String(v ?? '').toUpperCase().replace(/\s+/g, '');

const rdvs = [];
const totauxJourParSite = {};
const anomalies = [];

for (const code of wb.SheetNames) {
  if (NON_SITES.has(code)) continue;
  const wsSite = wb.Sheets[code];
  if (!wsSite || !wsSite['!ref']) continue;

  // Les jours sont pris PAR POSITION, avec controle du numero lu dans le libelle.
  // Se fier au libelle seul serait fragile : « JEUDI 11 JUIN » n'est pas une date.
  const jours = [];
  for (let c = 3; c <= 7; c++) {
    const libelle = String(cel(wsSite, 1, c) ?? '').trim();
    if (!libelle) continue;
    const iso = JOURS_JUIN[c - 3];
    const numero = (libelle.match(/\d+/) ?? [])[0];
    if (numero && iso.slice(8) !== String(numero).padStart(2, '0')) {
      anomalies.push(`${code} colonne ${c} : « ${libelle} » ne correspond pas a ${iso}`);
    }
    jours.push({ colonne: c, iso, libelle });
  }

  // La ligne 2 est un `COUNTA` sur les blocs vendeur. Sur GAILL et CARM elle porte
  // des `#REF!` et vise des lignes qui n'existent plus — CARM fait 27 lignes et sa
  // formule additionne jusqu'a la 138 — tout en AFFICHANT un nombre plausible. Ce
  // sont des valeurs figees, jamais recalculees depuis que des blocs ont ete
  // supprimes. On releve donc la formule pour savoir si le chiffre est fiable.
  const formuleCassee = [];
  for (const j of jours) {
    const ref = XLSX.utils.encode_cell({ r: 1, c: j.colonne - 1 });
    const f = wsSite[ref]?.f ?? '';
    if (f.includes('#REF!')) formuleCassee.push(j.libelle);
  }

  totauxJourParSite[code] = jours.map((j) => ({
    jour: j.libelle,
    rdv: cel(wsSite, 2, j.colonne) ?? 0,
    /// `false` = la formule du fichier porte un `#REF!`, le chiffre affiche est
    /// figé et faux. Ne pas s'en servir comme reference.
    fiable: !formuleCassee.includes(j.libelle),
  }));

  for (let k = 0; ; k++) {
    const base = 4 + PAS * k;
    const nomVendeur = String(cel(wsSite, base, 2) ?? '').trim();
    if (!nomVendeur) break;

    for (const debut of [6 + PAS * k, 17 + PAS * k]) {
      const marque = String(cel(wsSite, debut, 2) ?? '').trim();
      if (!marque) continue; // ALPINE : aucune deuxieme section

      for (let i = 0; i < HORAIRES_ATTENDUS.length; i++) {
        const horaire = normHoraire(cel(wsSite, debut + i, 1));
        if (horaire && horaire !== HORAIRES_ATTENDUS[i]) {
          anomalies.push(
            `${code} ligne ${debut + i} : horaire « ${horaire} » au lieu de « ${HORAIRES_ATTENDUS[i]} »`
          );
        }
        for (const j of jours) {
          const client = String(cel(wsSite, debut + i, j.colonne) ?? '').trim();
          if (!client) continue;
          rdvs.push({
            site: code,
            vendeur: nomVendeur,
            marque,
            jour: j.iso,
            creneau: CODES_CRENEAU[i],
            client,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------- controles
const parType = vendeurs.reduce((a, v) => ((a[v.type] = (a[v.type] ?? 0) + 1), a), {});
console.log(`vendeurs lus      : ${vendeurs.length}  (VN ${parType.VN ?? 0} / VO ${parType.VO ?? 0})`);
console.log(`sites lus         : ${sites.length}`);
console.log(`tables lues       : ${tables.length}`);

const sommeSites = sites.reduce((n, s) => n + (s.totaux.total ?? 0), 0);
const sommeVendeurs = vendeurs.reduce((n, v) => n + (v.rdv ?? 0), 0);
console.log(`somme des sites   : ${sommeSites}`);
console.log(`somme des vendeurs: ${sommeVendeurs}`);
if (sommeSites !== sommeVendeurs) {
  console.error(
    `\nINCOHERENCE : la somme des vendeurs (${sommeVendeurs}) ne retombe pas sur la somme ` +
      `des sites (${sommeSites}). L'extraction est incomplete, ne pas l'utiliser.`
  );
  process.exit(1);
}

// ------------------------------------------------- controles croises des RDV lus
//
// C'est ici que tout se joue. Le fichier porte les MEMES totaux a quatre endroits
// independants : par vendeur et par site dans RESULTATS, par table dans TABLES*, et
// par jour en ligne 2 de chaque onglet site. Recompter les cellules et retomber sur
// les quatre, c'est la preuve que la lecture est juste — et c'est ce qui rendra
// verifiables les agregats de l'outil.
//
// Un total juste ne suffit pas : un decalage de creneau donne le bon total et de
// mauvaises cases. D'ou le controle de calage des horaires plus haut.
console.log(`RDV lus           : ${rdvs.length}`);

if (anomalies.length > 0) {
  console.error(`\n${anomalies.length} ANOMALIE(S) DE GEOMETRIE :`);
  for (const a of anomalies.slice(0, 20)) console.error(`  ${a}`);
  console.error("\nL'extraction est suspecte, ne pas l'utiliser.");
  process.exit(1);
}

const echecs = [];
const cleNom = (s) =>
  norm(s)
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

if (rdvs.length !== sommeVendeurs) {
  echecs.push(`total : ${rdvs.length} RDV lus, ${sommeVendeurs} attendus`);
}

// 1. par vendeur — le controle le plus fin, 99 comparaisons
const parVendeur = {};
for (const r of rdvs) parVendeur[cleNom(r.vendeur)] = (parVendeur[cleNom(r.vendeur)] ?? 0) + 1;
for (const v of vendeurs) {
  const lu = parVendeur[cleNom(v.nom)] ?? 0;
  if (lu !== v.rdv) echecs.push(`vendeur ${v.nom} (${v.site}) : ${lu} lus, ${v.rdv} attendus`);
}

// 2. par site — 19 comparaisons. Le rapprochement passe par le NOM du vendeur et
// non par le code de l'onglet : RESULTATS nomme les sites (« CLERMONT »), les
// onglets les codent (« CLF »), et rien dans le fichier ne relie formellement les
// deux. Le nom du vendeur, lui, est present des deux cotes.
const siteParVendeur = new Map(vendeurs.map((v) => [cleNom(v.nom), v.site]));
const parSiteLu = {};
for (const r of rdvs) {
  const nomSite = siteParVendeur.get(cleNom(r.vendeur));
  if (!nomSite) {
    echecs.push(`vendeur « ${r.vendeur} » (onglet ${r.site}) absent de RESULTATS`);
    continue;
  }
  parSiteLu[nomSite] = (parSiteLu[nomSite] ?? 0) + 1;
}
for (const s of sites) {
  const lu = parSiteLu[s.nom] ?? 0;
  const attendu = s.totaux.total ?? 0;
  if (lu !== attendu) echecs.push(`site ${s.nom} : ${lu} lus, ${attendu} attendus`);
}

// 3. par jour — le total des jours d'un onglet doit retomber sur le total du site.
// C'est le controle INTERNE, celui qui vaut : il ne depend pas de la ligne 2, dont
// on vient de voir qu'elle est fausse sur deux onglets.
const totalParOnglet = {};
for (const r of rdvs) totalParOnglet[r.site] = (totalParOnglet[r.site] ?? 0) + 1;
for (const [code, jours] of Object.entries(totauxJourParSite)) {
  const sommeJours = JOURS_JUIN.reduce(
    (n, iso) => n + rdvs.filter((r) => r.site === code && r.jour === iso).length,
    0
  );
  if (sommeJours !== (totalParOnglet[code] ?? 0)) {
    echecs.push(
      `${code} : la somme des jours (${sommeJours}) ne retombe pas sur le total de ` +
        `l'onglet (${totalParOnglet[code] ?? 0}) — un RDV est hors des 5 colonnes de jour`
    );
  }
  void jours;
}

// 4. la ligne 2 du fichier, LA OU ELLE EST FIABLE. Ailleurs on la signale sans
// echouer : c'est le fichier qui a tort, pas la lecture.
const ligne2Fausse = [];
for (const [code, jours] of Object.entries(totauxJourParSite)) {
  for (let i = 0; i < jours.length; i++) {
    const iso = JOURS_JUIN[i];
    const lu = rdvs.filter((r) => r.site === code && r.jour === iso).length;
    if (lu === jours[i].rdv) continue;
    if (jours[i].fiable) {
      echecs.push(`${code} ${jours[i].jour} : ${lu} lus, ${jours[i].rdv} attendus`);
    } else {
      ligne2Fausse.push(`${code} ${jours[i].jour} : le fichier affiche ${jours[i].rdv}, la réalité est ${lu}`);
    }
  }
}

if (echecs.length > 0) {
  console.error(`\n${echecs.length} CONTROLE(S) CROISE(S) EN ECHEC :`);
  for (const e of echecs.slice(0, 30)) console.error(`  ${e}`);
  console.error("\nL'extraction ne retombe pas sur les totaux du fichier, ne pas l'utiliser.");
  process.exit(1);
}
console.log(
  `controles croises : OK — ${vendeurs.length} vendeurs, ${sites.length} sites, ` +
    `${Object.values(totauxJourParSite).flat().length} totaux du jour`
);

if (ligne2Fausse.length > 0) {
  console.warn(
    `\n${ligne2Fausse.length} TOTAUX DU JOUR FAUX DANS LE FICHIER SOURCE.\n` +
      "  Leur formule `COUNTA` porte un `#REF!` et vise des lignes supprimees : le\n" +
      '  chiffre affiche est une valeur figee, jamais recalculee. C\'est exactement la\n' +
      '  fragilite que cet outil remplace. Signale, non bloquant — la lecture est juste,\n' +
      '  elle se recoupe avec RESULTATS a l\'unite.\n'
  );
  for (const l of ligne2Fausse) console.warn(`  ${l}`);
  console.warn('');
}

const sortie = `// ============================================================================
// EXTRAIT DU CLASSEUR EXCEL par \`scripts/extraire-xlsx.mjs\`.
// NE PAS EDITER A LA MAIN : rejouer l'extraction.
//
// Source : tableau phoning reltel JUIN (2).xlsx, onglets RESULTATS et TABLES*.
//
// \`type\` est une donnee REELLE, lue dans la colonne TYPE de RESULTATS. Les
// champs \`ren\`, \`dac\` et \`rdv\` sont les CHIFFRES DE JUIN 2026 : ils ne servent
// qu'a la verification (critere de recette n.4), jamais a alimenter le modele.
// ============================================================================

export interface TypeVendeurSource {
  nom: string;
  site: string;
  type: 'VN' | 'VO';
  ren: number | null;
  dac: number | null;
  rdv: number;
}

export const TYPES_VENDEURS: TypeVendeurSource[] = ${JSON.stringify(vendeurs, null, 2)};

/// Marques de chaque site, lues dans l'en-tete du bloc RESULTATS. C'est la seule
/// deduction sure : le site ALPINE porte \`ALP\`, les autres \`REN\` et \`DAC\`.
export const MARQUES_PAR_SITE: { nom: string; codesMarque: string[] }[] = ${JSON.stringify(
  sites.map((s) => ({ nom: s.nom, codesMarque: s.codesMarque })),
  null,
  2
)};

/// Totaux attendus de juin 2026 — reference de verification.
export const ATTENDUS_SITES: { nom: string; vn: number; vo: number; total: number }[] = ${JSON.stringify(
  sites.map((s) => ({ nom: s.nom, vn: s.totaux.vn ?? 0, vo: s.totaux.vo ?? 0, total: s.totaux.total ?? 0 })),
  null,
  2
)};

export const ATTENDUS_TABLES = ${JSON.stringify(tables, null, 2)};

/// Totaux du jour, ligne 2 de CHAQUE onglet site — 19 sites et non plus 3. C'est
/// la ligne qu'un chef regarde pour savoir si la journee avance.
export const ATTENDUS_TOTAUX_JOUR: Record<
  string,
  { jour: string; rdv: number; fiable: boolean }[]
> = ${JSON.stringify(
  totauxJourParSite,
  null,
  2
)};

/// Les 5 jours de juin 2026, dans l'ordre des colonnes du fichier.
export const JOURS_JUIN = ${JSON.stringify(JOURS_JUIN)};
`;

const cible = join(racine, 'backend', 'prisma', 'donnees-xlsx.ts');
writeFileSync(cible, sortie, 'utf8');
console.log(`\nEcrit dans ${cible}`);

// ------------------------------------------------------------------ RDV de juin
//
// FICHIER A PART, et pour une raison precise : il ne sert QU'A LA VERIFICATION des
// fonctions d'agregat. Ni le seed ni l'API ne le lisent, et aucune de ces 1107
// lignes n'entre en base — c'est une decision explicite.
//
// Il porte des noms de clients reels. Il reste donc strictement local, comme le
// classeur dont il sort.
const sortieRdv = `// ============================================================================
// LES 1107 RDV DE JUIN 2026, extraits du classeur par \`scripts/extraire-xlsx.mjs\`.
// NE PAS EDITER A LA MAIN : rejouer l'extraction.
//
// A QUOI CE FICHIER SERT, ET A QUOI IL NE SERT PAS
//
// Il alimente UNIQUEMENT \`src/utils/agregats.verif.ts\`. Ni le seed ni l'API ne le
// lisent, et aucune de ces lignes n'entre en base : c'est une decision explicite,
// la base ne recoit aucune donnee de juin.
//
// Sa raison d'etre est le critere de recette n.4 — << les totaux de l'outil et ceux
// du fichier Excel concordent a l'unite >>. Le produit existe parce que les agregats
// de l'Excel etaient faux ; livrer les notres sans pouvoir demontrer qu'ils sont
// justes reproduirait le defaut qu'on remplace. Ces 1107 lignes se recoupent avec
// quatre series de totaux independantes du fichier, verifiees a l'extraction.
//
// Le \`client\` est le TEXTE LIBRE de la cellule, tel quel : « RAGOT 208 » porte le
// vehicule, « CHOMEILLE* » une marque de suivi. Ce sont des noms reels — ce fichier
// ne quitte pas le poste.
// ============================================================================

export interface RdvSource {
  /// Code du site, tel que l'onglet le nomme.
  site: string;
  nomVendeur: string;
  /// Libelle de la section : une marque (\`RENAULT\`, \`DACIA\`, \`ALPINE\`) ou \`VO\`.
  marque: string;
  /// Jour ISO. Le fichier n'ecrit que « JEUDI 11 JUIN » : la date vient de la
  /// POSITION de la colonne, avec controle du numero lu.
  jour: string;
  /// Code du creneau, aligne sur \`campagne_creneau.code\`.
  creneau: string;
  client: string;
}

export const RDV_JUIN: RdvSource[] = ${JSON.stringify(
  rdvs.map((r) => ({
    site: r.site,
    nomVendeur: r.vendeur,
    marque: r.marque,
    jour: r.jour,
    creneau: r.creneau,
    client: r.client,
  })),
  null,
  1
)};
`;

const cibleRdv = join(racine, 'backend', 'prisma', 'rdv-juin-source.ts');
writeFileSync(cibleRdv, sortieRdv, 'utf8');
console.log(`Ecrit dans ${cibleRdv} — ${rdvs.length} RDV`);
console.log('\nMarques par site :');
for (const s of sites) console.log(`  ${s.nom.padEnd(20)} ${s.codesMarque.join(' + ')}`);
console.log('\nTotaux de table :');
for (const t of tables) console.log(`  ${t.onglet.padEnd(14)} ${t.libelle.padEnd(10)} ${t.chef.padEnd(20)} ${t.total}`);
