import {
  classer,
  comparer,
  totauxPar,
  totauxParJour,
  SANS_MARQUE,
  SANS_TABLE,
  type LigneRdv,
  type LigneVendeur,
  type Totaux,
} from '../src/utils/agregats';
import {
  ATTENDUS_SITES,
  ATTENDUS_TABLES,
  ATTENDUS_TOTAUX_JOUR,
  JOURS_JUIN,
  TYPES_VENDEURS,
} from './donnees-xlsx';
import { RDV_JUIN } from './rdv-juin-source';
import { AFFECTATIONS_JUIN, SITES, TABLES_JUIN, VENDEURS } from './donnees-source';

// ============================================================================
// VERIFICATION DES AGREGATS CONTRE LE FICHIER EXCEL REEL
//
// C'EST LE CRITERE DE RECETTE N.4 : << les totaux de l'outil et ceux du fichier
// Excel concordent a l'unite >>. Le seul controle qui prouve que le modele est
// juste, et le seul qui distingue cet outil de celui qu'il remplace.
//
// Les 1107 RDV de juin 2026 sont donnes aux fonctions d'agregat EN MEMOIRE. Rien
// n'est ecrit en base : c'est une decision explicite, la base ne recoit aucune
// donnee de juin. Les fonctions etant pures, aucun serveur ni aucune base n'est
// necessaire ici.
//
// La force du controle vient de son RECOUPEMENT. Le fichier porte les memes
// totaux a quatre endroits independants : par vendeur et par site dans RESULTATS,
// par table dans TABLES*, et par jour en ligne 2 des onglets site. Retomber sur
// les quatre a partir des cellules recomptees ne peut pas etre un hasard.
//
// DEUX ONGLETS SONT EXCLUS DU CONTROLE PAR JOUR — GAILL et CARM. Leur formule
// `COUNTA` de la ligne 2 porte des `#REF!` et vise des lignes supprimees ; le
// nombre affiche est une valeur figee, jamais recalculee, et fausse de 10 et 25
// RDV. Ce n'est pas notre lecture qui est en cause : elle se recoupe a l'unite
// avec RESULTATS. C'est exactement la fragilite que cet outil remplace, et le
// script d'extraction la signale a chaque passage.
//
// Usage : npm --prefix backend run test:agregats
//
// Ce fichier vit dans `prisma/` et non dans `src/utils/` a cote de la fonction
// qu'il verifie : `rootDir` du build est `src`, et les donnees de reference
// (`donnees-xlsx.ts`, `rdv-juin-source.ts`) vivent dans `prisma/`. Un import
// depuis `src` vers `prisma` casse `tsc --build`. Meme emplacement, meme raison
// que `tester-garde-fous.ts`.
// ============================================================================

const resultats: { nom: string; ok: boolean; detail: string }[] = [];
const verifier = (nom: string, condition: boolean, detail: string) =>
  resultats.push({ nom, ok: condition, detail });

/// Meme normalisation que l'import des marques : insensible a l'ordre des mots,
/// aux accents et aux traits d'union. Les 99 vendeurs donnent 99 clés distinctes.
const cleNom = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[-'’]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

const cleLibelle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[-\s]+/g, ' ')
    .trim();

// ---------------------------------------------------- construction du jeu de juin

const siteParCode = new Map(SITES.map((s) => [s.code, s]));
const typeParVendeur = new Map(TYPES_VENDEURS.map((v) => [cleNom(v.nom), v.type]));

/// Table de chaque vendeur, via `AFFECTATIONS_JUIN`. Clé de table :
/// `plaque/libelle`, par exemple `CENTRE/Table 1` — le libelle seul ne suffit pas,
/// CENTRE et SUD ont tous deux une « Table 1 ».
const libelleTableSource = new Map(TABLES_JUIN.map((t) => [t.libelleSource, t]));
const tableParVendeur = new Map<string, { cle: string; libelle: string }>();
for (const a of AFFECTATIONS_JUIN) {
  const t = libelleTableSource.get(a.tableSource);
  if (!t) continue;
  tableParVendeur.set(cleNom(a.vendeur), {
    cle: `${t.plaque}/${t.libelle}`,
    libelle: `${t.libelle} — ${t.plaque}`,
  });
}

const vendeurs: LigneVendeur[] = VENDEURS.map((v) => {
  const site = siteParCode.get(v.site);
  const table = tableParVendeur.get(cleNom(v.nom));
  return {
    id: cleNom(v.nom),
    nom: v.nom,
    siteId: v.site,
    siteLibelle: site?.libelle ?? v.site,
    plaqueId: site?.plaque ?? '?',
    plaqueLibelle: site?.plaque ?? '?',
    tableId: table?.cle ?? null,
    tableLibelle: table?.libelle ?? null,
    typeVehicule: typeParVendeur.get(cleNom(v.nom)) ?? 'VN',
  };
});

const vendeurParCle = new Map(vendeurs.map((v) => [v.id, v]));

/// Les RDV. Le `typeVehicule` vient du VENDEUR et non du libelle de section —
/// c'est la regle du modele, et le trigger `rdv_type_coherent` l'impose en base.
/// Le libelle sert en revanche a controler la coherence, juste apres.
const incoherences: string[] = [];
const rdvs: LigneRdv[] = [];
for (const r of RDV_JUIN) {
  const v = vendeurParCle.get(cleNom(r.nomVendeur));
  if (!v) {
    incoherences.push(`vendeur inconnu : ${r.nomVendeur} (${r.site})`);
    continue;
  }
  const estVo = v.typeVehicule === 'VO';
  if (estVo !== (r.marque === 'VO')) {
    incoherences.push(
      `${r.nomVendeur} : metier ${v.typeVehicule} mais section « ${r.marque} »`
    );
  }
  rdvs.push({
    vendeurId: v.id,
    typeVehicule: v.typeVehicule,
    marqueId: estVo ? null : r.marque,
    jour: r.jour,
    creneauCode: r.creneau,
  });
}

verifier(
  'le jeu de juin se reconstruit sans incoherence',
  incoherences.length === 0 && rdvs.length === 1107 && vendeurs.length === 99,
  incoherences.length > 0
    ? `${incoherences.length} incoherence(s) : ${incoherences.slice(0, 2).join(' ; ')}`
    : `${rdvs.length} RDV, ${vendeurs.length} vendeurs`
);

// ---------------------------------------------------------------- le groupe
const groupe = totauxPar('groupe', rdvs, vendeurs)[0]!;
verifier(
  'total du groupe',
  groupe.total === 1107,
  `${groupe.total} (attendu 1107)`
);
verifier(
  'ventilation VN / VO du groupe',
  groupe.vn === 903 && groupe.vo === 204 && groupe.vn + groupe.vo === groupe.total,
  `VN ${groupe.vn} / VO ${groupe.vo}`
);
verifier(
  'effectif du groupe, calcule et non saisi',
  groupe.effectif === 99 && groupe.moyenne === Math.round((1107 / 99) * 100) / 100,
  `${groupe.effectif} vendeurs, moyenne ${groupe.moyenne}`
);

// ---------------------------------------------------------------- les 19 sites
const parSite = totauxPar('site', rdvs, vendeurs);
const parSiteCle = new Map(parSite.map((t) => [cleLibelle(t.libelle), t]));

const ecartsSites: string[] = [];
for (const attendu of ATTENDUS_SITES) {
  const obtenu = parSiteCle.get(cleLibelle(attendu.nom));
  if (!obtenu) {
    ecartsSites.push(`${attendu.nom} : absent du resultat`);
    continue;
  }
  if (obtenu.total !== attendu.total || obtenu.vn !== attendu.vn || obtenu.vo !== attendu.vo) {
    ecartsSites.push(
      `${attendu.nom} : ${obtenu.total}/${obtenu.vn}/${obtenu.vo} au lieu de ` +
        `${attendu.total}/${attendu.vn}/${attendu.vo}`
    );
  }
}
verifier(
  `les ${ATTENDUS_SITES.length} sites, total et ventilation VN / VO`,
  ecartsSites.length === 0 && parSite.length === 19,
  ecartsSites.length > 0 ? ecartsSites.slice(0, 3).join(' ; ') : `${parSite.length} sites conformes`
);

const clermont = parSiteCle.get(cleLibelle('CLERMONT-FERRAND'))!;
verifier(
  'CLERMONT : le chiffre de reference du plan',
  clermont.total === 218 && clermont.vn === 171 && clermont.vo === 47,
  `${clermont.total} = ${clermont.vn} VN + ${clermont.vo} VO (attendu 218 = 171 + 47)`
);

// ---------------------------------------------------------------- les plaques
const parPlaque = totauxPar('plaque', rdvs, vendeurs);
const centre = parPlaque.find((t) => t.cle === 'CENTRE')!;
verifier(
  'plaque CENTRE',
  centre.total === 407,
  `${centre.total} (attendu 407)`
);
verifier(
  'la somme des plaques retombe sur le groupe',
  parPlaque.reduce((n, t) => n + t.total, 0) === 1107 && parPlaque.length === 4,
  `${parPlaque.length} plaques, ${parPlaque.reduce((n, t) => n + t.total, 0)} RDV`
);

// ---------------------------------------------------------------- par vendeur
const parVendeur = totauxPar('vendeur', rdvs, vendeurs);
const parpinelli = parVendeur.find((t) => t.cle === cleNom('VALENTIN PARPINELLI'))!;
verifier(
  'PARPINELLI : ventilation par marque',
  parpinelli.parMarque.RENAULT === 16 && (parpinelli.parMarque.DACIA ?? 0) === 0,
  `Renault ${parpinelli.parMarque.RENAULT ?? 0} / Dacia ${parpinelli.parMarque.DACIA ?? 0} (attendu 16 / 0)`
);

const ecartsVendeurs = TYPES_VENDEURS.filter((v) => {
  const t = parVendeur.find((x) => x.cle === cleNom(v.nom));
  return !t || t.total !== v.rdv;
});
verifier(
  'les 99 vendeurs, un par un',
  ecartsVendeurs.length === 0 && parVendeur.length === 99,
  ecartsVendeurs.length > 0
    ? `${ecartsVendeurs.length} ecart(s) : ${ecartsVendeurs.slice(0, 3).map((v) => v.nom).join(', ')}`
    : `${parVendeur.length} vendeurs conformes`
);

/// Un vendeur VO n'a AUCUNE ventilation par marque : ses RDV tombent sous
/// `SANS_MARQUE`. C'est la regle lue dans le fichier, ou les colonnes REN et DAC
/// sont vides pour les VO.
const unVo = parVendeur.find(
  (t) => vendeurParCle.get(t.cle)?.typeVehicule === 'VO' && t.total > 0
)!;
verifier(
  'un vendeur VO ne porte aucune marque',
  unVo.parMarque[SANS_MARQUE] === unVo.total && Object.keys(unVo.parMarque).length === 1,
  `${unVo.libelle} : ${JSON.stringify(unVo.parMarque)}`
);

// ---------------------------------------------------------------- les 8 tables
const parTable = totauxPar('table', rdvs, vendeurs);
const parTableCle = new Map(parTable.map((t) => [t.cle, t]));
const chefVersTable = new Map(TABLES_JUIN.map((t) => [cleNom(t.chef), `${t.plaque}/${t.libelle}`]));

const ecartsTables: string[] = [];
for (const attendu of ATTENDUS_TABLES) {
  const cle = chefVersTable.get(cleNom(attendu.chef));
  const obtenu = cle ? parTableCle.get(cle) : undefined;
  if (!obtenu) {
    ecartsTables.push(`${attendu.onglet} ${attendu.libelle} (${attendu.chef}) : introuvable`);
    continue;
  }
  if (obtenu.total !== attendu.total) {
    ecartsTables.push(`${obtenu.libelle} : ${obtenu.total} au lieu de ${attendu.total}`);
  }
}
verifier(
  'les 8 tables de juin — le controle qui valide AUSSI les affectations',
  ecartsTables.length === 0,
  ecartsTables.length > 0
    ? ecartsTables.slice(0, 4).join(' ; ')
    : ATTENDUS_TABLES.map((t) => t.total).join(' / ')
);

/// Deux plaques sur quatre n'avaient aucune table en juin : leurs vendeurs
/// tombent dans le panier `SANS_TABLE`. Ce n'est pas un cas degrade, c'est le
/// mode normal — les tables sont un supplement.
const reserve = parTableCle.get(SANS_TABLE);
verifier(
  'les vendeurs sans table forment un panier a part, pas un trou',
  !!reserve && reserve.total + ATTENDUS_TABLES.reduce((n, t) => n + t.total, 0) === 1107,
  reserve
    ? `${reserve.effectif} vendeurs non affectes, ${reserve.total} RDV`
    : 'panier absent'
);

// ---------------------------------------------------------------- par jour
const joursCampagne = [...JOURS_JUIN];
const parJourGroupe = totauxParJour(rdvs, joursCampagne, vendeurs);
verifier(
  'la somme des jours retombe sur le groupe',
  parJourGroupe.reduce((n, j) => n + j.total, 0) === 1107 && parJourGroupe.length === 5,
  parJourGroupe.map((j) => j.total).join(' / ')
);

// Par site, la ligne 2 du fichier — la ou sa formule n'est pas cassee.
const ecartsJour: string[] = [];
let comparaisonsJour = 0;
let ignoresJour = 0;
for (const [code, jours] of Object.entries(ATTENDUS_TOTAUX_JOUR)) {
  const duSite = vendeurs.filter((v) => v.siteId === code);
  if (duSite.length === 0) continue;
  const obtenus = totauxParJour(rdvs, joursCampagne, duSite);
  for (let i = 0; i < jours.length; i++) {
    if (!jours[i]!.fiable) {
      ignoresJour++;
      continue;
    }
    comparaisonsJour++;
    if (obtenus[i]!.total !== jours[i]!.rdv) {
      ecartsJour.push(`${code} ${jours[i]!.jour} : ${obtenus[i]!.total} au lieu de ${jours[i]!.rdv}`);
    }
  }
}
verifier(
  `totaux du jour par site (${comparaisonsJour} comparaisons, ${ignoresJour} ignorees car le fichier est faux)`,
  ecartsJour.length === 0 && comparaisonsJour >= 80,
  ecartsJour.length > 0 ? ecartsJour.slice(0, 4).join(' ; ') : `${comparaisonsJour} conformes`
);

const clf = totauxParJour(rdvs, joursCampagne, vendeurs.filter((v) => v.siteId === 'CLF'));
verifier(
  'totaux du jour de CLERMONT : le chiffre de reference du plan',
  clf.map((j) => j.total).join('/') === '52/49/42/38/37',
  `${clf.map((j) => j.total).join(' / ')} (attendu 52 / 49 / 42 / 38 / 37)`
);

// ---------------------------------------------------------------- classements
const classementGlobal = classer(parSite, 'global');
verifier(
  'classement des concessions, global',
  classementGlobal[0]!.libelle === 'Clermont-Ferrand' && classementGlobal[0]!.rang === 1,
  classementGlobal.slice(0, 4).map((r) => `${r.rang}.${r.libelle} ${r.total}`).join('  ')
);
verifier(
  'classement VN et classement VO donnent des tetes differentes du global',
  classer(parSite, 'vn').length === 19 && classer(parSite, 'vo').length === 19,
  `VN : ${classer(parSite, 'vn')[0]!.libelle} ${classer(parSite, 'vn')[0]!.vn} · ` +
    `VO : ${classer(parSite, 'vo')[0]!.libelle} ${classer(parSite, 'vo')[0]!.vo}`
);

// ---------------------------------------------------- logique pure, cas limites

/// Le defaut de `schema.sql` : les classements partaient des RDV, donc un vendeur
/// a 0 RDV disparaissait sans erreur.
const jeuAvecZero: LigneVendeur[] = [
  { id: 'a', nom: 'AVEC RDV', siteId: 's1', siteLibelle: 'Site 1', plaqueId: 'p', plaqueLibelle: 'P', tableId: null, tableLibelle: null, typeVehicule: 'VN' },
  { id: 'b', nom: 'SANS AUCUN RDV', siteId: 's1', siteLibelle: 'Site 1', plaqueId: 'p', plaqueLibelle: 'P', tableId: null, tableLibelle: null, typeVehicule: 'VN' },
];
const totauxZero = totauxPar('vendeur', [{ vendeurId: 'a', typeVehicule: 'VN', marqueId: 'R', jour: 'j', creneauCode: 'c' }], jeuAvecZero);
verifier(
  'un vendeur a 0 RDV figure au classement',
  totauxZero.length === 2 && classer(totauxZero).some((r) => r.cle === 'b' && r.total === 0),
  `${totauxZero.length} entrees, dont ${totauxZero.filter((t) => t.total === 0).length} a zero`
);

/// Un site sans aucun vendeur est un cas prevu — l'onglet MDP du fichier source.
const siteVide = totauxPar('site', [], []);
verifier(
  'aucun vendeur : aucun panier, et surtout aucune division par zero',
  siteVide.length === 0,
  `${siteVide.length} panier(s)`
);

/// Le departage doit etre STABLE : deux exécutions sur la meme entree donnent le
/// meme ordre, et l'ordre d'entree ne l'influence pas. C'est ce qui rend un
/// classement contestable.
const exAequo: Totaux[] = [
  { cle: 'z', libelle: 'ZEBRE', total: 10, vn: 5, vo: 5, parMarque: {}, effectif: 1, moyenne: 10 },
  { cle: 'a', libelle: 'ANTILOPE', total: 10, vn: 5, vo: 5, parMarque: {}, effectif: 1, moyenne: 10 },
  { cle: 'm', libelle: 'MOUETTE', total: 10, vn: 8, vo: 2, parMarque: {}, effectif: 1, moyenne: 10 },
];
const ordre1 = classer(exAequo).map((r) => r.cle).join('');
const ordre2 = classer([...exAequo].reverse()).map((r) => r.cle).join('');
verifier(
  'departage des ex aequo : stable, et independant de l ordre d entree',
  ordre1 === ordre2 && ordre1 === 'maz',
  `${ordre1} puis ${ordre2} (attendu maz : VN d abord, puis le libelle)`
);
verifier(
  'les ex aequo sont SIGNALES, pas presentes comme une hierarchie',
  classer(exAequo).every((r) => r.exAequo),
  `${classer(exAequo).filter((r) => r.exAequo).length}/3 marques ex aequo`
);

/// L'effectif ne doit pas dependre des RDV : c'est le bug `RANK!AG`.
const memesRdv: LigneRdv[] = [{ vendeurId: 'a', typeVehicule: 'VN', marqueId: 'R', jour: 'j', creneauCode: 'c' }];
const avecDeux = totauxPar('site', memesRdv, jeuAvecZero)[0]!;
const avecUn = totauxPar('site', memesRdv, [jeuAvecZero[0]!])[0]!;
verifier(
  'la moyenne suit l effectif PRESENT, pas le nombre de RDV',
  avecDeux.effectif === 2 && avecDeux.moyenne === 0.5 && avecUn.effectif === 1 && avecUn.moyenne === 1,
  `2 vendeurs -> ${avecDeux.moyenne} · 1 vendeur -> ${avecUn.moyenne}`
);

/// Un RDV dont le vendeur est absent de la liste est ignore, jamais range dans un
/// panier « divers » qui donnerait un total juste et une ventilation fausse.
const orphelin = totauxPar('site', [...memesRdv, { vendeurId: 'inconnu', typeVehicule: 'VN', marqueId: 'R', jour: 'j', creneauCode: 'c' }], jeuAvecZero);
verifier(
  'un RDV hors perimetre est ignore, pas reclasse',
  orphelin.length === 1 && orphelin[0]!.total === 1,
  `${orphelin.length} panier(s), total ${orphelin[0]?.total}`
);

/// Un jour hors de la campagne ne se fond pas dans un total.
const horsJour = totauxParJour(
  [{ vendeurId: 'a', typeVehicule: 'VN', marqueId: 'R', jour: '2099-01-01', creneauCode: 'c' }],
  ['2026-09-10'],
  jeuAvecZero
);
verifier(
  'un RDV hors des jours de la campagne ne gonfle aucun jour',
  horsJour.length === 1 && horsJour[0]!.total === 0,
  `${horsJour[0]?.jour} -> ${horsJour[0]?.total}`
);

// ---------------------------------------------------------------- comparaison
const ecarts = comparer(
  [
    { cle: 'x', libelle: 'X', total: 12, vn: 12, vo: 0, parMarque: {}, effectif: 1, moyenne: 12 },
    { cle: 'neuf', libelle: 'NEUF', total: 5, vn: 5, vo: 0, parMarque: {}, effectif: 1, moyenne: 5 },
  ],
  [
    { cle: 'x', libelle: 'X', total: 10, vn: 10, vo: 0, parMarque: {}, effectif: 1, moyenne: 10 },
    { cle: 'ferme', libelle: 'FERME', total: 8, vn: 8, vo: 0, parMarque: {}, effectif: 1, moyenne: 8 },
  ]
);
const x = ecarts.find((e) => e.cle === 'x')!;
const neuf = ecarts.find((e) => e.cle === 'neuf')!;
const ferme = ecarts.find((e) => e.cle === 'ferme')!;
verifier(
  'comparaison a une campagne anterieure : ecart et variation',
  x.ecart === 2 && x.variation === 20,
  `X : ${x.totalAnterieur} -> ${x.total}, ecart ${x.ecart}, ${x.variation} %`
);
verifier(
  'comparaison : ce qui apparait ET ce qui disparait figurent tous les deux',
  neuf.totalAnterieur === 0 && neuf.variation === null && ferme.total === 0 && ferme.variation === -100,
  `apparu : variation ${neuf.variation} (pas d infini) · disparu : ${ferme.ecart}`
);

// ---------------------------------------------------------------- restitution
const largeur = Math.max(...resultats.map((r) => r.nom.length));
console.log('');
for (const r of resultats) {
  console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
}
const echecs = resultats.filter((r) => !r.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} verifications des agregats.`);
if (echecs > 0) process.exit(1);
