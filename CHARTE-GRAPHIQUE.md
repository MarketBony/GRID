# Charte graphique Bony — livrable de portage

**À qui s'adresse ce document.** À une session de travail chargée d'appliquer à une
autre application l'apparence et le mouvement de GRID. Il est autosuffisant : tout ce
qui est nécessaire est ici, en valeurs exactes extraites du fichier de production, pas
de mémoire.

**Ce qui est portable, et ce qui ne l'est pas.** Les tokens, le verre, le mouvement, les
composants et les règles se portent tels quels. Ce qui est propre au métier de GRID —
la grille de saisie, le planning imprimable — est signalé et à ignorer.

**Aucune dépendance.** Pas de Tailwind, pas de bibliothèque de composants, pas de
bibliothèque d'animation. Tout est en CSS simple, dans un seul fichier. Deux raisons :
un CDN ajoute une dépendance réseau au démarrage, et les classes utilitaires ne
résolvent aucune des contraintes de mise en page réelles du produit.

**Une seule dépendance externe, les polices.** Elles viennent de Google Fonts.

---

## 0. Ordre de portage recommandé

Chaque étape est utilisable seule et ne casse rien de la précédente.

| # | Étape | Section |
|---|---|---|
| 1 | Polices + tokens (les deux thèmes) | §1, §2 |
| 2 | Fond vivant + barres de défilement | §3, §4 |
| 3 | Verre (`.glass`, `.glass-strong`, `.glass-menu`) | §5 |
| 4 | Mouvement (les trois ressorts) | §6 |
| 5 | Boutons, champs, messages | §7 |
| 6 | Sélection glissante — **le geste signature** | §8 |
| 7 | Menus, dialogues, bascules | §9 |
| 8 | Relire §10 avant d'écrire une seule règle de plus | §10 |

**L'étape 6 est celle qui fait la différence.** Le verre se remarque une fois ; le
mouvement de la sélection se remarque à chaque clic.

---

## 1. Marque et polices

| | |
|---|---|
| Orange | `#f75632` |
| Violet | `#8f12ab` |
| Bleu | `#293f74` |
| Dégradé | `linear-gradient(to right, #f75632, #8f12ab)` |
| Dégradé au survol | `linear-gradient(to right, #ff6b4a, #a62bc4)` |
| Titres | **Syncopate** 400 / 700 |
| Texte | **Albert Sans** 100–900, italiques comprises |

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Albert+Sans:ital,wght@0,100..900;1,100..900&family=Syncopate:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

**Syncopate est une police de TITRES, et elle est large.** Elle sert aux titres
d'écran, aux en-têtes de tableau et aux étiquettes en capitales. Jamais à un
paragraphe : elle devient illisible au-delà d'une ligne. Toujours avec un
`letter-spacing` positif de 0,02 à 0,08 em.

**Le dégradé court toujours de la gauche vers la droite**, orange puis violet, jamais
l'inverse. Sur un logotype ou une icône composée de plusieurs formes, employer
`gradientUnits="userSpaceOnUse"` pour qu'il traverse l'ensemble **d'un seul tenant**
plutôt que de recommencer dans chaque forme.

---

## 2. Tokens

À copier tel quel. Les noms sont ceux d'origine : les conserver rend tout écran portable
d'un projet à l'autre **sans traduction**.

```css
:root {
  /* ---- Mesures de la coquille ---- */
  --h-entete: 3.6rem;      /* repli seulement — voir §10.1 */
  --padding-main: 1.5rem;

  /* ---- Marque ---- */
  --bony-orange: #f75632;
  --bony-violet: #8f12ab;
  --bony-blue: #293f74;
  --bony-gradient: linear-gradient(to right, #f75632, #8f12ab);
  --bony-gradient-hover: linear-gradient(to right, #ff6b4a, #a62bc4);

  /* ---- Thème clair ---- */
  --bg-main: #f1f5f9;
  --bg-panel: #ffffff;
  --bg-input: #f8fafc;
  --border-color: #cbd5e1;
  --text-main: #0f172a;
  --text-muted: #64748b;

  /* ---- Verre ---- */
  --glass-bg: rgba(255, 255, 255, 0.38);
  --glass-bg-strong: rgba(255, 255, 255, 0.66);
  --glass-border: rgba(255, 255, 255, 0.75);
  --glass-blur: 30px;
  --glass-menu-bg: rgba(255, 255, 255, 0.9);
  --glass-menu-border: rgba(255, 255, 255, 0.9);
  --panel-glass-bg: rgba(255, 255, 255, 0.5);
  --panel-glass-border: rgba(255, 255, 255, 0.7);

  /* ---- Washes du fond vivant ---- */
  --wash-1: rgba(247, 86, 50, 0.3);
  --wash-2: rgba(143, 18, 171, 0.28);
  --wash-3: rgba(41, 63, 116, 0.22);

  /* ---- Sémantique ---- */
  --succes: #1c7a35;
  --succes-fond: rgba(28, 122, 53, 0.1);
  --attention: #a56200;
  --attention-fond: rgba(165, 98, 0, 0.12);
  --erreur: #c62828;
  --erreur-fond: rgba(198, 40, 40, 0.1);

  /* ---- Rayons ---- */
  --rayon: 14px;
  --rayon-petit: 9px;

  font-family: 'Albert Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
}

html.dark {
  /* Legerement releve : sur un noir absolu, un wash colore se lit comme une
     tache et non comme une lumiere. */
  --bg-main: #14141a;
  --bg-panel: #1e1e1e;
  --bg-input: rgba(0, 0, 0, 0.2);
  --border-color: #333333;
  --text-main: #ffffff;
  --text-muted: #94a3b8;

  --glass-bg: rgba(26, 26, 34, 0.34);
  --glass-bg-strong: rgba(30, 30, 38, 0.55);
  --glass-border: rgba(255, 255, 255, 0.14);

  /* Le menu reste plus dense : il flotte AU-DESSUS du contenu qui defile, et
     une barre translucide sur du texte en mouvement est illisible. */
  --glass-menu-bg: rgba(22, 22, 28, 0.8);
  --glass-menu-border: rgba(255, 255, 255, 0.16);

  --panel-glass-bg: rgba(26, 26, 34, 0.4);
  --panel-glass-border: rgba(255, 255, 255, 0.12);

  /* Les washes MONTENT en sombre : il faut plus de couleur pour la meme
     presence sur un fond noir. */
  --wash-1: rgba(247, 86, 50, 0.5);
  --wash-2: rgba(143, 18, 171, 0.46);
  --wash-3: rgba(41, 63, 116, 0.4);

  --succes: #6ee7a0;
  --succes-fond: rgba(110, 231, 160, 0.12);
  --attention: #f0c070;
  --attention-fond: rgba(240, 192, 112, 0.14);
  --erreur: #ff8a80;
  --erreur-fond: rgba(255, 138, 128, 0.12);
}
```

**Le thème sombre est le défaut**, par une classe `dark` sur `<html>`, pas par
`prefers-color-scheme`. Raison métier sur GRID : l'écran principal reste affiché des
heures, souvent projeté sur un écran collectif. À réévaluer selon l'usage réel de
l'autre application — mais **choisir**, et ne pas laisser le système décider si le
produit a une raison de préférer l'un.

**Les fonds de verre sont volontairement peu opaques.** Ils étaient à 0,58 pour un
panneau : le dégradé du fond ne passait pas à travers, et l'interface se lisait comme une
suite de rectangles gris sur du noir. **C'est le flou qui rend le texte lisible, pas
l'épaisseur du fond.** Ne pas les remonter pour « gagner en lisibilité » : c'est le
contraire qui se produit.

---

## 3. Le fond vivant

**Trois** couches de dégradés radiaux, en position fixe, derrière tout le contenu.

```css
body::before,
body::after {
  content: '';
  position: fixed;
  /* Débordement volontaire : la couche se déplace, et ses bords ne doivent
     jamais entrer dans le champ. */
  inset: -35%;
  z-index: -1;
  pointer-events: none;
  will-change: transform;
}

body::before {
  background-image:
    radial-gradient(ellipse 50% 44% at 16% 10%, var(--wash-1), transparent 62%),
    radial-gradient(ellipse 46% 40% at 84% 86%, var(--wash-2), transparent 62%);
  animation: derive-un 17s ease-in-out infinite alternate;
}

body::after {
  background-image:
    radial-gradient(ellipse 44% 38% at 74% 20%, var(--wash-3), transparent 64%),
    radial-gradient(ellipse 40% 36% at 24% 78%, var(--wash-1), transparent 66%);
  animation: derive-deux 23s ease-in-out infinite alternate;
  opacity: 0.9;
}

/* La troisieme couche vit sur la coquille : `body` n'a que deux
   pseudo-elements, et on ne va pas ajouter un div de decor dans le DOM. */
.application::before {
  content: '';
  position: fixed;
  inset: -40%;
  z-index: -1;
  pointer-events: none;
  will-change: transform;
  background-image:
    radial-gradient(ellipse 38% 34% at 50% 46%, var(--wash-2), transparent 66%),
    radial-gradient(ellipse 34% 30% at 8% 60%, var(--wash-3), transparent 68%);
  opacity: 0.8;
  animation: derive-trois 31s ease-in-out infinite alternate;
}

@keyframes derive-un {
  0%   { transform: translate3d(-8%, 4%, 0)   scale(1)    rotate(0deg); }
  50%  { transform: translate3d(12%, -10%, 0) scale(1.25) rotate(7deg); }
  100% { transform: translate3d(-4%, 14%, 0)  scale(1.08) rotate(-5deg); }
}
@keyframes derive-deux {
  0%   { transform: translate3d(10%, -6%, 0)  scale(1.18) rotate(4deg); }
  50%  { transform: translate3d(-14%, 8%, 0)  scale(1)    rotate(-8deg); }
  100% { transform: translate3d(6%, -12%, 0)  scale(1.22) rotate(6deg); }
}
@keyframes derive-trois {
  0%   { transform: translate3d(4%, 10%, 0)   scale(1.1)  rotate(-6deg); }
  50%  { transform: translate3d(-16%, -8%, 0) scale(1.3)  rotate(9deg); }
  100% { transform: translate3d(14%, 6%, 0)   scale(1.02) rotate(-3deg); }
}
```

**Trois choix à ne pas défaire :**

1. **animer `transform`, jamais `background-position`.** La transformation est composée
   par le GPU ; repeindre trois dégradés radiaux plein écran à chaque image **se voit**
   pendant une saisie au clavier ;
2. **17 s, 23 s, 31 s — trois nombres premiers.** La combinaison ne se répète qu'au bout
   de 17 × 23 × 31 ≈ 3,4 heures : l'œil ne peut pas y trouver de boucle. Des durées
   rondes (20/30/40) rendraient la dérive périodique et donc perceptible ;
3. **`inset` négatif.** Sans ce débordement, le bord d'une couche qui se déplace entre
   dans le champ et se lit comme une tache.

---

## 4. Barres de défilement

Les barres système traversent l'interface en gris clair et cassent tout. **Les deux
syntaxes sont nécessaires** — Firefox ne connaît que `scrollbar-color`, WebKit que les
pseudo-éléments — et non l'une *ou* l'autre.

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--bony-violet) transparent;
}

*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track { background: transparent; }

*::-webkit-scrollbar-thumb {
  background-image: linear-gradient(to bottom, var(--bony-orange), var(--bony-violet));
  border-radius: 99px;
  /* La bordure transparente amincit le pouce sans changer la zone cliquable :
     une barre fine qui reste facile à attraper. */
  border: 2px solid transparent;
  background-clip: content-box;
}

*::-webkit-scrollbar-thumb:hover {
  background-image: linear-gradient(to bottom, #ff6b4a, #a62bc4);
}

*::-webkit-scrollbar-corner { background: transparent; }
```

---

## 5. Le verre

Un panneau de verre se lit à **quatre** choses, et il en faut quatre : ce qu'on voit à
travers, un **arc spéculaire** en haut à gauche, un **liseré clair** sur l'arête haute,
et une **ombre double** — diffuse plus contact.

```css
.glass,
.glass-strong {
  /* L'ARC SPECULAIRE est en couche de fond, pose AVANT la teinte : c'est lui
     qui donne l'arete lumineuse. Sans lui, un panneau translucide se lit comme
     un rectangle gris. */
  background-image:
    radial-gradient(135% 110% at 6% -14%, rgba(255, 255, 255, 0.55), transparent 44%),
    radial-gradient(85% 65% at 110% 114%, rgba(255, 255, 255, 0.18), transparent 56%);
  backdrop-filter: blur(var(--glass-blur)) saturate(200%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(200%);
  border: 1px solid var(--glass-border);
  box-shadow:
    0 18px 44px -12px rgba(16, 18, 32, 0.26),   /* ombre diffuse  */
    0 2px 6px -2px rgba(16, 18, 32, 0.16),      /* ombre de CONTACT */
    inset 0 1px 0 0 rgba(255, 255, 255, 0.7),   /* liseré haut    */
    inset 0 0 0 1px rgba(255, 255, 255, 0.28),  /* liseré interne */
    inset 0 -1px 0 rgba(255, 255, 255, 0.12);   /* liseré bas     */
}

.glass        { background-color: var(--glass-bg); }
.glass-strong { background-color: var(--glass-bg-strong); }

/* En sombre, l'arc doit etre PLUS marque en valeur relative, pas moins : sur un
   fond clair l'oeil devine l'arete, sur un fond sombre il n'a que ca. */
html.dark .glass,
html.dark .glass-strong {
  background-image:
    radial-gradient(135% 110% at 6% -14%, rgba(255, 255, 255, 0.15), transparent 44%),
    radial-gradient(85% 65% at 110% 114%, rgba(255, 255, 255, 0.06), transparent 56%);
  box-shadow:
    0 20px 50px -14px rgba(0, 0, 0, 0.6),
    0 2px 8px -2px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.24),
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(255, 255, 255, 0.04);
}

/* Un menu FLOTTE au-dessus du contenu qui defile : il est plus dense et plus
   floute, sans quoi le texte en mouvement derriere le rend illisible. */
.glass-menu {
  background: var(--glass-menu-bg);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid var(--glass-menu-border);
  box-shadow:
    0 20px 50px -12px rgba(16, 18, 32, 0.35),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.6);
}

html.dark .glass-menu {
  box-shadow:
    0 24px 60px -12px rgba(0, 0, 0, 0.72),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
}

/* Sans backdrop-filter, le verre devient illisible : on le rend quasi opaque. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass, .glass-strong, .glass-menu, .carte, header {
    background: var(--bg-panel);
  }
}
```

### 5.1 Ce qui a été essayé et ÉCARTÉ — ne pas y revenir

**La réfraction par carte de déplacement SVG ne sert à rien ici, et c'est mesuré.** Les
deux bibliothèques de référence du genre (`rdev/liquid-glass-react`,
`ybouane/liquidglass`) sont faites pour du verre posé sur des **photos**. Sur un fond de
dégradés doux, il n'y a **aucun détail haute fréquence à tordre** : le déplacement est
invisible.

Pire, `filter` appliqué à un élément qui porte `backdrop-filter` **perd le découpage du
`border-radius`** dans Chromium, et ni `clip-path` ni un `overflow: hidden` sur le parent
ne le rattrapent. La seconde bibliothèque rend en WebGL après un `html-to-image` **par
image** : à écarter d'emblée sur toute interface où l'on tape au clavier.

**Le verre se fait donc en couches CSS**, ce qui a l'avantage de fonctionner dans tous
les moteurs et de garder les coins.

---

## 6. Le mouvement

### 6.1 Trois courbes, et pas une de plus

Une interface où chaque élément a sa propre courbe ne se lit pas comme un système, elle
se lit comme un accident.

Ce sont de **vrais ressorts**, pas des `cubic-bezier` choisis à l'œil : chaque courbe est
l'échantillonnage d'un oscillateur amorti

```
x(t) = 1 − e^(−ζωt) · ( cos(ω_d·t) + (ζω/ω_d)·sin(ω_d·t) )
```

calculé puis figé en `linear()`. C'est ce qui donne le dépassement d'iOS : **un
`ease-out` n'arrive jamais au-delà de sa cible, un ressort si.** Et `linear()` est
interpolé par le **compositeur** — aucun JavaScript par image.

```css
:root {
  /* z=0.62 w=9 — depassement franc de 8 %. La pastille du segmente, les
     panneaux qui entrent. Le dernier echantillon est force a 1 : la formule
     rend 0.9952, et `linear()` s'arrete sur sa derniere valeur — l'element
     finirait un demi-pour-cent trop court, ce qui se voit sur une pastille. */
  --ressort-ample: linear(0,0.0599,0.202,0.38,0.5607,0.723,0.8558,0.9552,1.0226,1.0625,1.0805,1.083,1.0752,1.062,1.0468,1.0321,1.0193,1.0091,1.0016,0.9968,0.9941,0.9931,0.9932,0.994,1);

  /* z=0.80 w=13 — a peine 1,4 % de depassement. L'appui et le survol : on veut
     une reponse, pas un rebond. */
  --ressort-vif: linear(0,0.2127,0.5463,0.796,0.9355,0.9961,1.014,1.014,1.0091,1.0046,1.0017,1.0004,0.9999,0.9998,0.9998,0.9999,1);

  /* z=0.90 w=11 — quasi critique. Les entrees d'ecran, ou un rebond donnerait
     le mal de mer. */
  --ressort-doux: linear(0,0.1937,0.4942,0.7262,0.8686,0.9446,0.9804,0.9953,1.0004,1.0015,1.0013,1.0008,1.0005,1.0002,1);

  --duree-vif: 220ms;
  --duree: 380ms;
  --duree-ample: 560ms;

  --ressort: var(--ressort-vif);   /* alias par defaut */
}
```

**Quelle courbe pour quoi :**

| Geste | Courbe | Durée |
|---|---|---|
| Survol, appui, changement de couleur | `--ressort-vif` | `--duree-vif` |
| Chevron qui tourne, anneau de focus | `--ressort-vif` | `--duree` |
| Panneau qui monte, dialogue, volet | `--ressort-doux` | `--duree` |
| Pastille de sélection qui glisse | `--ressort-ample` | `--duree-ample` |
| Entrée d'écran | `--ressort-doux` | `--duree` |

### 6.2 Les entrées

```css
@keyframes entree-ecran {
  from { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.994); }
  to   { opacity: 1; transform: none; }
}

/* 10 px, pas 40 : au-dela, l'oeil suit le DEPLACEMENT au lieu de lire le
   contenu qui arrive. */
@keyframes volet-monte {
  from { opacity: 0; transform: translate3d(0, 10px, 0) scale(0.992); }
  to   { opacity: 1; transform: none; }
}
```

Tout panneau qui monte reçoit `transform-origin: 50% 0` : **un panneau s'ouvre depuis son
attache, pas depuis son centre.**

### 6.3 `prefers-reduced-motion`

**Rien ne disparaît, tout se place.** C'est le mouvement qui est un confort, jamais
l'information : une pastille qui saute à sa place reste parfaitement lisible.

```css
@media (prefers-reduced-motion: reduce) {
  .pilule, .curseur-liste, .pilule-onglet { transition: none; }
  .panneau-menu, .boite-dialogue, .voile-dialogue { animation: none; }
  body::before, body::after, .application::before { animation: none; }
  /* … et tout `transform` d'appui remis a `none` */
}
```

---

## 7. Boutons, champs, messages

### 7.1 Le dégradé s'OBTIENT, il ne s'hérite pas

**La leçon la plus coûteuse de ce projet.** Une règle fourre-tout donnait le dégradé à
tout bouton d'un écran, avec une liste d'exceptions qui s'allongeait :
`:not(.lien):not(.onglet):not(.secondaire)…`. Elle a fini par attraper les contrôles
segmentés, les en-têtes de colonne triables et les cartes de vendeur : trois surfaces en
dégradé plein côte à côte, illisibles, et aucune ne réagissait au survol.

> **`button` est neutre par défaut. `.principal` porte le dégradé. Une action principale
> par écran, deux au plus.**

Le mode d'échec change de sens : un bouton oublié devient **discret** au lieu d'être
agressif.

```css
button:hover:not(:disabled) {
  border-color: var(--bony-orange);
  background: var(--glass-bg-strong);
}

/* L'APPUI. `scale(0.965)` sans translation, et le retour au ressort : c'est ce
   qui donne le rebond d'iOS. Une version descendant d'un pixel etait trop
   timide pour se sentir, assez pour faire vibrer le texte. */
button:active:not(:disabled) {
  transform: scale(0.965);
  transition-duration: 90ms;
}

/* Le focus clavier doit se VOIR : c'est le seul repere de qui n'utilise pas la
   souris. */
button:focus-visible {
  outline: 2px solid var(--bony-violet);
  outline-offset: 2px;
}

.principal {
  font-weight: 600;
  padding: 0.55rem 1.05rem;
  border: 1px solid transparent;
  background-image: var(--bony-gradient);
  background-color: transparent;
  color: #fff;
  box-shadow:
    0 3px 12px rgba(247, 86, 50, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

/* IL FAUT CETTE REGLE. Voir §10.2 : sans elle, le degrade DISPARAIT au survol. */
.principal:hover:not(:disabled) {
  background-image: var(--bony-gradient-hover);
  border-color: transparent;
  box-shadow:
    0 5px 18px rgba(247, 86, 50, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}
```

**Tout ce qui est cliquable réagit** : survol, appui **et** `:focus-visible`. Trois
états, sans exception.

### 7.2 Les champs — l'anneau de focus grandit

```css
input, select, textarea {
  font: inherit;
  font-size: 0.88rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: var(--rayon-petit);
  background: var(--bg-input);
  /* Du verre, comme le reste : le fond de la page monte dans les champs au lieu
     de les laisser en aplat. */
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  color: var(--text-main);
  transition:
    border-color var(--duree-vif) ease-out,
    box-shadow var(--duree) var(--ressort-vif);
}

/* L'ANNEAU GRANDIT au ressort au lieu d'apparaitre. C'est ce qui fait qu'un
   champ se sent vivant sous le clavier. */
input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: none;
  border-color: var(--bony-orange);
  box-shadow:
    0 0 0 3.5px rgba(247, 86, 50, 0.2),
    inset 0 1px 2px rgba(0, 0, 0, 0.12);
}

/* Le survol pose une TEINTE, jamais un anneau : deux anneaux qui se
   ressemblent brouillent la lecture de ce qui a le focus. */
input:hover:not(:focus-visible),
select:hover:not(:focus-visible),
textarea:hover:not(:focus-visible) {
  border-color: var(--glass-border);
}
```

**Attention au `label` nu.** Dans ce projet il porte un style de *libellé de champ* :

```css
label {
  font-size: 0.72rem; font-weight: 700; margin-top: 0.7rem;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;
}
```

C'est juste au-dessus d'un champ, et **faux partout ailleurs**. Un `<label>` employé
comme ligne cliquable autour d'une case à cocher hérite des six propriétés : les libellés
sortent en capitales et la liste se desserre. Il faut alors **remettre les six**, pas
seulement la casse. Si l'autre application le permet, mieux vaut scoper cette règle dès
le départ (`.champ > label`).

### 7.3 Les messages — ils montent

Erreur, succès, information : ce sont les seuls éléments qui surgissent **sans qu'on les
demande**, donc les seuls qui doivent s'annoncer par un mouvement.

```css
.erreur-bloc,
.succes-bloc,
.info-bloc {
  padding: 0.75rem 0.95rem;
  border-radius: var(--rayon-petit);
  font-size: 0.84rem;
  line-height: 1.55;
  animation: volet-monte var(--duree-vif) var(--ressort-doux) both;
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  box-shadow:
    0 10px 26px -10px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.erreur-bloc { background: var(--erreur-fond);    border: 1px solid var(--erreur);    color: var(--erreur); }
.succes-bloc { background: var(--succes-fond);    border: 1px solid var(--succes);    color: var(--succes); }
.info-bloc   { background: var(--attention-fond); border: 1px solid var(--attention); color: var(--attention); }
```

**`--duree-vif` et non `--duree`** : un message doit être là **avant** qu'on ait fini de
lire l'action qui l'a provoqué. C'est le seul endroit de la charte où l'entrée est plus
rapide que la sortie d'un panneau.

---

## 8. La sélection glissante — le geste signature

> **La sélection SE DÉPLACE, elle ne réapparaît pas ailleurs.**

C'est le mouvement qui fait lire une interface comme iOS, **plus que n'importe quel effet
de verre**. Le dégradé était peint sur le segment actif *et* sur la ligne active : il
sautait d'un élément à l'autre.

Il vit désormais sur **un seul élément mobile par groupe**, dont la géométrie est posée
par un hook unique. Dans GRID, ce même mécanisme sert au contrôle segmenté, au curseur de
la liste et à la pastille des onglets de navigation — **trois usages, une implémentation,
à l'axe près.** Ne jamais en écrire un second exemplaire.

### 8.1 Le principe

1. le conteneur porte les cibles (les segments) et **un** élément mobile en
   `position: absolute` ;
2. à chaque changement d'index, on lit `offsetLeft` / `offsetTop` / `offsetWidth` /
   `offsetHeight` de la cible active ;
3. on **écrit `transform`, `width` et `height` directement sur l'élément mobile** ;
4. la transition CSS fait le reste, au ressort ample ;
5. un `ResizeObserver` sur le conteneur **et** sur les cibles replace après tout
   changement de mise en page.

### 8.2 Les quatre pièges, tous mesurés

**a) Une variable CSS dans `transform` NE S'INTERPOLE PAS.**
`transform: translate3d(var(--x), var(--y), 0)` avec une `transition` *semble* correct,
et le style calculé affiche bien la transition — **et rien ne bouge**. Chromium traite le
changement comme **discret** quand la valeur dépend d'une custom property non
enregistrée, et une transition discrète bascule à 50 % de sa durée. Mesure : encore au
départ à 140 ms, arrivé à 840 ms, pour une durée de 560 ms.
**Donc : poser la transformation en dur sur l'élément, ou enregistrer la propriété avec
`@property`.** Aucune erreur, aucun avertissement — ce défaut ne se voit qu'à la mesure.

**b) `getComputedStyle().transform` rend la valeur CIBLE**, pas la valeur animée, pour
une transformation composée par le GPU. L'instrument juste est **`element.getAnimations()`**.
Corollaire : un `scale` en cours **déforme la boîte**, donc une largeur intermédiaire lue
par `getBoundingClientRect` ressemble à une interpolation qui n'existe pas.

**c) L'étirement directionnel doit être RELÂCHÉ séparément.** La pastille s'étire
légèrement dans le sens du déplacement (`scaleX(1.06)`), ce qui fait beaucoup pour la
sensation. Mais s'il partage la transition du déplacement, il est annulé avant d'être
visible : il faut le **tenir** environ 35 % de la durée, puis le relâcher.

**d) Le premier placement se fait en `useLayoutEffect`**, avant le premier peint. Sinon
la pastille apparaît une image en haut à gauche puis saute à sa place.

### 8.3 L'apparence

```css
.segments {
  position: relative;
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--bg-input);
  /* Le rail est du verre lui aussi : c'est ce qui fait que la pastille a l'air
     de flotter DANS quelque chose, et non posee sur un aplat. */
  backdrop-filter: blur(16px) saturate(170%);
  -webkit-backdrop-filter: blur(16px) saturate(170%);
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

/* L'ELEMENT MOBILE — un seul par groupe. */
.segments .pilule {
  position: absolute;
  z-index: 0;
  left: 0;
  top: 0;
  /* Largeur, hauteur et transformation sont posees en DUR par le hook, et non
     lues dans des variables CSS : Chromium n'interpole pas `transform` quand sa
     valeur depend d'une custom property non enregistree — le mouvement
     basculait alors d'un coup a 50 % de la duree. Voir §8.2.a. */
  width: 0;
  height: 0;
  border-radius: 999px;
  background-image: var(--bony-gradient);
  box-shadow:
    0 2px 8px -1px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.34);
  transform-origin: center;
  /* La HAUTEUR suit une courbe plus vive que la position : elle ne change qu'au
     premier placement et sur redimensionnement, et un ressort ample sur une
     hauteur se lirait comme un tremblement. */
  transition:
    transform var(--duree-ample) var(--ressort-ample),
    width var(--duree-ample) var(--ressort-ample),
    height var(--duree-vif) var(--ressort-vif);
  pointer-events: none;
}

.segments .segment {
  position: relative;
  z-index: 1;
  border: none;
  background: none;
  color: var(--text-muted);
}

.segments .segment.actif { color: #fff; font-weight: 600; }

/* L'appui : la BARRE ENTIERE se tasse, pas le segment seul. C'est ce que fait
   iOS, et c'est plus juste — on appuie sur un objet, pas sur une de ses
   parties. */
.segments:has(.segment:active) {
  transform: scale(0.978);
  transition: transform var(--duree-vif) var(--ressort-vif);
}
```

**Accessibilité** : `role="tablist"` sur le conteneur, `role="tab"` +
`aria-selected` sur les segments, navigation aux flèches, et `tabIndex` **uniquement sur
le segment actif** — le groupe est une seule étape de tabulation.

---

## 9. Menus, dialogues, bascules

### 9.1 Tout panneau flottant va dans un PORTAIL

**Trois fois dans la même journée, la même cause.** Voir §10.3 : un panneau en
`position: absolute` disparaît sous n'importe quel ancêtre à `overflow`, et
`position: fixed` seul ne suffit pas si un ancêtre porte un `transform`.

Recette :

1. `createPortal(panneau, document.body)` ;
2. `position: fixed`, coordonnées calculées depuis `getBoundingClientRect()` du
   déclencheur, **posées directement sur l'élément** (pas par un état React : replacer à
   chaque événement de défilement provoquerait un rendu par image) ;
3. replacer sur `scroll` **en phase de capture** (`true`) — le défilement peut venir d'un
   conteneur interne — et sur `resize` ;
4. **choisir le côté le plus spacieux, puis contraindre la hauteur.** Un menu n'a pas à
   tenir entier : sa liste défile. Basculer vers le haut quand ça ne tient pas en bas,
   puis plaquer contre le bord quand ça ne tient nulle part, fait **recouvrir la
   navigation** ;
5. le clic « dehors » doit tester **deux** conteneurs — l'enveloppe *et* le panneau, qui
   n'est plus un descendant ;
6. `Échap` ferme **en rendant le focus au déclencheur**.

`min-height: 0` sur la liste défilante est **indispensable** : sans lui, un enfant
flexible refuse de descendre sous la hauteur de son contenu, et le panneau déborde malgré
son `max-height`.

### 9.2 Les icônes sont des SVG, jamais des glyphes

**Un glyphe de police n'est pas une icône.** `⌄` et `✓` écrits en texte tombent sur une
police de repli : dessin, épaisseur de trait et position sur la ligne de base varient
d'une machine à l'autre, et ni `font-size` ni `line-height` ne rattrapent un dessin qu'on
ne contrôle pas.

```jsx
<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
</svg>
```

**`stroke-linecap` et `stroke-linejoin` arrondis** : c'est le bout de trait arrondi qui
rapproche le dessin d'iOS, plus que la forme. `currentColor` pour que l'icône suive la
couleur du texte sans être repeinte à la main.

**Un chevron TOURNE de 180°**, il ne change pas de glyphe.

### 9.3 Sélection unique ou multiple — deux traitements

| | Sélection **unique** | Sélection **multiple** |
|---|---|---|
| Exemples | onglet actif, segment, ligne active | menu à cocher, liste d'export |
| Traitement | **dégradé plein** sur l'élément mobile | **teinte** (`rgba(247,86,50,.09)` clair, `.16` sombre) |
| Pourquoi | il n'y en a qu'un, il doit dominer | cinq lignes en dégradé = cinq actions principales |

Dans une sélection multiple, **la coche porte l'information, la teinte ne fait que
l'appuyer**.

### 9.4 La bascule iOS

Construite sur une **vraie case à cocher** (`appearance: none`) pour garder rôle, focus
clavier et étiquette.

```css
.interrupteur input[type='checkbox'] {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 2.1rem;
  height: 1.22rem;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  background: var(--bg-input);
  backdrop-filter: blur(10px) saturate(160%);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.22);
  transition:
    background-color var(--duree-vif) ease-out,
    border-color var(--duree-vif) ease-out;
}
/* Le curseur est un ::after qui GLISSE ; l'etat coche pose le degrade sur la
   piste et translate le curseur. */
```

**Ne pas confondre les deux objets** : un interrupteur dit « ce réglage est actif », une
case à cocher dit « cet élément est retenu ». Une liste d'éléments à retenir garde de
**vraies cases**.

### 9.5 Le dialogue modal

```css
.voile-dialogue {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10, 10, 16, 0.42);
  backdrop-filter: blur(4px);
  animation: voile-parait var(--duree-vif) ease-out both;
}
.boite-dialogue {
  width: min(30rem, 100%);
  max-height: min(34rem, 100%);
  display: flex; flex-direction: column;   /* liste interne defilante */
  border-radius: var(--rayon);
  animation: volet-monte var(--duree) var(--ressort-doux) both;
  transform-origin: 50% 0;
}
```

Portail sur `document.body`, `role="dialog"`, `aria-modal="true"`,
`aria-labelledby`, focus posé sur la boîte à l'ouverture, `Échap` qui annule, clic sur le
voile qui annule, et `stopPropagation` sur la boîte.

---

## 10. Les règles apprises à la dure

**Cette section est la plus utile du document.** Chaque règle a coûté une panne ou une
séance de mesure.

### 10.1 Aucune constante ne devine la hauteur d'un élément variable

L'en-tête est `sticky` **et** en `flex-wrap` : sa hauteur vaut 57 px et change dès que les
onglets passent à la ligne. Trois endroits du CSS s'alignaient dessus avec trois nombres
différents — `4.5rem`, `6rem`, `9rem` — et un écran débordait de **167 px** en
1600 × 900, donc une barre de défilement pendant une saisie.

**La coquille mesure l'en-tête par `ResizeObserver` et pose `--h-entete` ; tout ce qui
s'y aligne lit la variable, jamais un nombre.**

### 10.2 La spécificité se COMPTE, pas s'estime

`button:hover:not(:disabled)` vaut **(0,2,1)** — deux pseudo-classes plus un élément — et
**bat** `.ma-classe.mon-etat` en (0,2,0). Pire, elle emploie le **raccourci**
`background`, qui remet `background-image` à `none`.

Conséquence mesurée : un dégradé **disparaît au survol** en gardant son `color: #fff`,
donc du texte blanc sur du verre translucide, illisible en thème clair.

> **Tout élément qui porte le dégradé déclare son propre état survol**, en (0,3,0) au
> moins, et **repose `background-image`**.

### 10.3 `overflow-x: auto` découpe aussi verticalement

CSS **interdit qu'un axe défile pendant que l'autre reste `visible`** : la valeur
*utilisée* de `overflow-y` devient `auto` à son tour. Une carte déclarant seulement
`overflow-x: auto` découpe donc verticalement **sans qu'aucune ligne de CSS ne l'écrive**.

Un panneau `absolute` y disparaît : présent dans le DOM, `visibility: visible`,
dimensionné — et coupé. Le mode d'échec est **entièrement silencieux**.

### 10.4 Un ancêtre en `display: none` retire ses descendants du rendu, impression comprise

Le document imprimable était monté dans un écran, et l'impression masquait la coquille
par `@media print { .application { display: none } }`. **Résultat : des pages blanches**,
sans erreur ni avertissement.

> **Tout ce qui doit échapper à son contexte de mise en page va dans un portail.** Un
> `overflow`, un `transform` ou un `display: none` d'ancêtre rattrape n'importe quel
> positionnement.

### 10.5 `overflow-x: clip`, jamais `hidden`, sur `html` / `body`

Un `overflow` autre que `visible` sur la racine en fait un conteneur de défilement, ce
qui **désarme tout `position: sticky` relatif à la fenêtre**. Mesuré : une barre de
navigation déclarant `sticky; top: 0` partait à **−1 200 px** au défilement, et sur un
écran de 8 900 px on perdait la navigation entière. `clip` découpe pareil **sans créer de
scrollport**.

Un en-tête qui ne colle pas ne produit **aucune erreur** : il se lit comme un choix de
conception, et c'est pour ça qu'il a survécu longtemps.

### 10.6 Un sélecteur d'élément ou descendant large attrape ce qu'on n'a pas encore écrit

Trois occurrences sur ce projet :

- `header { position: sticky }` visait la coquille et a attrapé **dix** éléments — six
  en-têtes d'écran plus quatre en-têtes de panneau, tous collants au même `z-index` ;
- une règle fourre-tout donnait le dégradé à tout `button` ;
- `.liste-vendeurs .detail` imposait sa couleur **et un `grid-area`** à tout `.detail`
  descendant, y compris le compteur d'un contrôle segmenté posé plus tard dans la même
  colonne.

> **Scoper au parent qu'on vise réellement** — `.application > header`,
> `.liste-vendeurs .vendeur .detail`.

### 10.7 Une valeur ne se déclare qu'UNE fois

**Sept occurrences** du même défaut dans un seul fichier. Le motif ne varie jamais : une
section « correctif » ou « finition » ajoutée en bas du fichier, qui re-déclare une
propriété déjà posée plus haut. **Elle se lit comme un ajout et agit comme un
remplacement.**

Les dégâts observés :

- un repli en une colonne annulé 1 700 lignes plus bas → **un mode tablette qui n'a
  jamais fonctionné** ;
- un dégradé peint deux fois sur l'onglet actif → la pastille glissante **doublée à
  l'arrivée et trahie au départ** ;
- un `box-shadow` à deux couches écrasant celui à cinq couches → tout le verre sombre
  **privé de son ombre de contact et de ses liserés internes**.

Deux d'entre elles étaient **consécutives, à six lignes d'écart**. Ce n'est donc pas un
problème de distance dans le fichier : c'est un problème de relecture.

### 10.8 Ces défauts ne se voient QU'AU NAVIGATEUR

Sur ce projet : six suites, 210 contrôles, typecheck des deux côtés, build vert.
**Aucun de ces trois instruments ne regarde la cascade CSS ni la mise en page.** Quatre
défauts visuels ont été trouvés en une journée, dont trois avec un mode d'échec
entièrement silencieux : un dégradé qui disparaît, un compteur gris sur gris, un menu qui
ne s'ouvre pas.

> **Ouvrir la page et mesurer le style calculé fait partie du travail, pas de la
> vérification finale.**

### 10.9 Prévoir une page d'atelier dès le départ

Les écrans sont derrière une authentification, et une session ne se fabrique pas sans
saisir un mot de passe. Sans atelier, la couche visuelle ne peut être jugée que sur
l'écran de connexion — un panneau et un bouton.

L'atelier monte les **vrais** composants avec le **vrai** fichier CSS, sur des données
d'exemple, sans authentification. **Ce n'est pas une maquette** : une maquette qui
réimplémente les styles ne prouve rien.

Avec Vite, un fichier HTML **à la racine** est servi en développement et **exclu du
build** — `vite build` ne prend que `index.html` en entrée. Ne jamais le mettre dans
`public/`, dont tout le contenu part tel quel en production.

### 10.10 Pas de prose de présentation dans l'interface

Les écrans portaient des paragraphes qui expliquaient le produit à lui-même : « remplace
trois onglets du fichier », « rien n'est stocké ». Ce sont des arguments de conception :
ils appartiennent à la documentation.

> **On garde ce qui dit à l'utilisateur ce qui va se passer s'il clique.** On retire le
> reste.

### 10.11 Les données prennent la largeur, la prose non

Le conteneur principal plafonne à **120 rem** : sans borne, une ligne de texte traverse un
écran 4K. Les paragraphes gardent leur propre limite, en `ch` (44 ch est un bon défaut).

### 10.12 Le coût d'affichage d'un contrôle suit sa fréquence d'usage

Une puce par valeur donnait quatre puces pour un filtre et **vingt** pour un autre : deux
rangées pleine largeur qui repoussaient le contenu sous la ligne de flottaison, pour un
réglage qu'on touche une fois par consultation. Au-delà de quelques valeurs, **c'est un
menu déroulant**.

---

## 11. La couche impression — si l'autre application imprime

Deux règles suffisent à éviter les erreurs coûteuses.

**Aucun token de thème dans la feuille d'impression.** `--text-main` et `--bg-panel`
basculent en sombre : un document imprimé depuis un écran sombre sort **en blanc sur
noir**, soit une cartouche par page. **Le papier n'a pas de thème** — les couleurs
s'écrivent en dur.

**Les mesures sont en millimètres, et calculées depuis la feuille.** Sur A4 paysage
(297 × 210 mm, marges 8 mm, soit 281 × 194 mm utiles), un tableau de 12 lignes et
6 colonnes donne des cases de **48 × 13 mm** — ce qui se remplit au stylo sans effort.
La contrainte n'est pas la lisibilité à l'écran, c'est **l'écriture à la main**.

Trois détails techniques :

```css
@page { size: A4 landscape; margin: 8mm; }   /* 8 mm : en dessous, la plupart des
                                                imprimantes de bureau rognent */
th { print-color-adjust: exact;              /* sans ca, Chrome retire les fonds  */
     -webkit-print-color-adjust: exact; }
.page { break-after: page; page-break-after: always;   /* les deux : Safari ne  */
        break-inside: avoid; page-break-inside: avoid; } /* connait que l'ancienne */
```

Et **un filet en dégradé plutôt qu'un bandeau plein** : `border-image` sur 2,4 pt de
haut, seule surface encrée du document. Un bandeau coûterait une bande de toner par page.

---

## 12. Écarts assumés, à réévaluer pour l'autre application

| Choix | Raison sur GRID | À réévaluer si |
|---|---|---|
| **Thème sombre par défaut** | l'écran principal reste affiché des heures, souvent projeté | l'usage est bureautique et diurne |
| **Pas de Tailwind** | contraintes de mise en page propres, et un CDN ajoute une dépendance réseau | l'équipe est nombreuse et la vélocité prime sur le contrôle |
| **Français dans les noms de classes et de tokens** | le vocabulaire métier est français et imposé | l'équipe n'est pas francophone |
| **Un seul fichier CSS** | 4 500 lignes, chargé d'un coup, aucun découpage | dépassement de ~6 000 lignes : découper **par écran**, jamais par type de règle — c'est ce qui produit les déclarations en double du §10.7 |
