import { createClient } from '@supabase/supabase-js';

// ============================================================================
// LE CLIENT SUPABASE — seul point de contact avec la base.
//
// Il n'y a plus d'API. Le navigateur parle directement a PostgREST pour les
// lectures et les ecritures simples, et appelle des fonctions `security definer`
// pour tout ce qui doit etre transactionnel.
//
// LES DEUX VARIABLES PARTENT DANS LE BUNDLE, ET C'EST NORMAL. La cle
// `publishable` est publique par conception : n'importe qui peut la lire dans les
// outils de developpement. Ce n'est pas un secret mal garde, c'est un identifiant
// de projet. **Ce qui protege, c'est la RLS** — 48 politiques, verifiees dans les
// deux sens par `test:rls`. Si cette suite est rouge, la cle devient un probleme ;
// tant qu'elle est verte, elle n'en est pas un.
//
// `schema: 'relance'` une fois pour toutes : sans cela, chaque appel viserait
// `public`, ou vivent les objets de Supabase et aucune de nos tables.
// ============================================================================

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY;

/// LA CONFIGURATION EST-ELLE LA ? On le DIT, on ne s'effondre pas.
///
/// Une premiere version levait une exception ici, au chargement du module. C'etait
/// « bruyant » dans la console — et une PAGE BLANCHE a l'ecran, parce qu'une
/// exception a l'import empeche React de monter. Constate en vrai sur le premier
/// deploiement Cloudflare : fond degrade, rien d'autre, aucune indication.
///
/// C'est exactement le mode d'echec que ce produit combat partout ailleurs. Le
/// diagnostic est donc EXPOSE, et `index.tsx` affiche un ecran qui explique quoi
/// faire au lieu de ne rien afficher du tout.
///
/// PIEGE DE FOND, et il vaut d'etre retenu : les variables `VITE_*` sont figees
/// DANS LE BUNDLE AU MOMENT DU BUILD. Les declarer comme variables d'execution
/// cote Cloudflare ne sert a RIEN — un fichier statique deja compile ne les lira
/// jamais. Elles doivent etre des variables de BUILD.
export const configurationSupabase = {
  url,
  cle,
  complete: Boolean(url && cle),
  manquantes: [!url && 'VITE_SUPABASE_URL', !cle && 'VITE_SUPABASE_ANON_KEY'].filter(
    Boolean
  ) as string[],
};

/// `createClient` refuse une URL vide. Quand la configuration manque, l'application
/// n'est de toute facon jamais montee — `index.tsx` affiche l'ecran de diagnostic a
/// la place — donc ce client n'est jamais utilise.
export const supabase = configurationSupabase.complete
  ? createClient(url, cle, {
      db: { schema: 'relance' },
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : (null as unknown as ReturnType<typeof createClient>);

// ---------------------------------------------------------------- les erreurs

/// Conservee A L'IDENTIQUE depuis l'epoque de l'API HTTP, y compris `statut` et
/// `corps`. Les ecrans s'en servent — `Campagne.tsx` lit `corps` sur un 409 pour
/// afficher les RDV impactes par R-A.2. Changer cette forme aurait oblige a
/// reecrire des ecrans qui n'avaient aucune raison de bouger.
export class ErreurApi<T = unknown> extends Error {
  constructor(
    message: string,
    readonly statut: number,
    readonly corps?: T
  ) {
    super(message);
  }
}

/// Les triggers et les fonctions prefixent leurs messages par `RELANCE:`. Ce
/// prefixe distingue un message ECRIT POUR UN HUMAIN d'une erreur technique, et il
/// est retire avant affichage — l'utilisateur n'a pas a le voir.
///
/// Meme regle que `backend/src/utils/messageTrigger.ts`, cote navigateur cette
/// fois : le prefixe traverse desormais PostgREST au lieu d'Express.
const PREFIXE = /RELANCE:\s*/;

export const messageLisible = (brut: string | undefined | null): string | null => {
  if (!brut) return null;
  const trouve = PREFIXE.exec(brut);
  if (!trouve) return null;
  return brut.slice(trouve.index + trouve[0].length).trim();
};

/// Traduit une erreur PostgREST en `ErreurApi`, avec un statut qui a le meme sens
/// qu'avant pour les ecrans.
///
/// LE CAS QUI COMPTE : un refus de POLITIQUE RLS est SILENCIEUX en lecture (zero
/// ligne, aucune erreur) mais BRUYANT en ecriture (`42501`). On le traduit en 403
/// avec un message utile, plutot que de laisser remonter « new row violates
/// row-level security policy », que personne ne peut interpreter.
export function erreurApi(erreur: {
  message?: string;
  code?: string;
  details?: string | null;
}): ErreurApi {
  const metier = messageLisible(erreur.message);
  if (metier) return new ErreurApi(metier, 409, erreur);

  switch (erreur.code) {
    case '42501':
      return new ErreurApi(
        "Cette action n'est pas autorisee sur votre perimetre.",
        403,
        erreur
      );
    case '23505':
      return new ErreurApi('Cet element existe deja.', 409, erreur);
    case '23503':
      return new ErreurApi(
        "Cet element est rattache a autre chose : il ne peut pas etre modifie ainsi.",
        409,
        erreur
      );
    case 'PGRST301':
    case '401':
      return new ErreurApi('Session expiree. Se reconnecter.', 401, erreur);
    default:
      return new ErreurApi(erreur.message ?? 'Erreur inattendue.', 500, erreur);
  }
}

/// Deballe une reponse PostgREST : rend les donnees, ou leve une `ErreurApi`.
export function verifier<T>(reponse: { data: T | null; error: unknown }): T {
  if (reponse.error) throw erreurApi(reponse.error as { message?: string; code?: string });
  return reponse.data as T;
}

// ---------------------------------------------------------------- identifiants

/// LES CLES PRIMAIRES SONT DES `bigint`, ET LE FRONT LES MANIPULE EN CHAINES.
///
/// PostgREST serialise un `bigint` en NOMBRE JSON. Au-dela de 2^53 la precision se
/// perd en silence — on est tres loin du compte ici, mais le vrai motif est
/// ailleurs : tout le front, tous ses types et toutes ses comparaisons `===`
/// travaillent en chaines depuis le premier jour. Melanger les deux ferait echouer
/// des egalites sans lever la moindre erreur.
///
/// La conversion se fait donc A LA FRONTIERE, ici, et nulle part ailleurs.
export const txt = (v: number | string | bigint | null | undefined): string =>
  v === null || v === undefined ? '' : String(v);

export const txtOuNull = (v: number | string | bigint | null | undefined): string | null =>
  v === null || v === undefined ? null : String(v);

// ---------------------------------------------------------------- pagination

/// LA LIMITE DE LIGNES DE POSTGREST TRONQUE **SANS ERREUR**.
///
/// Le reglage par defaut est 1000 lignes. Juin 2026 en compte 1107 : le tableau de
/// bord aurait affiche des totaux faux, sans le moindre signal. C'est exactement
/// le defaut du fichier Excel que ce produit remplace — 677 references figees vers
/// des totaux maintenus a la main.
///
/// Le reglage a ete porte a 5000 cote Supabase, MAIS ON NE S'EN CONTENTE PAS : un
/// reglage de tableau de bord n'est pas une garantie, il se perd a la recreation
/// d'un projet et personne ne le remarque. Cette fonction pagine, puis **compare
/// au compte exact** et LEVE si les deux divergent.
///
/// Preferer une panne visible a un chiffre faux : c'est toute la raison d'etre de
/// l'outil.
const PAGE = 1000;

export async function toutesLesLignes<T>(
  construire: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>
): Promise<T[]> {
  const lignes: T[] = [];
  let de = 0;
  let attendu: number | null = null;

  for (;;) {
    const reponse = await construire(de, de + PAGE - 1);
    if (reponse.error) throw erreurApi(reponse.error as { message?: string; code?: string });
    const page = reponse.data ?? [];
    if (attendu === null) attendu = reponse.count;
    lignes.push(...page);
    if (page.length < PAGE) break;
    de += PAGE;
  }

  if (attendu !== null && lignes.length !== attendu) {
    throw new ErreurApi(
      `Lecture incomplete : ${lignes.length} lignes recuperees sur ${attendu} annoncees. ` +
        'Les totaux seraient faux — aucun chiffre ne sera affiche.',
      500
    );
  }
  return lignes;
}
