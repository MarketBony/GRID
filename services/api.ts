import type { Droits, Session, Utilisateur } from '../types';
import { ErreurApi, supabase, txt, verifier } from './supabase';

// ============================================================================
// SESSION ET DROITS.
//
// L'authentification passe par Supabase Auth. Le resume des droits, lui, est
// RECOMPOSE ICI a partir de la base — il n'est jamais lu dans le jeton.
//
// POURQUOI PAS DANS LE JETON. Les droits de cet outil sont PAR CAMPAGNE et
// changent en cours de session : un chef de plaque qui recompose une table
// modifie a l'instant le perimetre d'un chef de table. Un role grave dans le jeton
// serait perime au moment ou il compte. C'etait deja la regle du portail
// `campagneScope.ts`, et elle ne change pas de nature en changeant de langage.
//
// CE RESUME NE FAIT AUTORITE SUR RIEN (interdit n.5). Il sert a decider quels
// onglets afficher. Chaque lecture et chaque ecriture sont revalidees par la RLS,
// qui ne lui accorde aucune confiance — cacher un bouton n'est pas une securite.
// ============================================================================

export { ErreurApi } from './supabase';

/// SUPABASE AUTH EXIGE UN E-MAIL, NOS COMPTES ONT UN IDENTIFIANT.
///
/// `admin`, `sbesson`, `jlarget` n'ont pas d'adresse — ce sont des identifiants de
/// connexion, et l'ecran continue de demander cela. On compose donc une adresse de
/// SYNTHESE, ici et nulle part ailleurs.
///
/// CE DOMAINE NE RECOIT PAS DE COURRIER, et personne ne doit croire le contraire :
/// aucun message ne partira jamais vers `sbesson@grid.bonyauto-mobile.com`. C'est
/// pourquoi la confirmation d'e-mail est desactivee cote Supabase — sans cela,
/// aucun compte n'aurait pu se connecter, faute de pouvoir confirmer une adresse
/// qui n'existe pas.
const DOMAINE_SYNTHESE = 'grid.bonyauto-mobile.com';

export const adresseDeSynthese = (loginId: string) =>
  `${loginId.trim().toLowerCase()}@${DOMAINE_SYNTHESE}`;

const DROITS_VIDES: Droits = {
  admin: false,
  direction: false,
  administre: false,
  gereUtilisateurs: false,
  lecteur: false,
  sitesEncadres: [],
  plaquesParCampagne: {},
  sitesParCampagne: {},
  tablesParCampagne: {},
};

const ajouter = (carte: Record<string, string[]>, cle: string, valeur: string) => {
  const existant = carte[cle];
  if (existant) {
    if (!existant.includes(valeur)) existant.push(valeur);
  } else {
    carte[cle] = [valeur];
  }
};

/// Recompose le resume des droits en quatre lectures.
///
/// Transcription de `chargerDroits`, avec la meme repartition : les roles globaux,
/// les roles PAR CAMPAGNE, les tables animees, et les encadrements DURABLES de
/// site. Les deux dernieres origines ne se confondent pas — un encadrement de site
/// suit d'une campagne a l'autre, une table appartient a une seule campagne.
async function chargerDroits(utilisateurId: string): Promise<Droits> {
  const id = Number(utilisateurId);

  const [globaux, parCampagne, tables, encadrements] = await Promise.all([
    supabase.from('role_global').select('role').eq('utilisateur_id', id),
    supabase
      .from('role_campagne')
      .select('campagne_id, role, plaque_id, site_id')
      .eq('utilisateur_id', id)
      .is('archive_le', null),
    supabase
      .from('table_phoning')
      .select('id, session_plaque!inner(campagne_id)')
      .eq('chef_utilisateur_id', id)
      .is('archive_le', null),
    supabase
      .from('encadrement_site')
      .select('site_id')
      .eq('utilisateur_id', id)
      .is('archive_le', null),
  ]);

  const droits: Droits = {
    ...DROITS_VIDES,
    sitesEncadres: [],
    plaquesParCampagne: {},
    sitesParCampagne: {},
    tablesParCampagne: {},
  };

  for (const r of verifier(globaux)) {
    if (r.role === 'admin') droits.admin = true;
    if (r.role === 'direction') droits.direction = true;
    if (r.role === 'lecteur') droits.lecteur = true;
  }
  // `administre` est CALCULE, jamais recopie depuis un booleen envoye par
  // ailleurs : c'est la meme regle que `peutAdministrer()` en base, et elle
  // n'existe qu'a un seul endroit de chaque cote.
  droits.administre = droits.admin || droits.direction;
  droits.gereUtilisateurs = droits.admin;

  // LES TROIS ROLES D'ENCADREMENT DONNENT LE MEME PERIMETRE. Chef de site, chef de
  // vente VN, chef de vente VO : la distinction est une information
  // d'organisation, pas une graduation de droits. Inventer une graduation que le
  // metier ne demande pas produit des refus incomprehensibles.
  for (const e of verifier(encadrements)) droits.sitesEncadres.push(txt(e.site_id));

  for (const r of verifier(parCampagne)) {
    const campagne = txt(r.campagne_id);
    if (r.role === 'chef_plaque' && r.plaque_id !== null) {
      ajouter(droits.plaquesParCampagne, campagne, txt(r.plaque_id));
    }
    if (r.role === 'chef_site' && r.site_id !== null) {
      ajouter(droits.sitesParCampagne, campagne, txt(r.site_id));
    }
  }

  for (const t of verifier(tables)) {
    const session = t.session_plaque as unknown as { campagne_id: number } | null;
    if (session) ajouter(droits.tablesParCampagne, txt(session.campagne_id), txt(t.id));
  }

  return droits;
}

/// Le compte metier derriere `auth.uid()`.
///
/// `utilisateur_courant()` est la MEME fonction que celle dont dependent les 48
/// politiques. On la lit plutot que de rejouer la jointure ici : deux chemins vers
/// la meme reponse finiraient par diverger, et c'est celui de la base qui fait foi.
async function compteCourant(): Promise<Utilisateur | null> {
  const { data: id, error } = await supabase.rpc('utilisateur_courant');
  if (error || id === null || id === undefined) return null;

  // `password_hash` et `auth_uid` ne sont accordes a personne : demander la ligne
  // entiere par `*` echouerait en `42501` sur la table. Les colonnes sont donc
  // nommees, et c'est une contrainte permanente sur cette table.
  const reponse = await supabase
    .from('utilisateur')
    .select('id, login_id, nom, actif, doit_changer_mdp')
    .eq('id', id as number)
    .maybeSingle();

  const ligne = verifier(reponse);
  if (!ligne) return null;
  return {
    id: txt(ligne.id),
    loginId: ligne.login_id,
    nom: ligne.nom,
    actif: ligne.actif,
    doitChangerMdp: ligne.doit_changer_mdp === true,
  };
}

/// CHANGER SON PROPRE MOT DE PASSE — sans Edge Function : Supabase Auth laisse un
/// compte connecte changer le sien. Puis la base retire l'obligation de le
/// choisir et consigne le geste au journal (`mot_de_passe_choisi`).
///
/// 6 caracteres au moins : c'est le reglage du projet Supabase, on le dit avant
/// qu'il refuse.
export async function changerMonMotDePasse(nouveau: string): Promise<void> {
  if (nouveau.length < 6) {
    throw new ErreurApi('Le mot de passe doit faire au moins 6 caractères.', 400);
  }
  const { error } = await supabase.auth.updateUser({ password: nouveau });
  if (error) {
    const memeQueAvant = /different|same/i.test(error.message ?? '');
    throw new ErreurApi(
      memeQueAvant
        ? 'Ce mot de passe est celui que vous avez déjà : en choisir un autre.'
        : 'Le mot de passe n’a pas pu être changé. Réessayer dans un instant.',
      error.status ?? 400,
      error
    );
  }
  verifier(await supabase.rpc('mot_de_passe_choisi'));
}

/// Traduit une erreur de Supabase Auth en un message qui dit CE QUI S'EST PASSE.
/// Quatre cas, et seul le premier met en cause le mot de passe.
function messageConnexion(erreur: { status?: number; code?: string; name?: string; message?: string }): string {
  const code = erreur.code ?? '';
  const statut = erreur.status ?? 0;
  if (code === 'invalid_credentials' || (statut === 400 && /invalid/i.test(erreur.message ?? ''))) {
    return 'Identifiant ou mot de passe incorrect.';
  }
  if (statut === 429 || /rate.?limit/i.test(code + (erreur.message ?? ''))) {
    return 'Trop de connexions en même temps depuis ce réseau. Patienter une minute, puis réessayer — le mot de passe n’est pas en cause.';
  }
  if (statut === 0 || erreur.name === 'AuthRetryableFetchError' || /fetch|network/i.test(erreur.message ?? '')) {
    return 'Le service ne répond pas (réseau ou serveur). Réessayer dans un instant — le mot de passe n’est pas en cause.';
  }
  if (statut >= 500) {
    return 'Le service de connexion est momentanément indisponible. Réessayer dans un instant — le mot de passe n’est pas en cause.';
  }
  return 'Identifiant ou mot de passe incorrect.';
}

export async function connexion(loginId: string, motDePasse: string): Promise<Session> {
  const { error } = await supabase.auth.signInWithPassword({
    email: adresseDeSynthese(loginId),
    password: motDePasse,
  });

  if (error) {
    // Le message brut de Supabase est en anglais et parle d'e-mail, alors que
    // l'ecran demande un identifiant. On ne le montre pas tel quel.
    //
    // MAIS ON NE DIT « MOT DE PASSE INCORRECT » QUE QUAND C'EST LE CAS (03/10/2026).
    // Toute erreur s'affichait ainsi — y compris le service d'authentification
    // affame du 08/09, un reseau coupe ou une limite de debit. L'utilisateur
    // retapait un mot de passe juste, concluait qu'il avait change, et la
    // reinitialisation demandee a un administrateur faisait le reste : c'est
    // l'explication la plus probable des « mots de passe qui se reinitialisent
    // tout seuls ».
    throw new ErreurApi(messageConnexion(error), error.status ?? 401, error);
  }

  const session = await sessionCourante();
  if (!session) {
    // CAS REEL A TRAITER : l'authentification Supabase a reussi, mais aucun compte
    // metier ne porte cet `auth_uid`, ou il est desactive. L'un ou l'autre laisse
    // une session Supabase valide et zero droit — l'utilisateur verrait des ecrans
    // vides sans comprendre. On referme la session et on le dit.
    await supabase.auth.signOut();
    throw new ErreurApi(
      "Ce compte existe mais n'est rattache a aucun profil actif. Contacter un administrateur.",
      403
    );
  }
  return session;
}

/// Rend `null` si personne n'est connecte, plutot que de lever : c'est l'etat
/// normal au premier chargement de l'application.
export async function sessionCourante(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  const utilisateur = await compteCourant();
  if (!utilisateur) return null;

  return { utilisateur, droits: await chargerDroits(utilisateur.id) };
}

export const deconnexion = () => supabase.auth.signOut();
