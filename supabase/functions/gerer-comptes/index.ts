// ============================================================================
// `gerer-comptes` — LE SEUL CODE SERVEUR QUI SUBSISTE DANS GRID.
//
// POURQUOI IL EXISTE. Creer un compte suppose de creer une identite Supabase
// Auth, ce qui exige la cle `service_role`. Cette cle CONTOURNE TOUTE LA RLS :
// elle ne doit jamais se trouver dans le navigateur, pas une seconde. Tout le
// reste du produit se passe de serveur ; ces trois operations non.
//
// Son perimetre est donc volontairement etroit — trois actions, et rien d'autre.
//
// ---------------------------------------------------------------------------
// LE CONTROLE D'ACCES EST FAIT ICI, ET IL N'EST PAS OPTIONNEL
// ---------------------------------------------------------------------------
// Cette fonction s'execute avec `service_role` : la RLS ne la protege de RIEN.
// Elle doit donc verifier elle-meme que son appelant est `admin`, et elle le fait
// avec le jeton de l'appelant — jamais avec la cle de service.
//
// Deux clients distincts, et la distinction est tout le sujet :
//
//   `appelant` — cle PUBLIQUE + jeton de l'appelant. Sert UNIQUEMENT a demander
//                a la base « qui es-tu, et as-tu le droit ? ». La reponse vient
//                des memes fonctions que les 48 politiques.
//
//   `service`  — cle de service. Ne sert QU'APRES la reponse, et seulement pour
//                ce que PostgREST ne peut pas faire.
//
// Les melanger reviendrait a se demander a soi-meme la permission.
//
// ---------------------------------------------------------------------------
// L'ADRESSE EST UNE SYNTHESE
// ---------------------------------------------------------------------------
// Supabase Auth exige un e-mail, nos comptes ont un identifiant. On compose
// `<loginId>@grid.bonyauto-mobile.com`. CE DOMAINE NE RECOIT RIEN — aucun message
// ne partira jamais vers ces adresses, et c'est pourquoi la confirmation d'e-mail
// est desactivee cote projet. La meme composition existe dans `services/api.ts`,
// cote navigateur : les deux doivent rester d'accord.
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DOMAINE = 'grid.bonyauto-mobile.com';
const adresse = (loginId: string) => `${loginId.trim().toLowerCase()}@${DOMAINE}`;

const URL_PROJET = Deno.env.get('SUPABASE_URL')!;
const CLE_PUBLIQUE = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ENTETES = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reponse = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: ENTETES });

/// Un mot de passe lisible et solide. 18 caracteres tires d'un alphabet sans
/// ambiguite visuelle — ni `l`/`1`, ni `O`/`0` : ces mots de passe sont lus a voix
/// haute et recopies a la main, et une confusion coute un appel.
function motDePasseGenere(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const octets = crypto.getRandomValues(new Uint8Array(18));
  return [...octets].map((o) => alphabet[o % alphabet.length]).join('');
}

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: ENTETES });

  try {
    const jeton = requete.headers.get('Authorization') ?? '';
    if (!jeton.startsWith('Bearer ')) {
      return reponse({ erreur: 'Authentification requise.' }, 401);
    }

    // ---- 1. QUI APPELLE, ET A-T-IL LE DROIT ? --------------------------------
    // Avec la cle PUBLIQUE et le jeton de l'appelant : c'est la base qui repond,
    // par les memes fonctions que les politiques.
    const appelant = createClient(URL_PROJET, CLE_PUBLIQUE, {
      global: { headers: { Authorization: jeton } },
      auth: { persistSession: false },
    });

    const { data: peut, error: erreurDroit } = await appelant
      .schema('relance')
      .rpc('peut_gerer_utilisateurs');

    // ON REFUSE DES QU'ON NE PEUT PAS ETABLIR LE DROIT — jamais l'inverse.
    //
    // Il y a plusieurs facons d'echouer ici : jeton absent, jeton expire, ou
    // simplement la cle publique presentee a la place d'une session — auquel cas
    // l'appelant est vu comme `anon`, qui n'a aucun droit d'executer la fonction.
    // Distinguer ces cas pour repondre finement serait un raffinement inutile et
    // risque : le seul comportement sur lequel on ne peut pas se tromper est le
    // REFUS.
    //
    // Une premiere version repondait 500 « impossible de verifier vos droits »,
    // ce qui envoyait chercher une panne la ou il n'y avait qu'une absence de
    // session. Le detail reste dans les journaux de la fonction.
    if (erreurDroit || peut !== true) {
      if (erreurDroit) console.error('gerer-comptes : droit non etabli', erreurDroit);
      // `admin` SEUL. C'est la frontiere qui empeche `direction` de se promouvoir,
      // et elle est verifiee ici comme partout ailleurs.
      return reponse({ erreur: 'La gestion des comptes est reservee aux administrateurs.' }, 403);
    }

    // ---- 2. L'ACTION ---------------------------------------------------------
    const service = createClient(URL_PROJET, CLE_SERVICE, { auth: { persistSession: false } });
    const corps = await requete.json().catch(() => ({}));
    const action = String(corps.action ?? '');

    if (action === 'creer') {
      const nom = String(corps.nom ?? '').trim();
      const loginId = String(corps.loginId ?? '').trim().toLowerCase();
      const roleGlobal = corps.roleGlobal ?? null;

      if (!nom || !loginId) {
        return reponse({ erreur: 'Le nom et l\'identifiant sont requis.' }, 400);
      }
      if (!/^[a-z0-9._-]+$/.test(loginId)) {
        return reponse(
          { erreur: 'L\'identifiant ne peut contenir que des lettres, chiffres, point, tiret et souligne.' },
          400
        );
      }
      if (roleGlobal !== null && !['admin', 'direction', 'lecteur'].includes(roleGlobal)) {
        return reponse({ erreur: 'Role inconnu : admin, direction ou lecteur.' }, 400);
      }

      const genere = !corps.motDePasse;
      const motDePasse = String(corps.motDePasse ?? motDePasseGenere());
      if (motDePasse.length < 12) {
        return reponse({ erreur: 'Le mot de passe doit faire au moins 12 caracteres.' }, 400);
      }

      // L'identite d'abord. Si l'insertion metier echoue ensuite, on la retire —
      // une identite orpheline pourrait se connecter sans profil, et l'ecran de
      // connexion la renverrait vers un administrateur sans que personne comprenne.
      const { data: identite, error: erreurIdentite } = await service.auth.admin.createUser({
        email: adresse(loginId),
        password: motDePasse,
        email_confirm: true,
      });
      if (erreurIdentite || !identite?.user) {
        const message = erreurIdentite?.message ?? '';
        return reponse(
          {
            erreur: message.toLowerCase().includes('already')
              ? `L'identifiant « ${loginId} » est deja pris.`
              : `Creation de l'identite impossible : ${message}`,
          },
          409
        );
      }

      const { data: cree, error: erreurMetier } = await service
        .schema('relance')
        .from('utilisateur')
        .insert({
          login_id: loginId,
          nom,
          // `password_hash` est NOT NULL et n'a plus d'usage : l'authentification
          // par bcrypt a disparu avec l'API. La colonne part au prochain
          // nettoyage ; en attendant, une valeur qui dit ce qu'elle est.
          password_hash: '(supabase-auth)',
          auth_uid: identite.user.id,
          actif: true,
        })
        .select('id')
        .single();

      if (erreurMetier || !cree) {
        await service.auth.admin.deleteUser(identite.user.id);
        const message = erreurMetier?.message ?? '';
        return reponse(
          {
            erreur: message.includes('duplicate') || message.includes('unique')
              ? `L'identifiant « ${loginId} » est deja pris.`
              : `Creation du compte impossible : ${message}`,
          },
          409
        );
      }

      if (roleGlobal !== null) {
        const { error: erreurRole } = await service
          .schema('relance')
          .from('role_global')
          .insert({ utilisateur_id: cree.id, role: roleGlobal });
        if (erreurRole) {
          return reponse(
            { erreur: `Compte cree, mais le role n'a pas pu etre attribue : ${erreurRole.message}` },
            409
          );
        }
      }

      // Le mot de passe revient en clair LA SEULE FOIS. Il n'est ni journalise ni
      // stocke autrement que hache par Supabase : personne ne pourra le relire.
      return reponse({ utilisateurId: String(cree.id), motDePasse, genere });
    }

    if (action === 'mot-de-passe') {
      const utilisateurId = Number(corps.utilisateurId);
      if (!utilisateurId) return reponse({ erreur: 'utilisateurId est requis.' }, 400);

      const genere = !corps.motDePasse;
      const motDePasse = String(corps.motDePasse ?? motDePasseGenere());
      if (motDePasse.length < 12) {
        return reponse({ erreur: 'Le mot de passe doit faire au moins 12 caracteres.' }, 400);
      }

      const { data: compte, error } = await service
        .schema('relance')
        .from('utilisateur')
        .select('nom, auth_uid')
        .eq('id', utilisateurId)
        .single();

      if (error || !compte) return reponse({ erreur: 'Compte introuvable.' }, 404);
      if (!compte.auth_uid) {
        return reponse(
          {
            erreur:
              "Ce compte n'est relie a aucune identite : il n'a jamais pu se connecter. " +
              'Le relier par `comptes-auth` avant de lui donner un mot de passe.',
          },
          409
        );
      }

      const { error: erreurMaj } = await service.auth.admin.updateUserById(compte.auth_uid, {
        password: motDePasse,
      });
      if (erreurMaj) return reponse({ erreur: erreurMaj.message }, 500);

      return reponse({ nom: compte.nom, motDePasse, genere });
    }

    if (action === 'supprimer-identite') {
      const utilisateurId = Number(corps.utilisateurId);
      if (!utilisateurId) return reponse({ erreur: 'utilisateurId est requis.' }, 400);

      const { data: compte } = await service
        .schema('relance')
        .from('utilisateur')
        .select('auth_uid')
        .eq('id', utilisateurId)
        .maybeSingle();

      // Pas d'identite : ce n'est PAS une erreur. La suppression de la ligne
      // metier suivra, et elle porte ses propres verrous (historique vide, nom
      // exact retape) dans `relance.utilisateur_purger`.
      if (compte?.auth_uid) {
        const { error } = await service.auth.admin.deleteUser(compte.auth_uid);
        if (error) return reponse({ erreur: error.message }, 500);
      }
      return reponse({ supprimee: true });
    }

    return reponse({ erreur: `Action inconnue : ${action}` }, 400);
  } catch (e) {
    // Le detail technique ne remonte pas au navigateur : il finirait affiche a
    // l'utilisateur. Il reste dans les journaux de la fonction.
    console.error('gerer-comptes :', e);
    return reponse({ erreur: 'Erreur inattendue lors de la gestion des comptes.' }, 500);
  }
});
