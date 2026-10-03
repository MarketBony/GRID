import { useEffect, useRef, useState } from 'react';

/// Relance une sonde a intervalle fixe, SEULEMENT quand l'onglet est visible :
/// un poste laisse ouvert toute la nuit ne doit pas occuper le pool pour rien.
/// `erreur` est vrai quand la derniere sonde a echoue (base injoignable,
/// reseau coupe) — l'ancienne mesure reste affichee pour le contexte.
export function useSonde<T>(sonde: () => Promise<T>, periodeMs: number) {
  const [mesure, setMesure] = useState<T | null>(null);
  const [erreur, setErreur] = useState(false);
  const ref = useRef(sonde);
  ref.current = sonde;

  useEffect(() => {
    let vivant = true;
    let minuteur: number | undefined;
    const tour = async () => {
      window.clearTimeout(minuteur);
      if (document.visibilityState === 'visible') {
        try {
          const m = await ref.current();
          if (!vivant) return;
          setMesure(m);
          setErreur(false);
        } catch {
          if (vivant) setErreur(true);
        }
      }
      if (vivant) minuteur = window.setTimeout(tour, periodeMs);
    };
    void tour();
    const reveil = () => document.visibilityState === 'visible' && void tour();
    document.addEventListener('visibilitychange', reveil);
    window.addEventListener('online', reveil);
    const coupe = () => setErreur(true);
    window.addEventListener('offline', coupe);
    return () => {
      vivant = false;
      window.clearTimeout(minuteur);
      document.removeEventListener('visibilitychange', reveil);
      window.removeEventListener('online', reveil);
      window.removeEventListener('offline', coupe);
    };
  }, [periodeMs]);

  return { mesure, erreur };
}
