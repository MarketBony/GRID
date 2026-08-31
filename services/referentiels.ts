import { supabase, txt, txtOuNull, verifier } from './supabase';
import { ROLES_ENCADREMENT, MODES_SESSION, TYPES_VEHICULE } from '../backend/src/auth/roles';
import { analyser, type Apercu as ApercuParseur } from '../backend/src/utils/importMarques';
import type { Marque, Plaque, Site, TypeVehicule } from '../types';

// ============================================================================
// LES REFERENTIELS.
//
// Le front ne code AUCUNE de ces valeurs en dur : ni les plaques, ni les sites,
// ni les marques (interdit n.3). Elles viennent toutes de la base.
//
// EXCEPTION ASSUMEE, et elle etait deja dans le modele : `TYPES_VEHICULE`,
// `MODES_SESSION` et `ROLES_ENCADREMENT` sont importes de `auth/roles.ts`. Ce ne
// sont PAS des referentiels metier mais des modes de fonctionnement du LOGICIEL,
// qu'aucun utilisateur n'a a modifier. Ils vivent en un seul endroit, compare aux
// contraintes CHECK — les recopier ici en ferait un second.
// ============================================================================

export interface Referentiels {
  plaques: Plaque[];
  sites: Site[];
  marques: Marque[];
  vendeurs: VendeurReferentiel[];
  encadrements: {
    id: string;
    siteId: string;
    role: string;
    utilisateurId: string;
    nom: string;
    loginId: string;
  }[];
  encadrantsDisponibles: {
    id: string;
    nom: string;
    loginId: string;
    rolesGlobaux: string[];
    encadrements: { role: string; siteCode: string }[];
  }[];
  typesVehicule: TypeVehicule[];
  modesSession: string[];
  rolesEncadrement: string[];
}

export interface VendeurReferentiel {
  id: string;
  nom: string;
  siteId: string;
  dateEntree: string | null;
  dateSortie: string | null;
  marqueIds: string[];
  typeVehicule: TypeVehicule;
  archiveLe: string | null;
}

/// Forme des lignes telles que PostgREST les rend : `snake_case`, identifiants en
/// nombres. La conversion vers le vocabulaire du front se fait ICI, a la
/// frontiere, et nulle part ailleurs.
interface LigneVendeur {
  id: number;
  nom: string;
  site_id: number;
  date_entree: string | null;
  date_sortie: string | null;
  type_vehicule: string;
  archive_le: string | null;
  vendeur_marque: { marque_id: number }[];
}

const versVendeur = (v: LigneVendeur): VendeurReferentiel => ({
  id: txt(v.id),
  nom: v.nom,
  siteId: txt(v.site_id),
  dateEntree: v.date_entree,
  dateSortie: v.date_sortie,
  marqueIds: (v.vendeur_marque ?? []).map((m) => txt(m.marque_id)),
  typeVehicule: v.type_vehicule as TypeVehicule,
  archiveLe: v.archive_le,
});

const SELECT_VENDEUR = 'id, nom, site_id, date_entree, date_sortie, type_vehicule, archive_le, vendeur_marque(marque_id)';

export async function chargerReferentiels(): Promise<Referentiels> {
  const [plaques, sites, marques, vendeurs, encadrements, comptes] = await Promise.all([
    supabase.from('plaque').select('id, libelle, alias, ordre').is('archive_le', null).order('ordre'),
    supabase.from('site').select('id, code, libelle, plaque_id').is('archive_le', null).order('code'),
    supabase.from('marque').select('id, code, libelle, ordre').is('archive_le', null).order('ordre'),
    supabase.from('vendeur').select(SELECT_VENDEUR).is('archive_le', null).order('nom'),
    supabase
      .from('encadrement_site')
      .select('id, site_id, role, utilisateur_id, utilisateur(nom, login_id)')
      .is('archive_le', null),
    // LES COMPTES ATTRIBUABLES, TOUS SITES CONFONDUS — et c'est le coeur de
    // l'exercice. Un chef de vente de Clermont doit pouvoir encadrer un site de
    // Villefranche : restreindre cette liste au site courant rendrait la mixite
    // litteralement inexprimable.
    supabase
      .from('utilisateur')
      .select('id, nom, login_id, role_global(role), encadrement_site(role, site(code))')
      .eq('actif', true)
      .is('archive_le', null)
      .order('nom'),
  ]);

  type LigneEncadrement = {
    id: number;
    site_id: number;
    role: string;
    utilisateur_id: number;
    utilisateur: { nom: string; login_id: string } | null;
  };
  type LigneCompte = {
    id: number;
    nom: string;
    login_id: string;
    role_global: { role: string }[];
    encadrement_site: { role: string; site: { code: string } | null }[];
  };

  return {
    plaques: verifier(plaques).map((p) => ({
      id: txt(p.id),
      libelle: p.libelle,
      alias: p.alias,
      ordre: p.ordre,
    })),
    sites: verifier(sites).map((s) => ({
      id: txt(s.id),
      code: s.code,
      libelle: s.libelle,
      plaqueId: txt(s.plaque_id),
    })),
    marques: verifier(marques).map((m) => ({
      id: txt(m.id),
      code: m.code,
      libelle: m.libelle,
      ordre: m.ordre,
    })),
    vendeurs: (verifier(vendeurs) as unknown as LigneVendeur[]).map(versVendeur),
    encadrements: (verifier(encadrements) as unknown as LigneEncadrement[]).map((e) => ({
      id: txt(e.id),
      siteId: txt(e.site_id),
      role: e.role,
      utilisateurId: txt(e.utilisateur_id),
      nom: e.utilisateur?.nom ?? '',
      loginId: e.utilisateur?.login_id ?? '',
    })),
    encadrantsDisponibles: (verifier(comptes) as unknown as LigneCompte[]).map((c) => ({
      id: txt(c.id),
      nom: c.nom,
      loginId: c.login_id,
      rolesGlobaux: (c.role_global ?? []).map((r) => r.role),
      encadrements: (c.encadrement_site ?? [])
        .filter((e) => e.site)
        .map((e) => ({ role: e.role, siteCode: e.site!.code })),
    })),
    typesVehicule: [...TYPES_VEHICULE],
    modesSession: [...MODES_SESSION],
    rolesEncadrement: [...ROLES_ENCADREMENT],
  };
}

// ---------------------------------------------------------------- archivage
//
// DEUX NIVEAUX, et la distinction est tout le sujet.
//
//   ARCHIVER — la ligne disparait des ecrans, ses RDV RESTENT en base. Les totaux
//   des campagnes passees ne bougent pas d'un iota. Reversible, c'est un `update`.
//
//   PURGER — destruction definitive, RDV compris. Passe par une fonction
//   `security definer` : aucun droit `DELETE` n'est accorde a personne.

export interface VendeurArchive extends VendeurReferentiel {
  siteCode: string;
  siteLibelle: string;
  nbRdv: number;
  nbAffectations: number;
}

export async function chargerArchives(): Promise<VendeurArchive[]> {
  // `count` sur une relation embarquee : PostgREST rend `[{ count: n }]`. C'est ce
  // qui evite de rapatrier les RDV d'un vendeur pour en connaitre le nombre —
  // personne ne doit avoir a deviner ce qu'une purge detruira.
  const reponse = await supabase
    .from('vendeur')
    .select(
      'id, nom, site_id, date_entree, date_sortie, type_vehicule, archive_le, ' +
        'vendeur_marque(marque_id), site(code, libelle), rdv(count), affectation(count)'
    )
    .not('archive_le', 'is', null)
    .order('nom');

  type Ligne = LigneVendeur & {
    site: { code: string; libelle: string } | null;
    rdv: { count: number }[];
    affectation: { count: number }[];
  };

  return (verifier(reponse) as unknown as Ligne[]).map((v) => ({
    ...versVendeur(v),
    siteCode: v.site?.code ?? '',
    siteLibelle: v.site?.libelle ?? '',
    nbRdv: v.rdv?.[0]?.count ?? 0,
    nbAffectations: v.affectation?.[0]?.count ?? 0,
  }));
}

export async function archiverVendeur(id: string) {
  const avant = verifier(
    await supabase.from('vendeur').select('nom, rdv(count)').eq('id', Number(id)).single()
  ) as unknown as { nom: string; rdv: { count: number }[] };
  const nbRdv = avant.rdv?.[0]?.count ?? 0;

  verifier(
    await supabase.rpc('vendeur_modifier', { p_vendeur_id: Number(id), p_archiver: true })
  );

  // LE MESSAGE DIT CE QUI EST CONSERVE, pas ce qui est fait. C'est toute la
  // difference entre archiver et purger, et l'ecran doit la rendre evidente au
  // moment ou l'utilisateur clique.
  return {
    archive: avant.nom,
    nbRdv,
    message:
      `${avant.nom} est archive : il disparait des ecrans, mais ses ${nbRdv} RDV restent ` +
      'en base. Les totaux des campagnes passees ne bougent pas. Reversible.',
  };
}

export async function desarchiverVendeur(id: string) {
  const reponse = await supabase.rpc('vendeur_modifier', {
    p_vendeur_id: Number(id),
    p_archiver: false,
  });
  verifier(reponse);
  return { desarchive: id };
}

/// LA PURGE. `confirmation` doit valoir le nom exact du vendeur, et le vendeur
/// doit deja etre archive : les deux verrous sont poses EN BASE, dans
/// `relance.vendeur_purger`. Le front ne fait que transmettre.
export async function purgerVendeur(id: string, confirmation: string) {
  const reponse = await supabase.rpc('vendeur_purger', {
    p_vendeur_id: Number(id),
    p_confirmation: confirmation,
  });
  return verifier(reponse) as unknown as {
    purge: string;
    nbRdv: number;
    nbAffectations: number;
    message: string;
  };
}

// ---------------------------------------------------------------- vendeurs

export interface ChampsVendeur {
  nom?: string;
  siteId?: string;
  dateEntree?: string | null;
  dateSortie?: string | null;
  marqueIds?: string[];
  typeVehicule?: TypeVehicule;
}

async function relireVendeur(id: string): Promise<VendeurReferentiel> {
  const reponse = await supabase.from('vendeur').select(SELECT_VENDEUR).eq('id', Number(id)).single();
  return versVendeur(verifier(reponse) as unknown as LigneVendeur);
}

export async function creerVendeur(champs: {
  nom: string;
  siteId: string;
  marqueIds: string[];
  typeVehicule: TypeVehicule;
  dateEntree?: string | null;
}): Promise<VendeurReferentiel> {
  const reponse = await supabase.rpc('vendeur_creer', {
    p_nom: champs.nom,
    p_site_id: Number(champs.siteId),
    p_type_vehicule: champs.typeVehicule,
    p_marque_ids: champs.marqueIds.map(Number),
    p_date_entree: champs.dateEntree ?? null,
  });
  const rendu = verifier(reponse) as unknown as { id: string };
  return relireVendeur(rendu.id);
}

/// Changer `siteId` TRANSFERE le vendeur en conservant tout son historique
/// (F-A3.5) : les RDV ne portent ni site ni plaque, ils pointent le vendeur, donc
/// les totaux des deux sites suivent immediatement.
export async function modifierVendeur(
  id: string,
  champs: ChampsVendeur
): Promise<VendeurReferentiel> {
  // `p_changer_capacites` distingue « ne pas toucher aux marques » de « retirer
  // toutes les marques ». Sans ce drapeau, les deux seraient un tableau vide.
  const changeCapacites = champs.marqueIds !== undefined || champs.typeVehicule !== undefined;

  const reponse = await supabase.rpc('vendeur_modifier', {
    p_vendeur_id: Number(id),
    p_nom: champs.nom ?? null,
    p_site_id: champs.siteId ? Number(champs.siteId) : null,
    p_date_entree: champs.dateEntree ?? null,
    p_date_sortie: champs.dateSortie ?? null,
    p_changer_capacites: changeCapacites,
    p_type_vehicule: champs.typeVehicule ?? null,
    p_marque_ids: champs.marqueIds ? champs.marqueIds.map(Number) : null,
  });
  verifier(reponse);
  return relireVendeur(id);
}

// ---------------------------------------------------------------- import

export type LigneApercu = ApercuParseur['lignes'][number];
export type Apercu = ApercuParseur;

/// L'ANALYSE TOURNE DANS LE NAVIGATEUR, et c'est un changement d'endroit, pas de
/// regle : `importMarques.ts` est une fonction PURE, couverte par 19 controles, et
/// c'est exactement le meme fichier qu'avant. Le retranscrire cote base en aurait
/// fait une seconde version.
///
/// Rien n'est ecrit : l'utilisateur voit ce qui sera applique avant de l'appliquer.
export async function analyserImport(contenu: string): Promise<Apercu> {
  const { vendeurs, marques, sites } = await chargerReferentiels();
  return analyser(contenu, {
    vendeurs: vendeurs.map((v) => ({
      id: v.id,
      nom: v.nom,
      siteId: v.siteId,
      marqueIds: v.marqueIds,
    })),
    sites: sites.map((s) => ({ id: s.id, code: s.code, libelle: s.libelle })),
    marques: marques.map((m) => ({ id: m.id, code: m.code, libelle: m.libelle })),
  });
}

/// Applique EXACTEMENT les lignes transmises — l'analyse n'est PAS rejouee. C'est
/// ce qui garantit qu'on applique ce que l'utilisateur a vu, et non ce qu'une
/// seconde analyse aurait pu decider entre-temps.
///
/// TOUT OU RIEN : la fonction `vendeur_appliquer_import_marques` porte une seule
/// transaction. Un import a moitie applique laisserait une partie des vendeurs sur
/// leurs anciennes capacites, sans que rien ne distingue ce cas d'un import reussi.
export async function appliquerImport(
  lignes: { vendeurId: string; marqueIds: string[] }[]
): Promise<{ appliquees: number }> {
  // L'import ne porte QUE les marques : le metier de chaque vendeur est conserve
  // tel quel, pour ne pas ecraser une donnee deja validee a la main.
  const { vendeurs } = await chargerReferentiels();
  const metier = new Map(vendeurs.map((v) => [v.id, v.typeVehicule]));

  const reponse = await supabase.rpc('vendeur_appliquer_import_marques', {
    p_lignes: lignes.map((l) => ({
      vendeurId: l.vendeurId,
      marqueIds: l.marqueIds,
      typeVehicule: metier.get(l.vendeurId) ?? 'VN',
    })),
  });
  return verifier(reponse) as unknown as { appliquees: number };
}
