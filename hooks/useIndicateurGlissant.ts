import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

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
const DUREE_ETIREMENT = 190;

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
  const precedent = useRef(indexActif);

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
  useLayoutEffect(() => placer(1), [placer, nombre]);

  useEffect(() => {
    const c = refConteneur.current;
    if (!c || typeof ResizeObserver === 'undefined') return;
    const o = new ResizeObserver(() => placer(1));
    o.observe(c);
    refCibles.current.forEach((el) => el && o.observe(el));
    return () => o.disconnect();
  }, [placer, nombre]);

  // L'ÉTIREMENT est proportionnel au trajet et PLAFONNÉ : sur 104 vendeurs, un
  // saut de 60 lignes déformerait l'indicateur au point de le rendre illisible.
  // iOS fait la même chose — la déformation dit « ça vient de loin », elle ne
  // mesure pas la distance.
  //
  // IL DOIT DURER UNE FRACTION DU TRAJET, PAS UNE IMAGE. Première version : posé
  // puis retiré au `requestAnimationFrame` suivant. Mesuré, l'étirement maximal
  // atteint était de 1,000 — c'est-à-dire aucun. La raison est que l'étirement
  // et la translation vivent dans le MÊME `transform`, donc dans la même
  // transition de 560 ms : re-cibler l'échelle à 1 seize millisecondes plus tard
  // ne lui laisse pas le temps de s'éloigner de 1.
  //
  // Il est donc tenu sur ~35 % de la course, puis relâché : l'indicateur part
  // étiré, se retasse pendant qu'il finit son trajet, et arrive rond.
  useEffect(() => {
    const trajet = Math.abs(indexActif - precedent.current);
    precedent.current = indexActif;
    if (trajet === 0) return;
    placer(1 + Math.min(trajet, 3) * 0.06);
    const t = setTimeout(() => placer(1), DUREE_ETIREMENT);
    return () => clearTimeout(t);
  }, [indexActif, placer]);

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
