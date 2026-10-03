import { useEffect } from 'react';

// ============================================================================
// L'ENTREE DANS GRID — joue UNE fois, juste apres une connexion reussie (pas a
// chaque rechargement : un poste qui recharge en pleine seance ne doit pas
// attendre une animation).
//
// Trois temps, 1,6 s en tout :
//   1. le G jaillit au ressort, le mot GRID se pose dessous ;
//   2. les trainees de vitesse du logotype partent en etoile ;
//   3. on TRAVERSE le G : il grossit jusqu'a sortir de l'ecran pendant que le
//      voile s'efface sur l'interface, dont les cartes font leur propre entree.
//
// Le logotype reste `public/grid.svg` (source unique, CLAUDE.md).
// ============================================================================

const CLE = 'grid.intro';
const DUREE = 1650;

/// A appeler juste avant la connexion : la prochaine ouverture de session joue l'entree.
export const armerIntro = () => {
  try {
    sessionStorage.setItem(CLE, '1');
  } catch {
    /* stockage indisponible : pas d'entree, rien de grave */
  }
};

/// Vrai une seule fois apres `armerIntro`, et jamais si l'utilisateur a demande
/// moins d'animations.
export const consommerIntro = (): boolean => {
  try {
    const arme = sessionStorage.getItem(CLE) === '1';
    sessionStorage.removeItem(CLE);
    const reduit =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('animations-reduites');
    return arme && !reduit;
  } catch {
    return false;
  }
};

export function IntroGrid({ onFin }: { onFin: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onFin, DUREE);
    return () => window.clearTimeout(t);
  }, [onFin]);

  return (
    <div className="intro-grid" aria-hidden="true">
      <div className="intro-eclats">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ ['--a' as string]: `${i * 20 + (i % 2) * 7}deg`, ['--d' as string]: `${(i % 3) * 40}ms` }} />
        ))}
      </div>
      <div className="intro-centre">
        <img className="intro-logo" src="/grid.svg" alt="" />
        <span className="intro-mot">GRID</span>
      </div>
    </div>
  );
}
