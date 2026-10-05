// ============================================================================
// test:suivi — les indicateurs du Suivi des RDV contre le fichier de juin.
//
// Meme principe que `test:agregats` : les fonctions PURES de `utils/suivi.ts`
// recoivent EN MEMOIRE les 342 RDV du fichier de suivi que l'utilisateur tenait a
// la main (`suivi-juin-source.ts`, extrait par `scripts/extraire-suivi.mjs`), et
// doivent rendre ses chiffres. Rien n'entre en base.
//
// Le fichier a ses defauts, et ce test les NOMME au lieu de s'y plier :
//   - un RDV de Clermont n'a pas de source : 342 planifies, mais 298 + 43 = 341
//     par source. On le range en phoning (la valeur par defaut d'un RDV en base),
//     et le test le dit ;
//   - le fichier deduit une commande par soustraction ; ici on la LIT. Les deux
//     donnent 119 sur juin, parce qu'aucune faute de frappe ne s'y est glissee.
// ============================================================================
import { SUIVI_JUIN } from './suivi-juin-source';
import {
  classementCommandes,
  estSeche,
  indicateurs,
  indicateursPar,
  type LigneSuivi,
} from '../src/utils/suivi';
import type { IssueSuivi } from '../src/auth/roles';

const resultats: { nom: string; ok: boolean; detail: string }[] = [];
const verifier = (nom: string, ok: boolean, detail: string) => resultats.push({ nom, ok, detail });

/// Le texte d'une case resultat du fichier, traduit dans le modele de GRID.
/// Tout ce qui n'est ni offre, ni annule, ni clos, ni vide est une COMMANDE dont
/// le libelle porte les avantages (« DIAC+STOCK+CS », « SÈCHE »…).
function traduire(resultat: string): Pick<LigneSuivi, 'issue' | 'diac' | 'stock' | 'cs'> {
  const r = resultat.toUpperCase();
  if (r === '') return { issue: null, diac: false, stock: false, cs: false };
  if (r === 'OFFRE EN COURS') return { issue: 'offre_en_cours', diac: false, stock: false, cs: false };
  if (r === 'RDV ANNULÉ') return { issue: 'annule', diac: false, stock: false, cs: false };
  if (r === 'CLOS SANS SUITE') return { issue: 'clos_sans_suite', diac: false, stock: false, cs: false };
  const issue: IssueSuivi = 'commande';
  return { issue, diac: r.includes('DIAC'), stock: r.includes('STOCK'), cs: /\bCS\b/.test(r) };
}

const lignes: LigneSuivi[] = SUIVI_JUIN.map((l) => ({
  vendeurId: l.vendeur,
  vendeurNom: l.vendeur,
  siteId: l.site,
  siteLibelle: l.site,
  source: l.source === 'Showroom' ? 'showroom' : 'relance',
  ...traduire(l.resultat),
}));

// --------------------------------------------------------- indicateurs cles
// Onglet DASHBOARD, ligne 5 : 342 · 236 · 106 · 119 · 47 · 33 · 50,4 %.
const g = indicateurs(lignes);
verifier('planifies', g.planifies === 342, `${g.planifies}, attendu 342`);
verifier('traites', g.traites === 236, `${g.traites}, attendu 236`);
verifier('a traiter', g.aTraiter === 106, `${g.aTraiter}, attendu 106`);
verifier('commandes (lues, et non deduites)', g.commandes === 119, `${g.commandes}, attendu 119`);
verifier('offres en cours', g.offres === 47, `${g.offres}, attendu 47`);
verifier('RDV annules', g.annules === 33, `${g.annules}, attendu 33`);
verifier('clos sans suite', g.clos === 37, `${g.clos}, attendu 37`);
verifier(
  'taux de transformation = commandes / traites',
  g.tauxTransformation !== null && Math.round(g.tauxTransformation * 1000) === 504,
  `${((g.tauxTransformation ?? 0) * 100).toFixed(1)} %, attendu 50,4 %`
);

// --------------------------------------------------------- composition des commandes
// Onglet DASHBOARD, lignes 23 a 26 : DIAC 92, STOCK 71, CS 92, SECHE 14.
verifier('commandes avec DIAC', g.avecDiac === 92, `${g.avecDiac}, attendu 92`);
verifier('commandes avec STOCK', g.avecStock === 71, `${g.avecStock}, attendu 71`);
verifier('commandes avec CS', g.avecCs === 92, `${g.avecCs}, attendu 92`);
verifier('commandes seches (deduites : aucun avantage)', g.seches === 14, `${g.seches}, attendu 14`);
verifier(
  'une commande STOCK seule n est PAS seche (D8)',
  !estSeche({ issue: 'commande', diac: false, stock: true, cs: false }) &&
    estSeche({ issue: 'commande', diac: false, stock: false, cs: false }) &&
    !estSeche({ issue: 'offre_en_cours', diac: false, stock: false, cs: false }),
  'STOCK -> non seche ; rien -> seche ; une offre n est jamais seche'
);

// --------------------------------------------------------- par source
// Onglet DASHBOARD, lignes 9-10 : Relance 298 / 236-… ; Showroom 43.
const parSource = indicateursPar('source', lignes);
const showroom = parSource.find((s) => s.cle === 'showroom')!;
const relance = parSource.find((s) => s.cle === 'relance')!;
verifier(
  'par source : trafic naturel',
  showroom.planifies === 43,
  `${showroom.planifies} planifies, attendu 43`
);
verifier(
  'par source : phoning (298 + le RDV sans source du fichier)',
  relance.planifies === 299,
  `${relance.planifies} planifies — le fichier en annonce 298, une case source etant vide`
);

// --------------------------------------------------------- par site
// Onglet DASHBOARD, lignes 30-33.
const attendusSites: Record<string, [number, number, number]> = {
  'CLERMONT-FERRAND': [209, 165, 93],
  MOZAC: [86, 34, 13],
  USSEL: [19, 9, 3],
  MASSAGETTES: [28, 28, 10],
};
for (const s of indicateursPar('site', lignes)) {
  const [p, t, c] = attendusSites[s.cle]!;
  verifier(
    `par site : ${s.cle}`,
    s.planifies === p && s.traites === t && s.commandes === c,
    `${s.planifies}/${s.traites}/${s.commandes}, attendu ${p}/${t}/${c}`
  );
}

// --------------------------------------------------------- classement
// Onglet DASHBOARD, ligne 38 : Oceane Espinasse premiere avec 15 commandes.
const classement = classementCommandes(lignes);
verifier(
  'classement : premiere place',
  classement[0]!.libelle === 'OCEANE ESPINASSE' && classement[0]!.commandes === 15,
  `${classement[0]!.libelle} (${classement[0]!.commandes})`
);
// Bellaigues et Biasutti ont 14 commandes chacun. Le fichier les departageait par
// leur position dans l'onglet ; ici, le taux : 14/22 = 63,6 % devant 14/23 = 60,9 %.
const deuxieme = classement[1]!;
verifier(
  'classement : ex aequo departages par le taux, pas par la position',
  deuxieme.libelle === 'QUENTIN BELLAIGUES' && classement[2]!.libelle === 'JULIEN BIASUTTI',
  `2e ${deuxieme.libelle}, 3e ${classement[2]!.libelle}`
);
verifier(
  'classement : tous les vendeurs du fichier, une fois chacun',
  classement.length === 20 && new Set(classement.map((r) => r.cle)).size === 20,
  `${classement.length} vendeurs`
);
verifier(
  'aucun RDV traite : taux absent, pas 0 %',
  indicateurs([]).tauxTransformation === null,
  'null'
);

// NO SHOW (05/10/2026) : une issue a part entiere — traitee, ni commande ni annule.
{
  const base = { vendeurId: 'v', vendeurNom: 'V', siteId: 's', siteLibelle: 'S', source: 'relance' as const, diac: false, stock: false, cs: false };
  const n = indicateurs([
    { ...base, issue: 'no_show' },
    { ...base, issue: 'annule' },
    { ...base, issue: 'commande' },
    { ...base, issue: null },
  ]);
  verifier(
    'no show : compte a part, traite, distinct de annule',
    n.noShows === 1 && n.annules === 1 && n.traites === 3 && n.commandes === 1 && n.aTraiter === 1,
    `noShows ${n.noShows} · annules ${n.annules} · traites ${n.traites}`
  );
}

// ---------------------------------------------------------------- restitution
const largeur = Math.max(...resultats.map((r) => r.nom.length));
for (const r of resultats) console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
const echecs = resultats.filter((r) => !r.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} verifications du suivi.`);
if (echecs > 0) process.exit(1);
