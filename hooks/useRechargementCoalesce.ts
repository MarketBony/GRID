import { useCallback, useEffect, useRef } from 'react';

// ============================================================================
// RECHARGEMENT REGROUPE — ecrit pendant l'incident du 08/09/2026, en session.
//
// LE DEFAUT : le temps reel diffuse UN evenement par RDV a TOUS les postes
// connectes, et chaque poste repondait par un rechargement COMPLET. Le cout est
// donc le produit du nombre de saisies par le nombre de spectateurs — pas leur
// somme. Mesure ce jour-la : 258 RDV/heure, ~25 postes, ~17 requetes par
// rechargement, soit 65 000 requetes/heure sur un pool PostgREST de 10
// connexions. Le pool sature, les requetes attendent, et TOUT LE MONDE voit une
// page qui ne charge plus — y compris ceux qui ne font que saisir.
//
// Pire que le volume : les 25 postes repondaient AU MEME MILLIEME DE SECONDE,
// puisqu'ils reagissent au meme message. Une meute, pas une charge.
//
// CE HOOK REPOND AUX DEUX :
//   - il REGROUPE — tant qu'un rechargement est programme, les evenements
//     suivants ne programment rien de plus. N evenements dans la fenetre coutent
//     un seul rechargement, et il lit forcement l'etat final ;
//   - il DISPERSE — une gigue aleatoire jusqu'a la moitie de la fenetre casse le
//     synchronisme. Sans elle, regrouper ne ferait que decaler la meute.
//
// CE QU'ON PERD, ET C'EST ASSUME : la saisie d'un collegue apparait au bout de la
// fenetre au lieu d'apparaitre tout de suite. Le critere de recette n.5 reste
// tenu — les compteurs de l'autre bougent — avec un delai. La saisie de
// l'utilisateur, elle, n'est PAS concernee : elle s'affiche immediatement, en
// memoire, sans passer par ici.
// ============================================================================

export function useRechargementCoalesce(action: () => void, fenetreMs: number) {
  // L'action est reconstruite a chaque rendu et capture l'etat courant : on la
  // garde dans une ref pour que le minuteur deja arme execute la DERNIERE
  // version, jamais celle qui existait au moment de l'armement.
  const actionRef = useRef(action);
  actionRef.current = action;

  const minuteur = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    },
    []
  );

  return useCallback(() => {
    // Deja programme : cet evenement est absorbe. C'est tout l'objet du hook.
    if (minuteur.current !== null) return;
    const gigue = Math.random() * fenetreMs * 0.5;
    minuteur.current = window.setTimeout(() => {
      minuteur.current = null;
      actionRef.current();
    }, fenetreMs + gigue);
  }, [fenetreMs]);
}

/// Fenetres retenues, en millisecondes. Elles sont ici et pas dans les ecrans :
/// deux ecrans qui choisiraient deux valeurs pour la meme chose, c'est la
/// prochaine derive.
///
/// LE PERIMETRE est ce que l'utilisateur regarde et sur quoi il travaille : court.
/// LA VUE D'ENSEMBLE est un confort de groupe, et elle coute le plus cher
/// (agregats sur toute la campagne) : longue.
export const FENETRE_PERIMETRE = 8_000;
export const FENETRE_VUE_ENSEMBLE = 30_000;
