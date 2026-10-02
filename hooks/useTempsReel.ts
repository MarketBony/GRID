import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';

// ============================================================================
// TEMPS REEL — F-C.10 et critere de recette n.5.
//
// « Deux chefs de table qui saisissent en meme temps ne se bloquent pas et voient
// les compteurs de l'autre se mettre a jour. »
//
// ---------------------------------------------------------------------------
// UN CANAL DE DIFFUSION, PAS UN ABONNEMENT AUX CHANGEMENTS DE TABLE
// ---------------------------------------------------------------------------
// `postgres_changes` aurait ete le reflexe, mais il RESPECTE LA RLS : chaque
// abonne ne recoit que ce qu'il a le droit de lire. Comme la politique de `rdv`
// restreint la lecture au perimetre de saisie — c'est elle qui protege le nom du
// client — un chef de table ne recevrait rien des autres tables, et le compteur du
// tableau de bord cesserait de bouger pour lui. En silence.
//
// La base diffuse donc elle-meme, par le trigger `rdv_diffusion`, une charge utile
// SANS nom de client, sur un canal par campagne. Voir la migration
// `20260831220000_diffusion_realtime`.
//
// ---------------------------------------------------------------------------
// L'AUTEUR N'ECOUTE PAS SON PROPRE EVENEMENT
// ---------------------------------------------------------------------------
// Il a deja applique le changement localement (ecriture immediate, F-C.4). Le lui
// rejouer provoque un second rendu, et pendant une saisie au clavier ce
// scintillement se voit. Du temps de socket.io, le serveur excluait le socket
// emetteur grace a l'en-tete `x-socket-id` ; ici c'est le RECEVEUR qui compare
// l'auteur porte par l'evenement a son propre identifiant. Le resultat est le
// meme, et il y a une pièce mobile de moins.
// ============================================================================

type Gestionnaire = (charge: unknown) => void;

export function useTempsReel(
  campagneId: string | null,
  gestionnaires: Record<string, Gestionnaire>
) {
  // Les gestionnaires changent a chaque rendu ; on les garde dans une ref pour ne
  // pas reconstruire le canal a chaque fois.
  const ref = useRef(gestionnaires);
  ref.current = gestionnaires;

  useEffect(() => {
    if (!campagneId) return;
    let vivant = true;
    let fermer: (() => void) | undefined;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton || !vivant) return;

      // OBLIGATOIRE POUR UN CANAL PRIVE. Sans ce jeton, Realtime refuse
      // l'abonnement — et le refus est silencieux du point de vue de l'ecran : la
      // saisie continue de fonctionner, seuls les compteurs des autres cessent de
      // bouger. C'est exactement le genre de panne qu'on ne remarque qu'en session.
      await supabase.realtime.setAuth(jeton);

      const moi = (await supabase.rpc('utilisateur_courant')).data as number | null;
      let dejaAbonne = false;

      // LE NOM DU CANAL NE CONTIENT PAS DE DEUX-POINTS : Supabase Realtime le
      // reserve a son propre adressage (`realtime:<sujet>`), et un sujet qui en
      // porte un ne s'abonne JAMAIS — sans erreur, sans delai d'attente, en
      // silence. Le nom `campagne:<id>` venait des salles socket.io, ou il ne
      // posait aucun probleme. Voir la migration `20260831230000`.
      const canal = supabase
        .channel(`campagne-${campagneId}`, { config: { private: true } })
        .on('broadcast', { event: 'rdv' }, (message) => {
          const charge = (message.payload ?? {}) as { auteur?: string };
          // L'ECHO LOCAL. Comparaison en chaines des deux cotes : les identifiants
          // sont des `bigint`, et melanger nombre et chaine ferait echouer
          // l'egalite sans lever la moindre erreur — l'auteur verrait alors son
          // propre RDV clignoter.
          if (moi !== null && charge.auteur === String(moi)) return;
          ref.current['rdv:modifie']?.(charge);
        })
        // Une table composee ou recomposee — emis par `diffuser_tables()` depuis le
        // 03/10/2026. Trois ecrans l'ecoutaient deja ; rien ne l'emettait.
        .on('broadcast', { event: 'tables' }, (message) => {
          ref.current['tables:modifiees']?.(message.payload ?? {});
        })
        .subscribe((etat, erreur) => {
          // LE RETOUR APRES UNE COUPURE. Pendant que le canal etait tombe, des
          // messages se sont perdus : l'ecran l'apprend, et se resynchronise.
          // Le premier abonnement n'est pas une reconnexion — rien n'a ete manque.
          if (etat === 'SUBSCRIBED') {
            if (dejaAbonne) ref.current['reconnecte']?.(null);
            dejaAbonne = true;
          }
          // Un echec doit se VOIR quelque part. Il ne remonte pas a l'ecran — le
          // temps reel est un confort, la saisie fonctionne sans lui — mais le
          // silence complet a deja masque une panne sur ce projet.
          if (etat === 'CHANNEL_ERROR' || etat === 'TIMED_OUT') {
            console.warn(
              '[temps reel] abonnement impossible, la saisie reste fonctionnelle :',
              erreur?.message ?? etat
            );
          }
        });

      fermer = () => {
        void supabase.removeChannel(canal);
      };
    })();

    return () => {
      vivant = false;
      fermer?.();
    };
    // `gestionnaires` est volontairement absent des dependances : voir la ref.
  }, [campagneId]);
}
