import { duPhoning, mobilisation, type LigneRdv, type LigneVendeur } from './agregats';
import { indicateurs, type LigneSuivi } from './suivi';
import { cleTri } from './tri';
import type { IssueSuivi, SourceRdv, TypeVehicule } from '../auth/roles';

// ============================================================================
// GRID/VP — LES CALCULS DE LA VENTE PRIVEE (20/10/2026, PLAN-GRID-VP.md).
//
// MEME STATUT QUE `agregats.ts` et `suivi.ts` : fonctions PURES, servies au
// navigateur tel quel, demontrees par `test:vp`. Rien n'est stocke en base
// (interdit n.2) : courbe, projection, classement et bilan se recalculent a la
// lecture.
//
// CE QUI N'EST PAS RECODE ICI, et ne doit jamais l'etre :
//   - le filtre du phoning (`duPhoning`) : un visiteur sans RDV ne compte ni dans
//     le classement ni dans la projection ;
//   - l'effectif (`mobilisation`) : un absent sort de l'effectif, sauf s'il a des
//     RDV — la regle de GRID classique, arbitree le 08/09/2026 ;
//   - les issues du Suivi (`indicateurs`) : commandes, offres, DIAC.
//
// LA REGLE PROPRE A LA VP (decision du 20/10/2026) : un RDV reaffecte le jour J
// reste au PHONING de celui qui l'a pris (`preneur`) et va en VENTE a celui qui
// recoit le client (`vendeurId`).
// ============================================================================

export interface RdvVp {
  id: string;
  /// Celui qui RECOIT le client — la vente lui revient.
  vendeurId: string;
  /// Renseigne seulement apres une reaffectation : celui qui a PRIS le RDV.
  prisParVendeurId: string | null;
  jour: string;
  creneauCode: string;
  typeVehicule: TypeVehicule;
  marqueId: string | null;
  source: SourceRdv;
  /// Instant de la pose, ISO. C'est lui qui place le RDV dans le temps du phoning.
  creeLe: string;
  issue: IssueSuivi | null;
  diac: boolean;
  stock: boolean;
  cs: boolean;
  arriveLe: string | null;
  avecVendeurLe: string | null;
  sortiLe: string | null;
}

export interface VendeurVp extends LigneVendeur {
  /// Objectif de RDV pose au parametrage. `null` = aucun objectif.
  objectifRdv: number | null;
}

export interface CreneauVp {
  code: string;
  libelle: string;
  ordre: number;
}

/// Celui a qui revient le RDV au PHONING.
export const preneur = (r: Pick<RdvVp, 'prisParVendeurId' | 'vendeurId'>): string => r.prisParVendeurId ?? r.vendeurId;

const versLigneRdv = (r: RdvVp): LigneRdv => ({
  vendeurId: r.vendeurId,
  typeVehicule: r.typeVehicule,
  marqueId: r.marqueId,
  jour: r.jour,
  creneauCode: r.creneauCode,
});

// ---------------------------------------------------------------- les heures

/// Les bornes d'un creneau de GRID, ecrit `HH:MM-HH:MM` (seed : `08:00-09:00`).
/// En heures decimales. `null` pour un code qui ne suit pas cette forme : les
/// creneaux sont des DONNEES (interdit n.3), on ne suppose pas leur ecriture.
export function bornesCreneau(code: string): { debut: number; fin: number } | null {
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(code.trim());
  if (!m) return null;
  const debut = Number(m[1]) + Number(m[2]) / 60;
  const fin = Number(m[3]) + Number(m[4]) / 60;
  return fin > debut ? { debut, fin } : null;
}

/// La plage horaire d'une journee : du debut du premier creneau a la fin du
/// dernier. C'est aussi la plage des journees de PHONING : on appelle aux heures
/// ou le showroom recoit, faute d'une autre donnee.
export function plageDesCreneaux(creneaux: CreneauVp[]): { debut: number; fin: number } | null {
  const bornes = creneaux.map((c) => bornesCreneau(c.code)).filter((b): b is { debut: number; fin: number } => b !== null);
  if (bornes.length === 0) return null;
  return { debut: Math.min(...bornes.map((b) => b.debut)), fin: Math.max(...bornes.map((b) => b.fin)) };
}

// ---------------------------------------------------------------- le remplissage du jour J

export interface RemplissageCreneau {
  code: string;
  libelle: string;
  vn: number;
  vo: number;
  total: number;
}

/// Combien de RDV du PHONING par creneau du jour J, dans l'ordre des creneaux.
/// Un creneau sans RDV figure avec zero : c'est precisement un trou a combler.
export function remplissage(rdvs: RdvVp[], creneaux: CreneauVp[]): RemplissageCreneau[] {
  const phoning = duPhoning(rdvs);
  return [...creneaux]
    .sort((a, b) => a.ordre - b.ordre)
    .map((c) => {
      const ici = phoning.filter((r) => r.creneauCode === c.code);
      const vn = ici.filter((r) => r.typeVehicule === 'VN').length;
      return { code: c.code, libelle: c.libelle, vn, vo: ici.length - vn, total: ici.length };
    });
}

/// Les `n` creneaux les moins remplis — ou orienter les prochains clients.
/// Ex aequo : l'ordre des creneaux (le plus tot d'abord). Rend les codes dans
/// l'ordre des creneaux.
export function heuresCreuses(lignes: RemplissageCreneau[], n = 3): string[] {
  const rang = new Map(lignes.map((l, i) => [l.code, i]));
  return [...lignes]
    .sort((a, b) => a.total - b.total || rang.get(a.code)! - rang.get(b.code)!)
    .slice(0, n)
    .sort((a, b) => rang.get(a.code)! - rang.get(b.code)!)
    .map((l) => l.code);
}

// ---------------------------------------------------------------- le temps du phoning

/// Les journees de phoning et leur plage horaire (heure LOCALE du poste).
export interface FenetrePhoning {
  jours: string[];
  debut: number;
  fin: number;
}

/// Chaque date de `du` a `au` inclus. `null` si une donnee manque.
export function fenetrePhoning(du: string | null, au: string | null, creneaux: CreneauVp[]): FenetrePhoning | null {
  const plage = plageDesCreneaux(creneaux);
  if (!du || !au || !plage || au < du) return null;
  const jours: string[] = [];
  for (let d = new Date(`${du}T12:00:00`); ; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (iso > au) break;
    jours.push(iso);
  }
  return { jours, ...plage };
}

export const dureePhoning = (f: FenetrePhoning): number => f.jours.length * (f.fin - f.debut);

/// LE TEMPS DE PHONING ECOULE a `instant`, en heures. Seules les heures DE
/// PHONING comptent : la nuit entre J1 et J2 n'existe pas pour le rythme. Un
/// instant avant J1 vaut 0, apres J2 la duree totale.
export function heuresEcoulees(f: FenetrePhoning, instant: Date): number {
  let total = 0;
  for (const j of f.jours) {
    const minuit = new Date(`${j}T00:00:00`).getTime();
    const debut = minuit + f.debut * 3_600_000;
    const ici = (instant.getTime() - debut) / 3_600_000;
    total += Math.max(0, Math.min(f.fin - f.debut, ici));
  }
  return total;
}

export interface Projection {
  pris: number;
  ecoule: number;
  duree: number;
  /// RDV par heure de phoning, sur la fenetre recente.
  rythme: number;
  /// Combien de RDV en fin de J2, au rythme recent. Egal a `pris` une fois le
  /// phoning termine.
  projete: number;
}

/// LA PROJECTION : au RYTHME DES DERNIERES HEURES, et non a la moyenne depuis
/// J1 — une salle qui accelere en fin de journee doit le voir. La fenetre se
/// reduit au temps ecoule quand il est plus court (premieres heures de J1).
export function projection(rdvs: RdvVp[], f: FenetrePhoning, instant: Date, fenetreRecente = 4): Projection {
  const phoning = duPhoning(rdvs);
  const duree = dureePhoning(f);
  const ecoule = heuresEcoulees(f, instant);
  const base = Math.min(fenetreRecente, ecoule);
  const recents =
    base > 0 ? phoning.filter((r) => heuresEcoulees(f, new Date(r.creeLe)) > ecoule - base).length : 0;
  const rythme = base > 0 ? recents / base : 0;
  return {
    pris: phoning.length,
    ecoule,
    duree,
    rythme,
    projete: Math.round(phoning.length + rythme * Math.max(0, duree - ecoule)),
  };
}

/// La courbe des RDV cumules, dans le temps du phoning : un point par RDV.
export function courbeCumul(rdvs: RdvVp[], f: FenetrePhoning): { t: number; n: number }[] {
  return duPhoning(rdvs)
    .map((r) => heuresEcoulees(f, new Date(r.creeLe)))
    .sort((a, b) => a - b)
    .map((t, i) => ({ t, n: i + 1 }));
}

// ---------------------------------------------------------------- le classement du phoning

export interface LigneClassementVp {
  vendeurId: string;
  nom: string;
  rdv: number;
  objectif: number | null;
  rang: number;
}

/// LE CLASSEMENT EN DIRECT DES VENDEURS DU SITE. Les RDV du phoning, comptes a
/// celui qui les a PRIS. Les vendeurs de l'effectif y figurent tous, zero RDV
/// compris. Departage : plus de RDV ; puis plus pres de son objectif (un vendeur a
/// 8 sur un objectif de 8 passe devant 8 sur 12) ; puis le nom, insensible aux
/// accents — arbitraire mais stable. Deux vendeurs egaux sur les deux premiers
/// criteres partagent le rang.
export function classementPhoning(rdvs: RdvVp[], vendeurs: VendeurVp[]): LigneClassementVp[] {
  const phoning = duPhoning(rdvs);
  const effectif = mobilisation(rdvs.map(versLigneRdv), vendeurs);
  const parVendeur = new Map<string, number>();
  for (const r of phoning) parVendeur.set(preneur(r), (parVendeur.get(preneur(r)) ?? 0) + 1);

  const part = (l: { rdv: number; objectif: number | null }) => (l.objectif ? l.rdv / l.objectif : -1);
  const tries = vendeurs
    .filter((v) => effectif.has(v.id) || parVendeur.has(v.id))
    .map((v) => ({ vendeurId: v.id, nom: v.nom, rdv: parVendeur.get(v.id) ?? 0, objectif: v.objectifRdv }))
    .sort((a, b) => b.rdv - a.rdv || part(b) - part(a) || cleTri(a.nom).localeCompare(cleTri(b.nom)));

  const rangs: LigneClassementVp[] = [];
  tries.forEach((l, i) => {
    const p = rangs[i - 1];
    rangs.push({ ...l, rang: p && p.rdv === l.rdv && part(p) === part(l) ? p.rang : i + 1 });
  });
  return rangs;
}

// ---------------------------------------------------------------- l'accueil

export type EtapeAccueil = 'attendu' | 'arrive' | 'avec_vendeur' | 'sorti' | 'no_show' | 'annule';

/// OU EN EST LE CLIENT. L'issue prime : un no show ou un RDV annule ne sont plus
/// attendus. Un RDV qualifie dans le Suivi sans passer par la tablette (commande,
/// offre, sans suite) compte comme SORTI : le client est venu.
export function etapeAccueil(
  r: Pick<RdvVp, 'issue' | 'arriveLe' | 'avecVendeurLe' | 'sortiLe'>
): EtapeAccueil {
  if (r.issue === 'no_show') return 'no_show';
  if (r.issue === 'annule') return 'annule';
  if (r.sortiLe) return 'sorti';
  if (r.avecVendeurLe) return 'avec_vendeur';
  if (r.arriveLe) return 'arrive';
  if (r.issue !== null) return 'sorti';
  return 'attendu';
}

export const estVenu = (r: Parameters<typeof etapeAccueil>[0]): boolean => {
  const e = etapeAccueil(r);
  return e === 'arrive' || e === 'avec_vendeur' || e === 'sorti';
};

// ---------------------------------------------------------------- le bilan

const versLigneSuivi = (r: RdvVp, v: VendeurVp | undefined): LigneSuivi => ({
  vendeurId: r.vendeurId,
  vendeurNom: v?.nom ?? '',
  siteId: v?.siteId ?? '',
  siteLibelle: v?.siteLibelle ?? '',
  source: r.source,
  issue: r.issue,
  diac: r.diac,
  stock: r.stock,
  cs: r.cs,
});

const taux = (n: number, sur: number): number | null => (sur > 0 ? n / sur : null);

export interface BilanVp {
  effectif: number;
  rdvPris: number;
  venus: number;
  noShows: number;
  /// Venus / RDV pris. `null` sans RDV.
  presence: number | null;
  /// Commandes issues du phoning.
  commandesPhoning: number;
  /// Commandes / venus, pour le phoning.
  transformation: number | null;
  visiteurs: number;
  /// TOUTES les commandes de la VP, visiteurs compris : c'est ce que la
  /// concession a vendu.
  ventes: number;
  /// LA mesure de comparaison entre VP (decision du 20/10/2026) : une grosse
  /// concession vend plus parce qu'elle a plus de vendeurs. `null` sans effectif.
  ventesParVendeur: number | null;
  avecDiac: number;
  offres: number;
}

/// LE BILAN. Les ventes sont celles du Suivi JUSQU'A LA CLOTURE, quel que soit le
/// jour ou l'offre se conclut (decision du 20/10/2026) : ce calcul ne regarde pas
/// la date, il regarde l'issue.
export function bilanVp(rdvs: RdvVp[], vendeurs: VendeurVp[]): BilanVp {
  const parId = new Map(vendeurs.map((v) => [v.id, v]));
  const phoning = duPhoning(rdvs);
  const venus = phoning.filter(estVenu);
  const tout = indicateurs(rdvs.map((r) => versLigneSuivi(r, parId.get(r.vendeurId))));
  const duPh = indicateurs(phoning.map((r) => versLigneSuivi(r, parId.get(r.vendeurId))));
  const effectif = mobilisation(rdvs.map(versLigneRdv), vendeurs).size;
  return {
    effectif,
    rdvPris: phoning.length,
    venus: venus.length,
    noShows: duPh.noShows,
    presence: taux(venus.length, phoning.length),
    commandesPhoning: duPh.commandes,
    transformation: taux(duPh.commandes, venus.length),
    visiteurs: rdvs.length - phoning.length,
    ventes: tout.commandes,
    ventesParVendeur: taux(tout.commandes, effectif),
    avecDiac: tout.avecDiac,
    offres: tout.offres,
  };
}

export interface LigneBilanVendeur {
  vendeurId: string;
  nom: string;
  typeVehicule: TypeVehicule;
  objectif: number | null;
  /// RDV du phoning qu'il a PRIS.
  pris: number;
  /// Clients qu'il a RECUS, visiteurs compris.
  recus: number;
  venus: number;
  presence: number | null;
  commandes: number;
  transformation: number | null;
  avecDiac: number;
}

/// Le bilan PAR VENDEUR de l'effectif. Ordre : commandes, puis RDV pris, puis le
/// nom.
export function bilanParVendeur(rdvs: RdvVp[], vendeurs: VendeurVp[]): LigneBilanVendeur[] {
  const phoning = duPhoning(rdvs);
  const effectif = mobilisation(rdvs.map(versLigneRdv), vendeurs);
  return vendeurs
    .filter((v) => effectif.has(v.id))
    .map((v) => {
      const recus = rdvs.filter((r) => r.vendeurId === v.id);
      const venus = recus.filter(estVenu);
      const ind = indicateurs(recus.map((r) => versLigneSuivi(r, v)));
      return {
        vendeurId: v.id,
        nom: v.nom,
        typeVehicule: v.typeVehicule,
        objectif: v.objectifRdv,
        pris: phoning.filter((r) => preneur(r) === v.id).length,
        recus: recus.length,
        venus: venus.length,
        presence: taux(venus.length, recus.length),
        commandes: ind.commandes,
        transformation: taux(ind.commandes, venus.length),
        avecDiac: ind.avecDiac,
      };
    })
    .sort((a, b) => b.commandes - a.commandes || b.pris - a.pris || cleTri(a.nom).localeCompare(cleTri(b.nom)));
}

// ---------------------------------------------------------------- la comparaison

export interface VpComparee {
  campagneId: string;
  libelle: string;
  siteLibelle: string;
  /// Le jour de la VP, ISO.
  jour: string;
  effectif: number;
  ventes: number;
}

export interface RangVp extends VpComparee {
  ventesParVendeur: number | null;
  rang: number;
}

/// LA COMPARAISON ENTRE VP, PAR VENDEUR. Une VP sans effectif est rangee a la fin
/// (`null`, pas zero : elle n'a rien a mesurer). Ex aequo : la plus recente
/// d'abord, puis le libelle ; meme valeur, meme rang.
export function comparerVp(liste: VpComparee[]): RangVp[] {
  const tries = liste
    .map((v) => ({ ...v, ventesParVendeur: taux(v.ventes, v.effectif) }))
    .sort(
      (a, b) =>
        (b.ventesParVendeur ?? -1) - (a.ventesParVendeur ?? -1) ||
        b.jour.localeCompare(a.jour) ||
        cleTri(a.libelle).localeCompare(cleTri(b.libelle))
    );
  const rangs: RangVp[] = [];
  tries.forEach((v, i) => {
    const p = rangs[i - 1];
    rangs.push({ ...v, rang: p && p.ventesParVendeur === v.ventesParVendeur ? p.rang : i + 1 });
  });
  return rangs;
}
