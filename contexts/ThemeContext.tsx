import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// ============================================================================
// THEME CLAIR / SOMBRE — meme mecanique que GEARBOX.
//
// La classe `dark` est posee sur <html>, et toute la charte est en variables CSS :
// basculer ne change qu'un jeu de tokens, aucun composant n'a besoin de connaitre
// le theme.
//
// `index.html` porte `class="dark"` en dur : c'est ce qui evite un flash blanc au
// premier rendu avant que ce contexte ne s'execute. La preference sauvegardee est
// ensuite appliquee.
//
// SOMBRE PAR DEFAUT, et c'est un choix metier : le module C sera affiche des
// heures d'affilee pendant une session de phoning, et souvent projete sur un ecran
// collectif dans une salle. Un fond clair plein ecran fatigue.
// ============================================================================

type Theme = 'clair' | 'sombre';

const CLE = 'relance.theme';

interface ValeurContexte {
  theme: Theme;
  basculer: () => void;
}

const Contexte = createContext<ValeurContexte | null>(null);

export function FournisseurTheme({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const sauvegarde = localStorage.getItem(CLE);
    return sauvegarde === 'clair' || sauvegarde === 'sombre' ? sauvegarde : 'sombre';
  });

  useEffect(() => {
    const racine = document.documentElement;
    racine.classList.toggle('dark', theme === 'sombre');
    // Alignee sur --bg-main des deux themes.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'sombre' ? '#121212' : '#f1f5f9');
    localStorage.setItem(CLE, theme);
  }, [theme]);

  const basculer = useCallback(() => {
    setTheme((t) => (t === 'sombre' ? 'clair' : 'sombre'));
  }, []);

  const valeur = useMemo(() => ({ theme, basculer }), [theme, basculer]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useTheme(): ValeurContexte {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error('useTheme doit etre utilise dans FournisseurTheme');
  return valeur;
}
