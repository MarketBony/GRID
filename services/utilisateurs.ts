import { ErreurApi, supabase, txt, verifier } from './supabase';

// ============================================================================
// GESTION DES COMPTES ET DE L'ENCADREMENT — reserve a `admin`.
//
// LES QUATRE PALIERS :
//   `admin`      — tout, y compris cet ecran.
//   `direction`  — tout sauf cet ecran.
//   `lecteur`    — lecture seule.
//   aucun role   — un ENCADRANT. Ses droits viennent de ses rattachements : les
//                  sites qu'il encadre et les tables qu'il anime.
//
// UN ENCADRANT N'EST PAS UN VENDEUR. C'est une personne avec un compte, rattachee
// a un site, et rattachable a une table d'une AUTRE concession — c'est ainsi qu'on
// compose des groupes heterogenes coaches par un chef venu d'ailleurs.
//
// ---------------------------------------------------------------------------
// LA SEULE CHOSE QUI NE PEUT PAS SE FAIRE SANS SERVEUR
// ---------------------------------------------------------------------------
// Creer un compte suppose de creer une identite Supabase Auth, ce qui exige la cle
// `service_role`. Cette cle contourne TOUTE la RLS : elle ne doit jamais se
// trouver dans le navigateur, pas meme une seconde.
//
// D'ou l'Edge Function `gerer-comptes` : quelques dizaines de lignes, la cle reste
// chez Supabase, et la fonction refuse tout appelant qui n'est pas `admin`. C'est
// le seul code serveur qui subsiste dans le produit, et son perimetre est etroit.
// ============================================================================

export interface EncadrementDuCompte {
  id: string;
  role: string;
  siteId: string;
  siteCode: string;
  siteLibelle: string;
}

export interface TableAnimee {
  id: string;
  libelle: string;
  plaqueLibelle: string;
  campagneLibelle: string;
  campagneCloturee: boolean;
}

export interface Compte {
  id: string;
  loginId: string;
  nom: string;
  actif: boolean;
  archiveLe: string | null;
  creeLe: string;
  rolesGlobaux: string[];
  sitesEncadres: EncadrementDuCompte[];
  tablesAnimees: TableAnimee[];
  vendeur: { id: string; nom: string } | null;
}

export const ROLES_GLOBAUX = ['admin', 'direction', 'lecteur'];

export async function chargerComptes(): Promise<{ comptes: Compte[]; rolesGlobaux: string[] }> {
  // `password_hash` et `auth_uid` ne sont accordes a personne : un `select('*')`
  // echouerait en `42501` SUR LA TABLE ENTIERE, ce qui se diagnostique tres mal.
  // Les colonnes sont donc nommees, et c'est une contrainte permanente ici.
  const reponse = await supabase
    .from('utilisateur')
    .select(
      'id, login_id, nom, actif, archive_le, cree_le, ' +
        'role_global(role), ' +
        'encadrement_site(id, role, archive_le, site(id, code, libelle)), ' +
        'table_phoning(id, libelle, archive_le, session_plaque(plaque(libelle), campagne(libelle, cloturee))), ' +
        'vendeur(id, nom)'
    )
    .order('nom');

  type Ligne = {
    id: number;
    login_id: string;
    nom: string;
    actif: boolean;
    archive_le: string | null;
    cree_le: string;
    role_global: { role: string }[];
    encadrement_site: {
      id: number;
      role: string;
      archive_le: string | null;
      site: { id: number; code: string; libelle: string } | null;
    }[];
    table_phoning: {
      id: number;
      libelle: string;
      archive_le: string | null;
      session_plaque: {
        plaque: { libelle: string } | null;
        campagne: { libelle: string; cloturee: boolean } | null;
      } | null;
    }[];
    vendeur: { id: number; nom: string } | null;
  };

  const comptes = (verifier(reponse) as unknown as Ligne[]).map((u) => ({
    id: txt(u.id),
    loginId: u.login_id,
    nom: u.nom,
    actif: u.actif,
    archiveLe: u.archive_le,
    creeLe: u.cree_le,
    rolesGlobaux: (u.role_global ?? []).map((r) => r.role),
    sitesEncadres: (u.encadrement_site ?? [])
      .filter((e) => !e.archive_le && e.site)
      .map((e) => ({
        id: txt(e.id),
        role: e.role,
        siteId: txt(e.site!.id),
        siteCode: e.site!.code,
        siteLibelle: e.site!.libelle,
      })),
    // LES TABLES ANIMEES, ARCHIVEES COMPRISES : c'est cette liste qui explique
    // pourquoi un compte ne peut pas etre supprime. Une table de juin explique la
    // composition d'une campagne passee.
    tablesAnimees: (u.table_phoning ?? []).map((t) => ({
      id: txt(t.id),
      libelle: t.libelle,
      plaqueLibelle: t.session_plaque?.plaque?.libelle ?? '',
      campagneLibelle: t.session_plaque?.campagne?.libelle ?? '',
      campagneCloturee: t.session_plaque?.campagne?.cloturee ?? false,
    })),
    vendeur: u.vendeur ? { id: txt(u.vendeur.id), nom: u.vendeur.nom } : null,
  }));

  return { comptes, rolesGlobaux: ROLES_GLOBAUX };
}

/// Appelle l'Edge Function. Le jeton de l'appelant est joint automatiquement par
/// `supabase-js` : c'est lui que la fonction verifie pour refuser tout appelant qui
/// n'est pas `admin`.
async function gererComptes<T>(action: string, charge: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('gerer-comptes', {
    body: { action, ...charge },
  });
  if (error) {
    // Le corps de la reponse porte le vrai message ; `error` seul dit « Edge
    // Function returned a non-2xx status code », ce qui n'aide personne.
    const detail = (data as { message?: string } | null)?.message;
    throw new ErreurApi(detail ?? "La gestion des comptes est indisponible.", 500, error);
  }
  const rendu = data as { erreur?: string } & T;
  if (rendu?.erreur) throw new ErreurApi(rendu.erreur, 409, rendu);
  return rendu;
}

/// `roleGlobal` a `null` cree un ENCADRANT, le cas majoritaire.
///
/// Le mot de passe revient en clair, LA SEULE FOIS. Il n'est ni journalise ni
/// stocke autrement que hache par Supabase : personne ne pourra le relire.
export async function creerCompte(champs: {
  nom: string;
  loginId: string;
  roleGlobal: string | null;
  motDePasse?: string;
}): Promise<{ compte: Compte; motDePasse: string; genere: boolean }> {
  const rendu = await gererComptes<{ utilisateurId: string; motDePasse: string; genere: boolean }>(
    'creer',
    champs
  );
  const { comptes } = await chargerComptes();
  const compte = comptes.find((c) => c.id === rendu.utilisateurId);
  if (!compte) throw new ErreurApi('Compte cree mais introuvable a la relecture.', 500);
  return { compte, motDePasse: rendu.motDePasse, genere: rendu.genere };
}

export async function modifierCompte(
  id: string,
  champs: { nom?: string; roleGlobal?: string | null; actif?: boolean }
): Promise<Compte> {
  if (champs.nom !== undefined || champs.actif !== undefined) {
    const maj: Record<string, unknown> = {};
    if (champs.nom !== undefined) maj.nom = champs.nom;
    if (champs.actif !== undefined) maj.actif = champs.actif;
    verifier(
      await supabase.from('utilisateur').update(maj).eq('id', Number(id)).select('id').single()
    );

    // DESACTIVER UN COMPTE LE RETIRE DE TOUT ENCADREMENT : un encadrant fantome
    // dans un selecteur est pire qu'une case vide. Le trigger
    // `encadrement_site_compte_actif` refuserait de toute facon.
    if (champs.actif === false) {
      verifier(
        await supabase
          .from('encadrement_site')
          .update({ archive_le: new Date().toISOString() })
          .eq('utilisateur_id', Number(id))
          .is('archive_le', null)
          .select('id')
      );
    }
  }

  if (champs.roleGlobal !== undefined) {
    // UN SEUL ROLE GLOBAL PAR COMPTE : les paliers sont exclusifs, pas cumulatifs.
    // La fonction remplace au lieu d'ajouter, et refuse de degrader le DERNIER
    // administrateur actif — sans quoi l'application deviendrait inadministrable.
    verifier(
      await supabase.rpc('utilisateur_definir_roles', {
        p_utilisateur_id: Number(id),
        p_role: champs.roleGlobal,
      })
    );
  }

  const { comptes } = await chargerComptes();
  const compte = comptes.find((c) => c.id === id);
  if (!compte) throw new ErreurApi('Compte introuvable.', 404);
  return compte;
}

export const reinitialiserMotDePasse = (id: string, motDePasse?: string) =>
  gererComptes<{ nom: string; motDePasse: string; genere: boolean }>('mot-de-passe', {
    utilisateurId: id,
    motDePasse,
  });

/// Suppression definitive. N'accepte qu'un compte SANS historique — un compte qui
/// a anime une table explique la composition d'une campagne passee, et son retrait
/// rendrait cet historique anonyme. Les deux verrous (historique vide, nom exact
/// retape) sont poses EN BASE, dans `relance.utilisateur_purger`.
export async function supprimerCompte(id: string, confirmation: string) {
  // L'identite Supabase part AVANT la ligne metier. Dans l'autre sens, un echec
  // laisserait une identite orpheline capable de se connecter sans profil.
  await gererComptes('supprimer-identite', { utilisateurId: id });
  const reponse = await supabase.rpc('utilisateur_purger', {
    p_utilisateur_id: Number(id),
    p_confirmation: confirmation,
  });
  return verifier(reponse) as unknown as { supprime: string };
}

/// Rattacher — ou detacher, avec `utilisateurId` a `null` — un encadrant a un site.
///
/// La fonction LIBERE le role avant de le donner : l'unique `(site, role)` refuse
/// deux titulaires, et l'ordre inverse echouerait. Meme piege que sur l'ecran des
/// encadrants, ou deux requetes lancees en parallele se marchaient dessus.
export async function definirEncadrement(
  siteId: string,
  role: string,
  utilisateurId: string | null
) {
  verifier(
    await supabase.rpc('utilisateur_definir_encadrement', {
      p_site_id: Number(siteId),
      p_role: role,
      p_utilisateur_id: utilisateurId ? Number(utilisateurId) : null,
    })
  );

  const reponse = await supabase
    .from('encadrement_site')
    .select('id, role, utilisateur_id, utilisateur(nom, login_id)')
    .eq('site_id', Number(siteId))
    .is('archive_le', null);

  type Ligne = {
    id: number;
    role: string;
    utilisateur_id: number;
    utilisateur: { nom: string; login_id: string } | null;
  };

  return {
    siteId,
    encadrement: (verifier(reponse) as unknown as Ligne[]).map((e) => ({
      id: txt(e.id),
      role: e.role,
      utilisateurId: txt(e.utilisateur_id),
      nom: e.utilisateur?.nom ?? '',
      loginId: e.utilisateur?.login_id ?? '',
    })),
  };
}

/// Libelle lisible d'un role. Les CODES viennent de la base (interdit n.3) ; seule
/// leur traduction vit ici, et en un seul endroit.
export const libelleRoleEncadrement = (role: string): string =>
  role === 'chef_de_site'
    ? 'chef de site'
    : role === 'chef_de_vente_vn'
      ? 'chef de vente VN'
      : role === 'chef_de_vente_vo'
        ? 'chef de vente VO'
        : role;

export const libelleRoleGlobal = (roles: string[]): string => {
  if (roles.includes('admin')) return 'Administrateur';
  if (roles.includes('direction')) return 'Direction';
  if (roles.includes('lecteur')) return 'Lecteur';
  return 'Encadrant';
};
