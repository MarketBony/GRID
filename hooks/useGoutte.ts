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

export const SNAPPY = { ms: 500, css: 'linear(0, 0.029, 0.105, 0.209, 0.328, 0.452, 0.572, 0.683, 0.78, 0.863, 0.93, 0.983, 1.022, 1.049, 1.065, 1.074, 1.076, 1.073, 1.067, 1.059, 1.05, 1.04, 1.031, 1.023, 1.016, 1.01, 1.005, 1.001, 0.998, 0.996, 0.995, 0.994, 0.994, 0.994, 0.995, 0.996, 0.996, 0.997, 0.998, 0.998, 1)' };
export const BOUNCY = { ms: 950, css: 'linear(0, 0.09, 0.309, 0.583, 0.851, 1.068, 1.212, 1.28, 1.281, 1.233, 1.16, 1.08, 1.009, 0.957, 0.927, 0.917, 0.925, 0.943, 0.966, 0.988, 1.006, 1.018, 1.023, 1.023, 1.019, 1.013, 1.007, 1.001, 0.996, 0.994, 0.993, 0.994, 0.995, 0.997, 0.999, 1, 1.001, 1.002, 1.002, 1.002, 1)' };

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
      // Largeur de la pilule : les trois morceaux y calent leur degrade commun.
      g.style.setProperty('--w', `${fin.w}px`);
      g.style.top = `${r.top - p.top}px`;
      g.style.height = `${r.height}px`;
      // Rayon des bouts : pilule pleine dans l'Ile, 24 px dans la barre du bas.
      g.style.setProperty('--r', `${Math.min(r.height / 2, n.classList.contains('barre-bas') ? 24 : r.height / 2)}px`);
      const avant = etat.current;
      // RIEN NE BOUGE (second appel du meme rendu, redimensionnement sans
      // effet) : on ne touche a rien. Rejouer une animation « de la cible vers la
      // cible » ECRASAIT la vraie, et la goutte sautait sans glisser.
      if (avant && Math.abs(avant.x - fin.x) < 0.5 && Math.abs(avant.w - fin.w) < 0.5) return;
      etat.current = fin;
      const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('animations-reduites');
      const morceaux = [...g.children] as HTMLElement[];
      if (!anime || !avant || reduit) {
        morceaux.forEach((m) => m.getAnimations().forEach((a) => a.cancel()));
        g.style.left = `${fin.x}px`;
        g.style.width = `${fin.w}px`;
        return;
      }
      // Exactement la maquette : etirement vers l'union, puis resserrement en
      // rebond — EN TRANSFORM SEUL, donc compose par le GPU (le changement de
      // rubrique occupe le fil principal a la meme image).
      //
      // LA GOUTTE EST EN TROIS MORCEAUX (03/10/2026). Un scaleX sur la pilule
      // entiere ecrasait ses bouts ronds en ovales — « trop arrondi a la
      // transition », a dit l'utilisateur. Ici les deux bouts ne font que
      // TRANSLATER (ils restent ronds), et seul le milieu, rectangulaire,
      // s'etire : aucune deformation visible.
      const [gauche, milieu, droite] = morceaux;
      if (!gauche || !milieu || !droite) return;
      let depuis = avant;
      if (morceaux.some((m) => m.getAnimations().some((x) => x.playState === 'running'))) {
        const rg = gauche.getBoundingClientRect();
        const rd = droite.getBoundingClientRect();
        depuis = { x: rg.left - p.left, w: rd.right - rg.left };
      }
      morceaux.forEach((m) => m.getAnimations().forEach((x) => x.cancel()));
      g.style.left = `${fin.x}px`;
      g.style.width = `${fin.w}px`;
      // Union PLAFONNEE a 2,5 fois la cible.
      const plafond = fin.w * 2.5;
      const debut = depuis.x < fin.x ? Math.max(depuis.x, fin.x + fin.w - plafond) : fin.x;
      const union = Math.min(Math.max(depuis.x + depuis.w, fin.x + fin.w), Math.max(debut + plafond, fin.x + fin.w)) - debut;
      const rayon = gauche.offsetWidth / 2;
      const corps = Math.max(1, fin.w - 2 * rayon);
      const poses = (x: number, w: number) => [
        { transform: `translateX(${x - fin.x}px)` },
        { transform: `translateX(${x - fin.x}px) scaleX(${Math.max(0, w - 2 * rayon) / corps})` },
        { transform: `translateX(${x + w - (fin.x + fin.w)}px)` },
      ];
      const pDepart = poses(depuis.x, depuis.w);
      const pEtire = poses(debut, union);
      const pFin = poses(fin.x, fin.w);
      const etirement = SNAPPY.ms + 120;
      [gauche, milieu, droite].forEach((m, i) => {
        m.animate([pDepart[i], { ...pEtire[i], offset: 0.35 }, pFin[i]], { duration: etirement, easing: 'ease-out' });
        m.animate([pEtire[i], pFin[i]], { duration: BOUNCY.ms, easing: BOUNCY.css, delay: etirement * 0.35 });
      });
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
