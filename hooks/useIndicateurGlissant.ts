import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { BOUNCY, SNAPPY } from './useGoutte';

// ============================================================================
// L'INDICATEUR QUI GLISSE — la mécanique, une seule fois.
//
// C'est le mouvement signature d'iOS : la sélection ne réapparaît pas ailleurs,
// elle SE DÉPLACE. Deux endroits en ont besoin dans GRID, et ils n'ont rien à
// voir l'un avec l'autre :
//
//   - la pastille du contrôle segmenté (`components/Segmente.tsx`) ;
//   - le curseur de la liste des vendeurs du module C (`pages/Saisie.tsx`), qui
//     suit le chef quand il enchaîne les vendeurs par `Ctrl+N`.
//
// La mécanique est la même au nombre près. L'écrire deux fois donnerait deux
// courbes, deux façons de gérer le redimensionnement et deux bugs à corriger
// séparément.
//
// ---------------------------------------------------------------------------
// POURQUOI LA TRANSFORMATION EST POSÉE EN DUR, ET NON PAR VARIABLES CSS
// ---------------------------------------------------------------------------
// PREMIÈRE VERSION, FAUSSE, ET MESURÉE COMME TELLE. Le hook posait quatre
// variables CSS sur le conteneur — `--ind-x/-y/-l/-h` — et le CSS lisait
// `transform: translate3d(var(--ind-x), var(--ind-y), 0)`. C'est élégant, c'est
// ce que montrent la plupart des exemples, et **ça n'anime pas** :
//
//     t=0      y = 259 px   (position de départ)
//     t=140ms  y = 259 px   ← rien n'a bougé
//     t=840ms  y = 110 px   (arrivée)
//
// Chromium n'interpole pas `transform` quand sa valeur dépend d'une custom
// property NON ENREGISTRÉE : le changement est traité comme discret, et une
// transition discrète bascule à 50 % de sa durée — 280 ms ici, ce qui colle
// exactement à la mesure. Aucune erreur, aucun avertissement : le `transition`
// est bien là dans le style calculé, il ne fait simplement rien.
//
// Piège associé, et c'est lui qui m'avait donné une fausse confirmation :
// l'étirement `scaleX` déforme la boîte mesurée. Une largeur intermédiaire de
// 69 px entre 81 et 64 ressemblait à une interpolation en cours ; ce n'était que
// la mise à l'échelle d'une valeur déjà arrivée.
//
// Deux remèdes existent. Enregistrer les propriétés avec `@property` les rend
// interpolables — élégant, mais l'animation vit alors sur le conteneur et la
// chaîne de dépendance devient difficile à suivre. Poser directement une valeur
// concrète sur l'élément mobile est plus direct, sans question de support, et
// c'est ce qui est fait ici.
//
// ---------------------------------------------------------------------------
// AUCUN JAVASCRIPT PAR IMAGE POUR AUTANT
// ---------------------------------------------------------------------------
// On écrit `transform` une seule fois, au changement de sélection. C'est ensuite
// le compositeur qui interpole, avec une courbe de ressort en `linear()`. Rien
// ne tourne pendant l'animation — condition pour que l'écran de saisie, affiché
// des heures et souvent projeté, ne paie rien.
//
// ---------------------------------------------------------------------------
// POURQUOI UN `ResizeObserver`
// ---------------------------------------------------------------------------
// La géométrie change avec la police, la langue, le zoom, le passage à la ligne
// et le filtre de recherche. Une mesure au montage seul laisserait l'indicateur
// décalé — et la barre d'outils du tableau de bord est en `flex-wrap`, donc le
// cas arrive vraiment.
// ============================================================================

/// Durée pendant laquelle l'étirement est tenu, en millisecondes — environ 35 %
/// de `--duree-ample` (560 ms). Écrite ici et non lue dans le CSS : un
/// `getComputedStyle` par changement de sélection pour récupérer une constante
/// serait un calcul de mise en page inutile sur le chemin le plus chaud du
/// produit. Les deux valeurs sont liées, et le commentaire du CSS le dit.

export interface IndicateurGlissant {
  /// Le conteneur, qui doit être `position: relative`. Dans une liste
  /// défilante, c'est aussi ce qui fait que l'indicateur défile AVEC le contenu.
  conteneur: (el: HTMLElement | null) => void;
  /// L'élément mobile — celui qui porte la couleur et qui glisse.
  indicateur: (el: HTMLElement | null) => void;
  /// À poser sur chaque élément sélectionnable, dans l'ordre.
  cible: (i: number) => (el: HTMLElement | null) => void;
}

export function useIndicateurGlissant(
  indexActif: number,
  /// Nombre d'éléments. Sert à réobserver quand la liste change de longueur.
  nombre: number,
  /// Axe de l'étirement pendant le trajet. `x` pour une barre de segments,
  /// `y` pour une liste verticale : la déformation se lit dans le sens du
  /// déplacement.
  axe: 'x' | 'y' = 'x'
): IndicateurGlissant {
  const refConteneur = useRef<HTMLElement | null>(null);
  const refIndicateur = useRef<HTMLElement | null>(null);
  const refCibles = useRef<(HTMLElement | null)[]>([]);

  const placer = useCallback(
    (etirement: number) => {
      const ind = refIndicateur.current;
      const cible = refCibles.current[indexActif];
      if (!ind || !cible) return;

      // `offsetTop` / `offsetLeft` sont relatifs au premier ancêtre positionné :
      // le conteneur. Dans une liste défilante, ce sont donc les coordonnées du
      // CONTENU et non de la fenêtre — sans quoi l'indicateur resterait collé
      // en haut pendant que les 104 vendeurs défilent dessous.
      ind.style.width = `${cible.offsetWidth}px`;
      ind.style.height = `${cible.offsetHeight}px`;
      ind.style.transform =
        `translate3d(${cible.offsetLeft}px, ${cible.offsetTop}px, 0)` +
        (etirement === 1 ? '' : ` ${axe === 'x' ? 'scaleX' : 'scaleY'}(${etirement})`);
    },
    [indexActif, axe]
  );

  // `useLayoutEffect` : l'indicateur doit être placé AVANT que le navigateur ne
  // peigne, sinon il apparaît en haut à gauche puis saute à sa place.
  /// Derniere geometrie posee : le point de DEPART du prochain glissement.
  const geo = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const mesurer = () => {
    const c = refCibles.current[indexActif];
    return c ? { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight } : null;
  };

  // LE MOUVEMENT DE LA MAQUETTE, PARTOUT (03/10/2026, demande de l'utilisateur) :
  // l'indicateur s'ETIRE vers l'union de l'ancienne et de la nouvelle position,
  // puis se RESSERRE sur la cible au ressort « bouncy » — les memes deux
  // animations que la goutte de l'Ile (`useGoutte`). Segmentes, curseur de la
  // liste des vendeurs : un seul geste dans toute l'application.
  useLayoutEffect(() => {
    const ind = refIndicateur.current;
    const fin = mesurer();
    if (!ind || !fin) return;
    const avant = geo.current;
    geo.current = fin;
    placer(1);
    if (!avant) return;
    const bouge = axe === 'x' ? Math.abs(avant.x - fin.x) > 0.5 : Math.abs(avant.y - fin.y) > 0.5;
    const reduit =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.classList.contains('animations-reduites');
    if (!bouge || reduit) return;
    // L'union est PLAFONNEE a trois fois la cible : sur 104 vendeurs, un saut de
    // 60 lignes ferait une goutte de la hauteur de la liste.
    const [p0, t0, p1, t1] = axe === 'x' ? [avant.x, avant.w, fin.x, fin.w] : [avant.y, avant.h, fin.y, fin.h];
    const plafond = t1 * 3;
    const debut = p0 < p1 ? Math.max(p0, p1 + t1 - plafond) : p1;
    const union = Math.min(Math.max(p0 + t0, p1 + t1), Math.max(debut + plafond, p1 + t1)) - debut;
    const cadre = (x: number, y: number, w: number, h: number) => ({
      transform: `translate3d(${x}px, ${y}px, 0)`,
      width: `${w}px`,
      height: `${h}px`,
    });
    const depart = cadre(avant.x, avant.y, avant.w, avant.h);
    const etire = axe === 'x' ? cadre(debut, fin.y, union, fin.h) : cadre(fin.x, debut, fin.w, union);
    const arrivee = cadre(fin.x, fin.y, fin.w, fin.h);
    ind.style.transition = 'none';
    ind.animate([depart, { ...etire, offset: 0.35 }, arrivee], { duration: SNAPPY.ms + 120, easing: 'ease-out' });
    ind.animate([etire, arrivee], { duration: BOUNCY.ms, easing: BOUNCY.css, delay: (SNAPPY.ms + 120) * 0.35 });
    requestAnimationFrame(() => (ind.style.transition = ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placer, nombre]);

  useEffect(() => {
    const c = refConteneur.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    // Un REDIMENSIONNEMENT (barre qui se retracte, fenetre qui change) replace
    // l'indicateur SANS transition : l'animer image par image pendant que la
    // barre change de taille faisait ramer la retraction de l'Ile.
    const o = new ResizeObserver(() => {
      const ind = refIndicateur.current;
      if (ind) ind.style.transition = 'none';
      placer(1);
      geo.current = mesurer();
      if (ind) requestAnimationFrame(() => (ind.style.transition = ''));
    });
    o.observe(c);
    refCibles.current.forEach((el) => el && o.observe(el));
    return () => o.disconnect();
  }, [placer, nombre]);

  return {
    conteneur: (el) => {
      refConteneur.current = el;
    },
    indicateur: (el) => {
      refIndicateur.current = el;
      if (el) placer(1);
    },
    cible: (i) => (el) => {
      refCibles.current[i] = el;
    },
  };
}
