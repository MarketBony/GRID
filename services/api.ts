import type { Session } from '../types';

// ============================================================================
// CLIENT HTTP.
//
// Toutes les URL sont RELATIVES (`/api/...`). En developpement, Vite proxifie
// vers le backend sur 3001 ; en production, Caddy sert le front et l'API sous le
// meme domaine. Le code du front ne connait donc aucune URL d'API et se comporte
// a l'identique dans les deux environnements — il n'y a pas de variable
// `VITE_API_URL` a se tromper de valeur.
// ============================================================================

const CLE_JETON = 'relance.jeton';

export const lireJeton = () => localStorage.getItem(CLE_JETON);
export const ecrireJeton = (jeton: string) => localStorage.setItem(CLE_JETON, jeton);
export const effacerJeton = () => localStorage.removeItem(CLE_JETON);

/// Identifiant du socket temps reel, injecte dans chaque requete pour que le
/// serveur ne renvoie pas a son auteur l'evenement qu'il vient de provoquer.
let socketId: string | null = null;
export const definirSocketId = (id: string | null) => {
  socketId = id;
};

export class ErreurApi<T = unknown> extends Error {
  constructor(
    message: string,
    readonly statut: number,
    /// Corps complet de la reponse. Indispensable pour R-A.2 : le 409 transporte
    /// la liste des RDV impactes et les jours conserves, dont l'ecran a besoin
    /// pour proposer un choix. Une erreur reduite a son message obligerait a
    /// redemander l'information au serveur.
    readonly corps?: T
  ) {
    super(message);
  }
}

async function appeler<T>(methode: string, chemin: string, corps?: unknown): Promise<T> {
  const entetes: Record<string, string> = {};
  const jeton = lireJeton();
  if (jeton) entetes['Authorization'] = `Bearer ${jeton}`;
  if (corps !== undefined) entetes['Content-Type'] = 'application/json';
  if (socketId) entetes['x-socket-id'] = socketId;

  const reponse = await fetch(chemin, {
    method: methode,
    headers: entetes,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });

  if (reponse.status === 401) {
    // Jeton absent, invalide ou expire : on nettoie pour que l'application
    // reparte sur l'ecran de connexion plutot que de boucler sur des 401.
    effacerJeton();
  }

  if (!reponse.ok) {
    let message = `Erreur ${reponse.status}`;
    let corps: unknown;
    try {
      corps = await reponse.json();
      const donnees = corps as { message?: unknown };
      if (typeof donnees?.message === 'string') message = donnees.message;
    } catch {
      // Reponse non JSON : on garde le message par defaut.
    }
    throw new ErreurApi(message, reponse.status, corps);
  }

  if (reponse.status === 204) return undefined as T;
  return (await reponse.json()) as T;
}

export const apiGet = <T>(chemin: string) => appeler<T>('GET', chemin);
export const apiPost = <T>(chemin: string, corps?: unknown) => appeler<T>('POST', chemin, corps);
export const apiPatch = <T>(chemin: string, corps?: unknown) => appeler<T>('PATCH', chemin, corps);
export const apiPut = <T>(chemin: string, corps?: unknown) => appeler<T>('PUT', chemin, corps);

/// `DELETE` n'existait pas : rien n'en avait besoin, l'interdit n.1 refusant toute
/// suppression. La purge definitive d'un vendeur archive est la SEULE operation du
/// produit qui en emploie une — voir `purgerVendeur`.
export const apiDelete = <T>(chemin: string, corps?: unknown) =>
  appeler<T>('DELETE', chemin, corps);

// ---------------------------------------------------------------- auth

export async function connexion(loginId: string, motDePasse: string): Promise<Session> {
  const reponse = await apiPost<Session & { jeton: string }>('/api/auth/login', {
    loginId,
    motDePasse,
  });
  ecrireJeton(reponse.jeton);
  return { utilisateur: reponse.utilisateur, droits: reponse.droits };
}

export const sessionCourante = () => apiGet<Session>('/api/auth/moi');
