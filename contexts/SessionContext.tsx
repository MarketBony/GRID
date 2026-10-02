import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '../types';
import { connexion as connexionApi, deconnexion as deconnexionApi, sessionCourante } from '../services/api';
import { supabase } from '../services/supabase';

interface ValeurContexte {
  session: Session | null;
  chargement: boolean;
  connexion: (loginId: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
  /// Relit les droits en base. A appeler apres toute action susceptible de
  /// changer un perimetre — recomposition de table, cloture de campagne — parce
  /// que les droits sont PAR CAMPAGNE et peuvent bouger en pleine session.
  rafraichir: () => Promise<void>;
}

const Contexte = createContext<ValeurContexte | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [chargement, setChargement] = useState(true);

  const rafraichir = useCallback(async () => {
    try {
      setSession(await sessionCourante());
    } catch {
      // Jeton perime, compte desactive, ou base injoignable. `sessionCourante`
      // rend deja `null` dans les cas normaux ; ce `catch` couvre le reste.
      setSession(null);
    }
  }, []);

  useEffect(() => {
    rafraichir().finally(() => setChargement(false));
  }, [rafraichir]);

  // ON SUIT SUPABASE, ON NE SE CONTENTE PAS DE LIRE UNE FOIS.
  //
  // Le jeton se renouvelle tout seul (`autoRefreshToken`), et une deconnexion dans
  // un AUTRE onglet doit se propager ici — sinon l'ecran reste affiche alors que
  // plus aucune requete ne passe, et l'utilisateur voit des paniques sans rapport.
  // Le module C reste ouvert des heures pendant une session : ce cas n'est pas
  // theorique.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'SIGNED_OUT') setSession(null);
      // `TOKEN_REFRESHED` NE RECHARGE PLUS LES DROITS (03/10/2026). Un jeton
      // renouvele ne change ni le compte ni ses roles ; recharger coutait cinq
      // requetes par poste et par heure, et supabase-js renouvelle aussi au retour
      // sur l'onglet. Une connexion, elle, change tout : on recharge.
      if (evenement === 'SIGNED_IN') void rafraichir();
    });
    return () => data.subscription.unsubscribe();
  }, [rafraichir]);

  const connexion = useCallback(async (loginId: string, motDePasse: string) => {
    setSession(await connexionApi(loginId, motDePasse));
  }, []);

  const deconnexion = useCallback(async () => {
    await deconnexionApi();
    setSession(null);
  }, []);

  const valeur = useMemo(
    () => ({ session, chargement, connexion, deconnexion, rafraichir }),
    [session, chargement, connexion, deconnexion, rafraichir]
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): ValeurContexte {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error('useSession doit etre utilise dans FournisseurSession');
  return valeur;
}
