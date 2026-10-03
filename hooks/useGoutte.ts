import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

// ============================================================================
// LA GOUTTE DE LA NAVIGATION — le mouvement de `maquette-navigation.html`, a
// l'identique (decision de l'utilisateur, 03/10/2026 : « l'Ile, j'adore ses
// animations »).
//
// Deux animations qui se chevauchent, comme dans la maquette :
//   1. la goutte s'ETIRE de sa position vers l'union des deux positions
//      (ease-out, ressort « snappy ») ;
//   2. elle se RESSERRE sur la cible avec le ressort « bouncy » — raideur 360,
//      amortissement 14 (zeta ~ 0,37) : c'est son depassement franc qui fait le
//      geste, et un ressort plus amorti (celui de GRID) l'aplatissait.
//
// Ce n'est PAS un troisieme `useIndicateurGlissant` : celui-la porte la pastille
// des segmentes et le curseur de la liste ; celui-ci porte UNIQUEMENT la
// navigation, a la demande expresse de l'utilisateur. Les ressorts sont figes en
// `linear()`, echantillonnes une fois depuis l'oscillateur amorti de la maquette.
//
// Un redimensionnement (barre qui se retracte) replace la goutte SANS animation :
// c'est ce qui laissait la retraction fluide dans la maquette.
// ============================================================================

const SNAPPY = { ms: 500, css: 'linear(0, 0.029, 0.105, 0.209, 0.328, 0.452, 0.572, 0.683, 0.78, 0.863, 0.93, 0.983, 1.022, 1.049, 1.065, 1.074, 1.076, 1.073, 1.067, 1.059, 1.05, 1.04, 1.031, 1.023, 1.016, 1.01, 1.005, 1.001, 0.998, 0.996, 0.995, 0.994, 0.994, 0.994, 0.995, 0.996, 0.996, 0.997, 0.998, 0.998, 1)' };
const BOUNCY = { ms: 950, css: 'linear(0, 0.09, 0.309, 0.583, 0.851, 1.068, 1.212, 1.28, 1.281, 1.233, 1.16, 1.08, 1.009, 0.957, 0.927, 0.917, 0.925, 0.943, 0.966, 0.988, 1.006, 1.018, 1.023, 1.023, 1.019, 1.013, 1.007, 1.001, 0.996, 0.994, 0.993, 0.994, 0.995, 0.997, 0.999, 1, 1.001, 1.002, 1.002, 1.002, 1)' };

export function useGoutte(cleActive: string) {
  const nav = useRef<HTMLElement | null>(null);
  const goutte = useRef<HTMLSpanElement | null>(null);
  const etat = useRef<{ x: number; w: number } | null>(null);

  const placer = useCallback(
    (anime: boolean) => {
      const n = nav.current;
      const g = goutte.current;
      const cible = n?.querySelector<HTMLElement>(`[data-rubrique="${cleActive}"]`);
      if (!n || !g) return;
      if (!cible || cible.offsetParent === null) {
        g.style.opacity = '0';
        return;
      }
      g.style.opacity = '1';
      const p = n.getBoundingClientRect();
      const r = cible.getBoundingClientRect();
      const fin = { x: r.left - p.left, w: r.width };
      g.style.top = `${r.top - p.top}px`;
      g.style.height = `${r.height}px`;
      const avant = etat.current;
      // RIEN NE BOUGE (second appel du meme rendu, redimensionnement sans
      // effet) : on ne touche a rien. Rejouer une animation « de la cible vers la
      // cible » ECRASAIT la vraie, et la goutte sautait sans glisser.
      if (avant && Math.abs(avant.x - fin.x) < 0.5 && Math.abs(avant.w - fin.w) < 0.5) return;
      etat.current = fin;
      const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('animations-reduites');
      if (!anime || !avant || reduit) {
        g.getAnimations().forEach((a) => a.cancel());
        g.style.left = `${fin.x}px`;
        g.style.width = `${fin.w}px`;
        return;
      }
      // Exactement la maquette : etirement vers l'union, puis resserrement en rebond.
      const debut = Math.min(avant.x, fin.x);
      const union = Math.max(avant.x + avant.w, fin.x + fin.w) - debut;
      g.animate(
        [
          { left: `${avant.x}px`, width: `${avant.w}px` },
          { left: `${debut}px`, width: `${union}px`, offset: 0.35 },
          { left: `${fin.x}px`, width: `${fin.w}px` },
        ],
        { duration: SNAPPY.ms + 120, easing: 'ease-out' }
      );
      g.animate(
        [
          { left: `${debut}px`, width: `${union}px` },
          { left: `${fin.x}px`, width: `${fin.w}px` },
        ],
        { duration: BOUNCY.ms, easing: BOUNCY.css, delay: (SNAPPY.ms + 120) * 0.35 }
      );
      g.style.left = `${fin.x}px`;
      g.style.width = `${fin.w}px`;
    },
    [cleActive]
  );

  useLayoutEffect(() => placer(true), [placer]);

  useEffect(() => {
    const n = nav.current;
    if (!n || typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(() => placer(false));
    o.observe(n);
    n.querySelectorAll('[data-rubrique]').forEach((el) => o.observe(el));
    window.addEventListener('resize', () => placer(false));
    return () => o.disconnect();
  }, [placer]);

  return { nav, goutte };
}
