import { prisma } from '../db';
import type { RoleGlobal } from './roles';
import { presenceVendeur } from '../utils/presenceVendeur';

// ============================================================================
// PERIMETRE PAR CAMPAGNE — SEULE PORTE PAR LAQUELLE UN CLOISONNEMENT S'APPLIQUE
//
// Statut identique a `siteScope.ts` sur GEARBOX : **aucune route ne recopie une
// clause de perimetre.** Toute restriction passe par ce module, sans quoi on se
// retrouve avec autant de demi-regles que d'ecrans — exactement ce qui a fait
// diverger Budget et Dashboard quatre fois sur GEARBOX.
//
// POURQUOI C'EST ICI ET PAS EN BASE. Le modele retenu est << l'API fait
// autorite >> : Prisma se connecte avec un role unique, proprietaire des tables,
// qui contourne la RLS de toute facon. La base ne cloisonne donc RIEN. Ce fichier
// est la seule chose entre un jeton et les donnees d'une autre plaque. Il n'a pas
// de filet.
//
// LES DROITS SONT PAR CAMPAGNE (cahier des charges section 3) : etre chef de
// table en juin ne donne aucun droit sur la campagne de septembre. Toute fonction
// ici prend donc un `campagneId`, sans exception — une fonction de perimetre sans
// campagne serait un bug, pas un raccourci.
//
// ET ILS SONT RELUS EN BASE A CHAQUE REQUETE, jamais lus dans le jeton : un chef
// de plaque qui recompose une table modifie les droits d'un chef de table en
// pleine session. Un role grave dans le jeton serait perime au moment ou il
// compte.
// ============================================================================

/// Droits d'un utilisateur, tous perimetres confondus. Les identifiants sont des
/// CHAINES : les cles primaires sont des bigint, serialises en chaine cote API
/// (voir `utils/json.ts`). Ne jamais melanger avec des bigint ou des nombres.
export interface Droits {
  utilisateurId: string;
  /// Compte desactive ou archive : aucun droit, pas meme la lecture. Un compte
  /// qui n'est plus actif ne doit pas pouvoir consulter les classements.
  actif: boolean;
  /// Tout, y compris la gestion des comptes.
  admin: boolean;
  /// Tout SAUF la gestion des comptes. C'est la seule difference avec `admin`, et
  /// c'est le palier « Direction ».
  direction: boolean;
  lecteur: boolean;
  /// campagneId -> plaqueIds sur lesquelles l'utilisateur est chef de plaque
  plaquesParCampagne: Map<string, Set<string>>;
  /// campagneId -> siteIds sur lesquels l'utilisateur est chef de site POUR CETTE
  /// CAMPAGNE (`role_campagne`). Sert aux exceptions ponctuelles.
  sitesParCampagne: Map<string, Set<string>>;
  /// campagneId -> tableIds que l'utilisateur anime (chef de table)
  tablesParCampagne: Map<string, Set<string>>;
  /// Sites que l'utilisateur encadre, TOUTES CAMPAGNES CONFONDUES.
  ///
  /// Durable et non par campagne : un site a ses encadrants, une table se compose
  /// a chaque campagne. Un chef de site garde donc son perimetre de saisie d'une
  /// campagne a l'autre sans qu'on ait a le redesigner — ce que `role_campagne`
  /// imposait, et qui faisait qu'un chef de juin n'avait aucun droit en septembre.
  sitesEncadres: Set<string>;
}

const ajouter = (carte: Map<string, Set<string>>, cle: string, valeur: string) => {
  const existant = carte.get(cle);
  if (existant) existant.add(valeur);
  else carte.set(cle, new Set([valeur]));
};

const DROITS_VIDES = (utilisateurId: string): Droits => ({
  utilisateurId,
  actif: false,
  admin: false,
  direction: false,
  lecteur: false,
  plaquesParCampagne: new Map(),
  sitesParCampagne: new Map(),
  tablesParCampagne: new Map(),
  sitesEncadres: new Set(),
});

/// Charge l'integralite des droits d'un utilisateur en trois requetes.
/// A appeler UNE FOIS par requete HTTP, puis passer le resultat aux helpers.
export async function chargerDroits(utilisateurId: string): Promise<Droits> {
  const id = BigInt(utilisateurId);

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id },
    select: { actif: true, archiveLe: true },
  });

  // Compte inexistant, desactive ou archive : on renvoie des droits vides plutot
  // que de lever une exception. L'appelant obtient un 403 coherent, et un jeton
  // encore valide emis avant la desactivation ne donne rien.
  if (!utilisateur || !utilisateur.actif || utilisateur.archiveLe) {
    return DROITS_VIDES(utilisateurId);
  }

  const [globaux, parCampagne, tables, encadrements] = await Promise.all([
    prisma.roleGlobal.findMany({ where: { utilisateurId: id }, select: { role: true } }),
    prisma.roleCampagne.findMany({
      where: { utilisateurId: id, archiveLe: null },
      select: { campagneId: true, role: true, plaqueId: true, siteId: true },
    }),
    prisma.tablePhoning.findMany({
      where: { chefUtilisateurId: id, archiveLe: null },
      select: { id: true, sessionPlaque: { select: { campagneId: true } } },
    }),
    // Rattachements DURABLES a des sites. Hors campagne, volontairement.
    prisma.encadrementSite.findMany({
      where: { utilisateurId: id, archiveLe: null },
      select: { siteId: true, role: true },
    }),
  ]);

  const droits: Droits = {
    ...DROITS_VIDES(utilisateurId),
    actif: true,
  };

  for (const g of globaux) {
    if ((g.role as RoleGlobal) === 'admin') droits.admin = true;
    if ((g.role as RoleGlobal) === 'direction') droits.direction = true;
    if ((g.role as RoleGlobal) === 'lecteur') droits.lecteur = true;
  }

  // Les trois roles d'encadrement donnent LE MEME perimetre de saisie : les
  // vendeurs du site. La distinction chef de site / chef de vente VN / VO est une
  // information d'organisation, pas une graduation de droits — et inventer une
  // graduation que le metier ne demande pas produit des refus incomprehensibles.
  for (const e of encadrements) droits.sitesEncadres.add(e.siteId.toString());

  for (const r of parCampagne) {
    const campagne = r.campagneId.toString();
    if (r.role === 'chef_plaque' && r.plaqueId !== null) {
      ajouter(droits.plaquesParCampagne, campagne, r.plaqueId.toString());
    }
    if (r.role === 'chef_site' && r.siteId !== null) {
      ajouter(droits.sitesParCampagne, campagne, r.siteId.toString());
    }
  }

  for (const t of tables) {
    ajouter(droits.tablesParCampagne, t.sessionPlaque.campagneId.toString(), t.id.toString());
  }

  return droits;
}

/// Un utilisateur actif peut LIRE les referentiels et les compteurs. C'est ce qui
/// rend les classements calculables et donne un objet au role Lecteur.
///
/// R-C.4 (<< un chef de table ne voit que les vendeurs de sa table >>) est traitee
/// comme une regle d'ECRAN, pas de confidentialite : le module C ne liste que ta
/// table, le dashboard montre tout. En revanche le NOM DU CLIENT n'est pas
/// public — voir `peutVoirClient`.
export const peutLire = (droits: Droits): boolean => droits.actif;

/// Administration des referentiels, des campagnes et des tables.
///
/// `admin` ET `direction`. La seule chose que `direction` ne peut pas faire, c'est
/// gerer les comptes — voir `peutGererUtilisateurs`.
export const peutAdministrer = (droits: Droits): boolean =>
  droits.actif && (droits.admin || droits.direction);

/// GESTION DES COMPTES : `admin` SEUL.
///
/// C'est la frontiere entre les deux paliers hauts, et la raison pour laquelle
/// elle existe : sans elle, `direction` pourrait se promouvoir `admin`. C'est le
/// scenario que GEARBOX a du fermer en interdisant a Director d'attribuer
/// Director.
export const peutGererUtilisateurs = (droits: Droits): boolean =>
  droits.actif && droits.admin;

/// Une campagne cloturee n'accepte plus AUCUNE ecriture (R-C.3). Verifie en base
/// ET par un trigger : c'est une regle qu'on ne veut pas voir contournee par une
/// route oubliee.
export async function campagneOuverte(campagneId: string): Promise<boolean> {
  const c = await prisma.campagne.findUnique({
    where: { id: BigInt(campagneId) },
    select: { cloturee: true, archiveLe: true },
  });
  return !!c && !c.cloturee && !c.archiveLe;
}

/// Identifiants des vendeurs sur lesquels l'utilisateur peut SAISIR, pour une
/// campagne donnee. C'est la fonction que le module C utilise pour construire sa
/// liste de gauche, et celle sur laquelle s'appuie le controle d'ecriture.
///
/// Union de quatre origines de droit :
///   - `admin`        : tous les vendeurs
///   - `chef_plaque`  : les vendeurs des sites de ses plaques
///   - `chef_site`    : les vendeurs de ses sites
///   - chef de table  : les vendeurs affectes a ses tables
///
/// Filtre en plus sur la PRESENCE du vendeur pendant la campagne : saisir un RDV
/// sur quelqu'un qui avait quitte le groupe n'a pas de sens, et cela faussait
/// l'effectif dans le fichier Excel.
export async function vendeursSaisissables(
  droits: Droits,
  campagneId: string
): Promise<Set<string>> {
  if (!droits.actif) return new Set();

  const campagne = await prisma.campagne.findUnique({
    where: { id: BigInt(campagneId) },
    select: { dateDebut: true, dateFin: true },
  });
  if (!campagne) return new Set();

  // Presence du vendeur pendant la campagne. SOURCE DE VERITE UNIQUE dans
  // `utils/presenceVendeur.ts` : ne pas recopier la clause ici, le dashboard
  // utilise exactement la meme pour calculer l'effectif.
  const presence = presenceVendeur(campagne);

  // `admin` ET `direction` : les deux paliers hauts ont un ACCES TOTAL, saisie
  // comprise. La seule chose que `direction` ne peut pas faire, c'est gerer les
  // comptes — et c'est une porte separee (`peutGererUtilisateurs`).
  //
  // Trouve par le script des comptes de test, qui refuse de livrer un compte sans
  // perimetre : `direction.test` ressortait avec zero vendeur saisissable alors
  // que la specification dit << acces total >>. Un garde-fou qui sert.
  if (droits.admin || droits.direction) {
    const tous = await prisma.vendeur.findMany({ where: presence, select: { id: true } });
    return new Set(tous.map((v) => v.id.toString()));
  }

  const plaques = [...(droits.plaquesParCampagne.get(campagneId) ?? [])].map(BigInt);
  const tables = [...(droits.tablesParCampagne.get(campagneId) ?? [])].map(BigInt);

  // QUATRE ORIGINES DE PERIMETRE, reunies ICI et nulle part ailleurs :
  //
  //   1. chef de plaque, pour cette campagne ;
  //   2. chef de site pour cette campagne (`role_campagne`, exception ponctuelle) ;
  //   3. ENCADRANT d'un site, durablement — chef de site ou chef de vente. Ce
  //      rattachement ne depend pas de la campagne : un chef garde son perimetre
  //      d'une campagne a l'autre.
  //   4. chef de table, pour cette campagne. La table peut contenir des vendeurs
  //      de plusieurs concessions, et le chef peut venir d'une autre encore —
  //      c'est tout l'objet de l'exercice.
  //
  // Les origines 2 et 3 se recouvrent volontairement : l'une est temporaire,
  // l'autre durable. L'union etant faite en UN seul endroit, aucun risque de
  // divergence.
  const sites = [
    ...new Set([...(droits.sitesParCampagne.get(campagneId) ?? []), ...droits.sitesEncadres]),
  ].map(BigInt);

  if (plaques.length === 0 && sites.length === 0 && tables.length === 0) return new Set();

  const origines: object[] = [];
  if (plaques.length) origines.push({ site: { plaqueId: { in: plaques } } });
  if (sites.length) origines.push({ siteId: { in: sites } });
  if (tables.length) {
    origines.push({
      affectations: { some: { tableId: { in: tables }, archiveLe: null } },
    });
  }

  const vendeurs = await prisma.vendeur.findMany({
    where: { AND: [presence, { OR: origines }] },
    select: { id: true },
  });
  return new Set(vendeurs.map((v) => v.id.toString()));
}

/// Controle d'ecriture pour UN vendeur. Passe par `vendeursSaisissables` plutot
/// que de refaire une clause a cote : deux implementations de la meme regle
/// finissent toujours par diverger, et c'est celle-ci qui autorise
/// l'ecriture.
export async function peutSaisirVendeur(
  droits: Droits,
  campagneId: string,
  vendeurId: string
): Promise<boolean> {
  if (!droits.actif) return false;
  const autorises = await vendeursSaisissables(droits, campagneId);
  return autorises.has(vendeurId);
}

/// Composer les tables d'une session : `admin`, ou chef de la plaque de cette
/// session pour cette campagne (F-B.1 a F-B.7). Un chef de table ne compose pas
/// sa propre table.
export async function peutAdministrerSession(
  droits: Droits,
  sessionPlaqueId: string
): Promise<boolean> {
  if (!droits.actif) return false;
  if (droits.admin) return true;

  const session = await prisma.sessionPlaque.findUnique({
    where: { id: BigInt(sessionPlaqueId) },
    select: { campagneId: true, plaqueId: true },
  });
  if (!session) return false;

  const plaques = droits.plaquesParCampagne.get(session.campagneId.toString());
  return !!plaques && plaques.has(session.plaqueId.toString());
}

// ---------------------------------------------------------------------------
// REDACTION DU CONTENU — filtrer les lignes ne suffit pas.
//
// Lecon de GEARBOX (`redactSiteFields`) : une ligne qui passe legitimement le
// filtre peut nommer dans son CONTENU des elements hors perimetre. Ici, le
// compteur de RDV est public — il faut bien produire les classements — mais le
// NOM DU CLIENT ne l'est pas. Un chef de table qui ouvre un dashboard n'a aucune
// raison de recuperer la clientele des autres tables, et ces noms sont des
// donnees personnelles.
// ---------------------------------------------------------------------------

/// Qui peut voir le champ `client` d'un RDV : ceux qui peuvent le saisir.
export const peutVoirClient = (autorises: Set<string>, vendeurId: string): boolean =>
  autorises.has(vendeurId);

/// Retire `client` et `commentaire` des RDV hors perimetre de saisie.
/// `autorises` vient de `vendeursSaisissables` — un seul appel pour toute la liste.
export function redacterRdvs<T extends { vendeurId: bigint | string; client: string; commentaire?: string | null }>(
  rdvs: T[],
  autorises: Set<string>
): T[] {
  return rdvs.map((rdv) => {
    if (peutVoirClient(autorises, rdv.vendeurId.toString())) return rdv;
    return { ...rdv, client: '', commentaire: null };
  });
}
