import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '../types';
import { connexion as connexionApi, effacerJeton, lireJeton, sessionCourante } from '../services/api';

interface ValeurContexte {
  session: Session | null;
  chargement: boolean;
  connexion: (loginId: string, motDePasse: string) => Promise<void>;
  deconnexion: () => void;
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
    if (!lireJeton()) {
      setSession(null);
      return;
    }
    try {
      setSession(await sessionCourante());
    } catch {
      // Jeton perime ou compte desactive : `api.ts` a deja efface le jeton.
      setSession(null);
    }
  }, []);

  useEffect(() => {
    rafraichir().finally(() => setChargement(false));
  }, [rafraichir]);

  const connexion = useCallback(async (loginId: string, motDePasse: string) => {
    setSession(await connexionApi(loginId, motDePasse));
  }, []);

  const deconnexion = useCallback(() => {
    effacerJeton();
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
