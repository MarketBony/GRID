// ============================================================================
// test:vp — les calculs de GRID/VP (`utils/vp.ts`), en memoire.
//
// Il n'existe pas encore de VP reelle a laquelle se comparer (la premiere est
// Massagettes, 26-28/10/2026). Le monde est donc FABRIQUE, assez petit pour que
// chaque nombre attendu se recompte a la main — et chaque attendu dit d'ou il
// vient. Rien n'entre en base.
//
//   phoning  lundi 26/10 et mardi 27/10, creneaux 9h-10h, 10h-11h, 14h-15h
//            -> plage 9h-15h, 6 h par jour, 12 h de phoning
//   vendeurs A (VN, obj 10), B (VN, obj 8), C (VO, ABSENT, aucun RDV),
//            D (VN, ABSENT mais il recoit un RDV)
//   RDV      r1 A 9h   pris J1 10h30  commande DIAC, sorti
//            r2 A 10h  pris J1 14h00  no show
//            r3 B 9h   pris J2 9h30   arrive
//            r4 B 14h  pris J2 11h00  offre (qualifie dans le Suivi, sans tablette)
//            r5 D 14h  pris J2 12h00  PRIS PAR A, reaffecte a D ; commande
//            r6 B 10h  visiteur sans RDV (trafic naturel) ; commande
// ============================================================================
import {
  bilanParVendeur,
  bilanVp,
  bornesCreneau,
  classementPhoning,
  comparerVp,
  courbeCumul,
  dureePhoning,
  etapeAccueil,
  fenetrePhoning,
  heuresCreuses,
  heuresEcoulees,
  plageDesCreneaux,
  preneur,
  projection,
  remplissage,
  type CreneauVp,
  type RdvVp,
  type VendeurVp,
} from '../src/utils/vp';

const resultats: { nom: string; ok: boolean; detail: string }[] = [];
const verifier = (nom: string, ok: boolean, detail: string) => resultats.push({ nom, ok, detail });
const egal = (nom: string, obtenu: unknown, attendu: unknown) => {
  const o = JSON.stringify(obtenu);
  const a = JSON.stringify(attendu);
  verifier(nom, o === a, o === a ? o : `${o}, attendu ${a}`);
};
const proche = (nom: string, obtenu: number | null, attendu: number) =>
  verifier(nom, obtenu !== null && Math.abs(obtenu - attendu) < 1e-9, `${obtenu}, attendu ${attendu}`);

// Heure LOCALE du poste, comme dans le navigateur.
const local = (jourHeure: string) => new Date(jourHeure).toISOString();

const CRENEAUX: CreneauVp[] = [
  { code: '09:00-10:00', libelle: '9h-10h', ordre: 1 },
  { code: '10:00-11:00', libelle: '10h-11h', ordre: 2 },
  { code: '14:00-15:00', libelle: '14h-15h', ordre: 3 },
];

const vendeur = (id: string, type: 'VN' | 'VO', objectif: number | null, mobilise: boolean | null): VendeurVp => ({
  id,
  nom: `VENDEUR ${id}`,
  siteId: 's1',
  siteLibelle: 'Massagettes',
  plaqueId: 'p1',
  plaqueLibelle: 'CENTRE',
  tableId: null,
  tableLibelle: null,
  typeVehicule: type,
  mobilise,
  objectifRdv: objectif,
});
const VENDEURS = [vendeur('A', 'VN', 10, null), vendeur('B', 'VN', 8, true), vendeur('C', 'VO', 8, false), vendeur('D', 'VN', null, false)];

const rdv = (
  id: string,
  vendeurId: string,
  creneau: string,
  creeLe: string,
  suite: Partial<RdvVp> = {}
): RdvVp => ({
  id,
  vendeurId,
  prisParVendeurId: null,
  jour: '2026-10-28',
  creneauCode: creneau,
  typeVehicule: 'VN',
  marqueId: 'renault',
  source: 'relance',
  creeLe: local(creeLe),
  issue: null,
  diac: false,
  stock: false,
  cs: false,
  arriveLe: null,
  avecVendeurLe: null,
  sortiLe: null,
  ...suite,
});
const J3 = '2026-10-28T10:00:00';
const RDVS: RdvVp[] = [
  rdv('r1', 'A', '09:00-10:00', '2026-10-26T10:30:00', { issue: 'commande', diac: true, arriveLe: local('2026-10-28T09:02:00'), avecVendeurLe: local('2026-10-28T09:05:00'), sortiLe: local('2026-10-28T09:50:00') }),
  rdv('r2', 'A', '10:00-11:00', '2026-10-26T14:00:00', { issue: 'no_show' }),
  rdv('r3', 'B', '09:00-10:00', '2026-10-27T09:30:00', { arriveLe: local('2026-10-28T09:10:00') }),
  rdv('r4', 'B', '14:00-15:00', '2026-10-27T11:00:00', { issue: 'offre_en_cours' }),
  rdv('r5', 'D', '14:00-15:00', '2026-10-27T12:00:00', { prisParVendeurId: 'A', issue: 'commande' }),
  rdv('r6', 'B', '10:00-11:00', J3, { source: 'showroom', issue: 'commande' }),
];

// --------------------------------------------------------------- les heures
egal('creneau  08:00-09:00 -> 8 h a 9 h', bornesCreneau('08:00-09:00'), { debut: 8, fin: 9 });
egal('creneau  un code hors format rend null, sans rien supposer', bornesCreneau('matin'), null);
egal('creneau  la plage va du premier debut a la derniere fin', plageDesCreneaux(CRENEAUX), { debut: 9, fin: 15 });

const F = fenetrePhoning('2026-10-26', '2026-10-27', CRENEAUX)!;
egal('phoning  deux journees, J1 et J2', F.jours, ['2026-10-26', '2026-10-27']);
egal('phoning  12 h : 2 jours x 6 h', dureePhoning(F), 12);
egal('phoning  avant J1 : 0 h ecoulee', heuresEcoulees(F, new Date('2026-10-26T08:00:00')), 0);
egal('phoning  J1 a midi : 3 h', heuresEcoulees(F, new Date('2026-10-26T12:00:00')), 3);
egal('phoning  la nuit ne compte pas : J2 a 13 h = 6 + 4 = 10 h', heuresEcoulees(F, new Date('2026-10-27T13:00:00')), 10);
egal('phoning  apres J2 : la duree entiere', heuresEcoulees(F, new Date(J3)), 12);
egal('phoning  une fenetre sans dates rend null', fenetrePhoning(null, '2026-10-27', CRENEAUX), null);

// --------------------------------------------------------------- le remplissage
const REMP = remplissage(RDVS, CRENEAUX);
egal('remplissage  par creneau, le visiteur exclu : 2 / 1 / 2', REMP.map((l) => l.total), [2, 1, 2]);
egal('remplissage  un creneau vide figure avec zero', remplissage([], CRENEAUX).map((l) => l.total), [0, 0, 0]);
egal('creuses  la plus creuse : 10h', heuresCreuses(REMP, 1), ['10:00-11:00']);
egal('creuses  ex aequo 9h / 14h : le plus tot, rendu dans l ordre', heuresCreuses(REMP, 2), ['09:00-10:00', '10:00-11:00']);

// --------------------------------------------------------------- la projection
// A J2 13 h : 10 h ecoulees ; RDV des 4 dernieres heures (t > 6) : r3, r4, r5.
const P = projection(RDVS, F, new Date('2026-10-27T13:00:00'));
egal('projection  5 RDV du phoning (le visiteur exclu)', P.pris, 5);
proche('projection  rythme recent : 3 RDV en 4 h = 0,75 / h', P.rythme, 0.75);
egal('projection  5 + 0,75 x 2 h restantes = 6,5 -> 7', P.projete, 7);
egal('projection  phoning termine : projete = pris', projection(RDVS, F, new Date(J3)).projete, 5);
egal('projection  avant J1 : aucun rythme, projete = pris', projection(RDVS, F, new Date('2026-10-25T12:00:00')).rythme, 0);
egal('courbe  un point par RDV du phoning, cumule', courbeCumul(RDVS, F).map((p) => p.n), [1, 2, 3, 4, 5]);

// --------------------------------------------------------------- le classement
egal('reaffectation  r5 reste au phoning de A, qui l a pris', preneur(RDVS[4]!), 'A');
const C = classementPhoning(RDVS, VENDEURS);
egal('classement  A 3 (dont r5 reaffecte), B 2, D 0 ; C absent sans RDV hors classement',
  C.map((l) => `${l.vendeurId}:${l.rdv}:${l.rang}`), ['A:3:1', 'B:2:2', 'D:0:3']);
const E = vendeur('E', 'VN', 4, true);
const C2 = classementPhoning([...RDVS, rdv('e1', 'E', '09:00-10:00', '2026-10-27T09:00:00'), rdv('e2', 'E', '10:00-11:00', '2026-10-27T09:10:00')], [...VENDEURS, E]);
egal('classement  a RDV egaux, le plus pres de son objectif passe devant (E 2/4 avant B 2/8)',
  C2.filter((l) => l.rdv === 2).map((l) => l.vendeurId), ['E', 'B']);

// --------------------------------------------------------------- l'accueil
egal('accueil  les etapes de r1 a r5', RDVS.slice(0, 5).map(etapeAccueil), ['sorti', 'no_show', 'arrive', 'sorti', 'sorti']);
egal('accueil  sans rien : attendu', etapeAccueil({ issue: null, arriveLe: null, avecVendeurLe: null, sortiLe: null }), 'attendu');

// --------------------------------------------------------------- le bilan
const B = bilanVp(RDVS, VENDEURS);
egal('bilan  effectif 3 : A, B, et D (absent mais il a recu un RDV) ; pas C', B.effectif, 3);
egal('bilan  5 RDV pris, 4 venus (r1, r3, r4, r5), 1 no show', [B.rdvPris, B.venus, B.noShows], [5, 4, 1]);
proche('bilan  presence 4 / 5', B.presence, 0.8);
egal('bilan  2 commandes du phoning (r1, r5), 1 visiteur', [B.commandesPhoning, B.visiteurs], [2, 1]);
proche('bilan  transformation 2 / 4 venus', B.transformation, 0.5);
egal('bilan  3 ventes, visiteur compris ; 1 avec DIAC ; 1 offre', [B.ventes, B.avecDiac, B.offres], [3, 1, 1]);
proche('bilan  3 ventes / 3 vendeurs = 1 vente par vendeur', B.ventesParVendeur, 1);
egal('bilan  sans RDV : presence et ventes par vendeur nulles, pas 0', [bilanVp([], [vendeur('X', 'VN', null, null)]).presence], [null]);

const PV = bilanParVendeur(RDVS, VENDEURS);
egal('par vendeur  la vente de r5 va a D, son phoning a A',
  PV.map((l) => `${l.vendeurId}:pris${l.pris}:cmd${l.commandes}`), ['A:pris3:cmd1', 'B:pris2:cmd1', 'D:pris0:cmd1']);
proche('par vendeur  B recoit 3 clients, 3 venus (r3 arrive, r4 offre, r6 visiteur)', PV[1]!.presence, 1);

// --------------------------------------------------------------- la comparaison
const V = comparerVp([
  { campagneId: 'x', libelle: 'VP X', siteLibelle: 'Vichy', jour: '2026-04-15', effectif: 10, ventes: 20 },
  { campagneId: 'y', libelle: 'VP Y', siteLibelle: 'Mozac', jour: '2026-09-23', effectif: 5, ventes: 12 },
  { campagneId: 'z', libelle: 'VP Z', siteLibelle: 'Albi', jour: '2026-11-18', effectif: 0, ventes: 0 },
  { campagneId: 'w', libelle: 'VP W', siteLibelle: 'Ussel', jour: '2026-05-10', effectif: 4, ventes: 8 },
]);
egal('comparaison  par vendeur : Y 2,4 ; puis W (mai) et X (avril) a 2, la plus recente d abord ; Z sans effectif en dernier',
  V.map((v) => `${v.campagneId}${v.rang}`), ['y1', 'w2', 'x2', 'z4']);

// ---------------------------------------------------------------------------
const largeur = Math.max(...resultats.map((r) => r.nom.length));
for (const r of resultats) console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
const echecs = resultats.filter((r) => !r.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} verifications de GRID/VP.`);
if (echecs > 0) process.exit(1);
