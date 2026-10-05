# CLAUDE.md — GRID

## Ce qu'est ce projet

**GRID** — outil web de pilotage des campagnes de relance téléphonique du Groupe Bony
(concessions Renault / Dacia / Alpine). Remplace un classeur Excel de 25 onglets.

Le nom, arrêté le 31/08/2026, suit la boucle du produit :
**G**estion → lancement de session (**R**) → activité (**I**) → classement (**D**) —
et la grille de saisie du module C est littéralement une grille.

### Ce que le renommage NE touche pas, volontairement

Trois usages du mot « relance » restent en place, et ce n'est pas un oubli :

| Usage | Pourquoi il reste |
|---|---|
| Le schéma PostgreSQL `relance` | Le renommer voudrait dire une migration sur les 16 tables pour changer une chaîne que personne ne lit. Risque sans contrepartie |
| Le préfixe `RELANCE:` des messages de trigger | Écrit dans les 19 fonctions de trigger et 13 migrations, et **retiré avant affichage** par `messageLisible` (`services/supabase.ts`). Aucun utilisateur ne le voit |
| Le vocabulaire métier — `relance`, `table_phoning`, `campagne` | C'est le métier, pas le produit. Une « relance » est un appel sortant : le renommer casserait le vocabulaire imposé plus bas |

**Le logotype existe** depuis le 31/08/2026 : `public/grid.svg`, un G taillé dans un
damier de grille de départ, incliné, avec trois traînées de vitesse. Son idée tient en
une phrase — *le module du damier est l'épaisseur du trait*, de sorte que le damier ne
se pose pas sur la lettre, il la constitue. Le dégradé Bony y court d'un seul tenant
(`gradientUnits="userSpaceOnUse"`), traînées comprises.

Ce fichier est la **source unique** : en-tête, écran de connexion et favicon le
référencent tous les trois. Ne jamais le recopier en JSX — ce serait le premier pas
vers deux logos différents dans la même application.

Lire `CAHIER-DES-CHARGES.md` avant toute implémentation fonctionnelle.
Lire `VIABILITE-FREEMIUM.md` avant toute décision d'infrastructure.

**Le cœur du produit est le module C — le planning de saisie.** Tout le reste est du
support. En cas d'arbitrage entre l'élégance d'un écran d'administration et la fluidité
de la saisie, la saisie gagne toujours.

## Où lire quoi

Ce fichier porte le contexte et les règles. Pour l'état réel du code :

| Fichier | Contenu |
|---|---|
| `ETAT-PROJET.md` | Mémoire de référence : ce qui est fait, décisions, lotissement |
| `ETAT-BACKEND.md` | API, base, invariants, sources de vérité uniques |
| `BUGS-CONNUS.md` | Défauts identifiés, corrigés ou non |
| `DEPLOIEMENT.md` | Runbook : Supabase + Cloudflare Workers |

Ne jamais dupliquer leur contenu ici.

`VIABILITE-FREEMIUM.md` avait conclu sur Supabase Auth + Cloudflare Pages. Cette
conclusion a été abandonnée le 31/08/2026 au profit du VPS… puis **reprise le même
jour**, le VPS étant écarté à son tour (« Gearbox reste Gearbox », et
`grid.bonyauto-mobile.com` n'existe pas en DNS). Le document reste néanmoins périmé
sur les chiffres et les détails ; l'architecture réelle est décrite ici. `schema.sql` et `seed_referentiels.sql` sont des
références historiques, remplacées par `backend/prisma/`.

## Stack

Parité structurelle avec GEARBOX (`C:\Users\Operateur\Documents\gearbox3backup`) : même
arborescence, même pipeline, même discipline documentaire.

- Front Vite + React + TypeScript, **à plat à la racine**, port 3000
- **Les utils partagés sont RÉUTILISÉS, pas recopiés.** `agregats.ts`,
  `repartition.ts`, `importMarques.ts`, `tri.ts`, `presenceVendeur.ts` et
  `auth/roles.ts` vivent dans `backend/src/` et sont servis au navigateur — le
  `tsconfig.json` du front les déclare dans son `include`. Leurs 66 contrôles
  valent donc pour le code qui tourne en production. Ne jamais en faire une copie
  côté front : ce serait une seconde implémentation à redémontrer
- **Il n'y a plus d'API.** Le navigateur attaque Supabase en direct — PostgREST pour
  les lectures et les écritures simples, fonctions `security definer` pour tout ce
  qui doit être transactionnel. `backend/` ne conserve que deux choses :
  `prisma/` — schéma, migrations, seed, outils de comptes et les six suites — et
  `src/`, réduit **au seul code que le navigateur exécute**. Express, les 10
  routes, le portail `campagneScope.ts` et le serveur Realtime ont été supprimés
  le 01/09/2026, une fois la bascule constatée en ligne
- Le front appelle Supabase par `supabase-js`, avec `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY`. **Ces deux valeurs partent dans le bundle, c'est normal
  et sans risque** — à condition que `test:rls` soit vert : c'est la RLS qui protège,
  pas la discrétion de la clé
- PostgreSQL 17, schéma `relance`. **Local en développement, Supabase en
  production** — projet `ganeczlhcprljuazldpp`, région `eu-west-3` (Paris)
- Authentification JWT + bcrypt, comptes créés par un administrateur. Pas d'Entra ID
- Déploiement du front sur **Cloudflare Workers** (assets statiques, aucun code
  serveur), relié au dépôt. **`wrangler.jsonc` à la racine est obligatoire** : Workers
  Builds exécute `wrangler deploy` sur `master` et `wrangler versions upload` ailleurs,
  et les deux exigent cette configuration. Sans elle le build réussit et le déploiement
  échoue — un mode d'échec qu'aucune vérification locale ne voit. Les deux commandes se
  contrôlent en `--dry-run`. HTTPS et nom de domaine fournis.
  **Pousser une branche de travail ne met rien en ligne** : `versions upload` ne déploie
  pas, il faut atteindre `master`
- **Aucune ressource partagée avec gearbox.** Exigence textuelle de l'utilisateur :
  « Gearbox reste Gearbox ». Le VPS a été remis dans son état d'origine, il ne reste
  aucune trace de GRID dessus. `grid.bonyauto-mobile.com` n'existe pas en DNS et la
  zone Gandi n'est pas accessible : c'est ce qui a fermé la voie du VPS
- **Les artefacts de mise au point vivent A LA RACINE** : `atelier.html` pour la
  couche visuelle, `patron-export.html` pour le planning imprimable. Vite les sert
  en développement et `vite build` ne prend que `index.html` en entrée, donc ils ne
  partent jamais dans `dist` — vérifié à chaque lot, `dist` contient exactement `index.html`, `grid.svg`, `manifest.webmanifest`, `sw.js` et `assets/` (depuis la PWA, 03/10/2026)
- **Tout ce qui est dans `public/` part TEL QUEL dans `dist`**, donc en production. Une
  page de développement posée là s'y retrouve — constaté avec le banc d'essai liquid
  glass. Un fichier HTML à la RACINE, lui, est servi en développement et **exclu du
  build** : `vite build` ne prend que `index.html` en entrée. C'est là que vivent les
  outils de mise au point, `atelier.html` en premier
- **Sauvegardes à notre charge** : le palier gratuit de Supabase n'en garantit
  aucune, et met le projet en pause après **7 jours d'inactivité** — GRID ne sert que
  quelques jours par mois

**Tout se développe en local d'abord**, puis se rejoue sur Supabase avant d'être cru.
Les deux bases doivent rester identiques : `npm --prefix backend run comparer` le
vérifie objet par objet.

*Le blocage des ports 5432/6543 par le réseau du bureau n'existe plus.* Il figurait
dans ce fichier comme un fait acquis, et il a motivé plusieurs décisions
d'architecture. **Mesuré le 31/08/2026 : les trois hôtes Supabase répondent.**
Migrations, seed et suites tournent donc depuis le poste. À re-mesurer avant de
rebâtir quoi que ce soit sur cette hypothèse — elle a déjà été fausse une fois.

## Interface v2 — ce qui a changé le 03/10/2026

Lots 3 et 4 de `PLAN-GRID-V2.md`. À lire avant de toucher à l'interface.

- **DA Gearbox OS, sans son moteur** : jetons, matière liquid glass (`.verre`),
  primitives aux noms de Gearbox (`.btn`, `.seg`, `.chip`, `.card`, `.kpi`, `.tbl`…),
  dans `styles/v2.css`. Clair ET sombre, toujours en verre.
- **Deux couches CSS** : `styles/composants-anciens.css` vit dans `@layer ancien`,
  `styles/v2.css` dans `@layer v2`, déclarée après — la v2 l'emporte quelle que soit la
  spécificité. **`index.css` est supprimé** (03/10/2026) : ses 4 757 lignes ont été
  filtrées automatiquement (postcss) pour ne garder que les jetons, les `@keyframes`,
  l'impression et les règles des classes encore employées. **Aucun sélecteur d'élément
  nu n'y survit** (`button`, `input`, `header`…) : c'étaient eux, les doubles cadres. Une
  classe portée en v2 se retire de ce fichier ; il disparaîtra avec la dernière.
- **Navigation** : l'Île en haut au bureau, la barre flottante en bas au téléphone
  (`components/coquille/Coquille.tsx`). La goutte est `useIndicateurGlissant` — pas
  un troisième mécanisme. Recherche par la loupe ou `Ctrl K`.
- **Réglages par palier** : mon compte (changer son mot de passe), apparence,
  comptes (admin). Un compte réinitialisé choisit son mot de passe à la connexion.
- **PWA** : `public/sw.js`, écrit à la main. La page passe par le réseau (un
  `wrangler rollback` atteint les postes), les `/assets` hashés par le cache,
  **jamais Supabase**. Une nouvelle version s'annonce, elle ne recharge jamais seule.
- **Code découpé** : la saisie part au premier chargement, le reste à la demande ;
  l'export Excel (874 Ko) ne se charge qu'au clic.

## Charte Bony

Reprise de GEARBOX à l'identique. Source : `gearbox3backup/index.html`.

| | |
|---|---|
| Orange | `#f75632` |
| Violet | `#8f12ab` |
| Bleu | `#293f74` |
| Dégradé | `linear-gradient(to right, #f75632, #8f12ab)` |
| Titres | **Syncopate** 400/700 |
| Texte | **Albert Sans** |

Les tokens portent **les mêmes noms** que sur GEARBOX — `--bg-main`, `--bg-panel`,
`--text-main`, `--text-muted`, `--border-color`, `--glass-*`, `--wash-*` — et les classes
de la couche liquid glass sont identiques : `.glass`, `.glass-strong`, `.glass-menu`.
Porter un écran d'un projet à l'autre ne demande donc aucune traduction.

### Règles de la couche visuelle — apprises à la dure

**Le dégradé Bony s'OBTIENT, il ne s'hérite pas.** Une règle fourre-tout le donnait à tout
bouton d'un écran, avec une liste d'exceptions qui s'allongeait
(`:not(.lien):not(.onglet):not(.secondaire)…`). Elle a fini par attraper les segments du
tableau de bord, les en-têtes de colonne triables et les cartes de vendeur du module B :
trois surfaces en dégradé plein, côte à côte, illisibles — et aucune ne réagissait au survol.

La règle est **inversée** : `button` est neutre par défaut, `.principal` porte le dégradé.
**Une action principale par écran, deux au plus.** Le mode d'échec change de sens — un bouton
oublié est discret au lieu d'être agressif.

**Tout ce qui est cliquable réagit** : survol, appui, et `:focus-visible`. La saisie du module
C se fait au clavier, donc le focus doit se voir.

**Le fond est vivant.** Le dégradé tamisé vit sur **trois** couches — `body::before`
(17 s), `body::after` (23 s) et `.application::before` (31 s), cette dernière parce que
`body` n'a que deux pseudo-éléments et qu'un `div` de décor dans le DOM ne se justifie
pas. Les trois périodes sont **premières entre elles**, donc la combinaison ne se répète
qu'au bout de 17 × 23 × 31 ≈ 3,4 heures : l'œil ne peut pas y trouver de boucle.
*(Ce paragraphe annonçait « deux couches, 38 s et 61 s ». Les deux chiffres étaient faux
et la troisième couche manquait — relevé le 10/09/2026 en extrayant les valeurs réelles
pour la charte.)* Animées en `transform` et non en `background-position` : la transformation est
composée par le GPU, alors que repeindre trois dégradés radiaux plein écran à chaque image se
voit pendant une saisie. `prefers-reduced-motion` la fige.

**Le verre laisse passer la couleur.** Les fonds de panneau étaient trop opaques (0,58) : le
dégradé ne montait pas dedans, et l'interface se lisait comme des rectangles gris sur du noir.
C'est le flou qui rend le texte lisible, pas l'épaisseur du fond. Un panneau se lit à trois
choses — ce qu'on voit à travers, un liseré clair sur l'arête haute, une ombre douce dessous.

**Les barres de défilement sont à la charte** (`::-webkit-scrollbar` + `scrollbar-color` pour
Firefox) : les barres système traversaient l'interface en gris clair.

**Les données prennent la largeur, la prose non.** `main` plafonne à 120 rem — sans borne, une
ligne de texte traverse un écran 4K. Les paragraphes gardent leur propre limite en `ch`.

**Aucune constante ne devine la hauteur d'un élément variable.** L'en-tête de l'application
est `sticky` ET en `flex-wrap` : sa hauteur vaut 57 px et elle change dès que les onglets
passent à la ligne. Trois endroits du CSS s'alignaient dessus avec trois nombres
différents — `4.5rem`, `6rem`, `9rem` — et l'écran de saisie débordait de 167 px à
1600×900, donc une barre de défilement pendant une session. `App.tsx` mesure l'en-tête par
`ResizeObserver` et pose `--h-entete` ; tout ce qui s'y aligne lit la variable. Le
commentaire de la section « grille » d'`index.css` prédisait ce défaut, deux fois, avant
qu'il n'arrive.

**`overflow-x: clip`, jamais `hidden`, sur `html`/`body`.** Un `overflow` autre que
`visible` sur la racine en fait un conteneur de défilement, ce qui **désarme tout
`position: sticky` relatif à la fenêtre**. Mesuré le 03/09/2026 : la barre de navigation
déclarait `sticky; top: 0` et partait à −1200 px au défilement — sur l'écran Vendeurs, qui
fait 8 900 px, on perdait la navigation entière. `clip` découpe pareil sans créer de
scrollport. Un en-tête qui ne colle pas ne produit aucune erreur : il se lit comme un choix
de conception, et c'est pour ça qu'il a survécu si longtemps.

**Un sélecteur d'élément attrape ce qu'on n'a pas prévu.** `header { position: sticky }`
visait la coquille et attrapait les six `.ecran-entete` plus les quatre en-têtes de
panneau : dix éléments collants à la même hauteur et au même `z-index`. Ce qui relève de la
coquille se scope à la coquille — `.application > header`. C'est la même leçon que la règle
fourre-tout qui donnait le dégradé à tout `button`.

**Une règle déclarée deux fois dans `index.css` défait la media query qui est entre les
deux.** Le repli en une colonne de la saisie était écrit, puis annulé 1 700 lignes plus bas
par un second `.saisie-corps` de même spécificité : **le mode tablette n'a jamais
fonctionné**, alors que F-C.9 le vise explicitement. Une valeur ne se déclare qu'une fois,
et un « correctif » ajouté en fin de fichier se fond dans la règle d'origine. C'est le
troisième cas dans ce fichier après `main { max-width }`.

**La sélection SE DÉPLACE, elle ne réapparaît pas ailleurs.** C'est le mouvement qui fait
lire une interface comme iOS, plus que n'importe quel effet de verre. Le dégradé Bony était
peint sur le segment actif et sur la ligne de vendeur active : il *sautait*. Il vit
désormais sur **un seul** élément mobile par groupe, dont la géométrie est posée par
`hooks/useIndicateurGlissant.ts` — la pastille du contrôle segmenté et le curseur de la
liste du module C sont le même mécanisme, à l'axe près. Ne jamais en écrire un troisième
exemplaire.

**Une variable CSS dans `transform` NE S'INTERPOLE PAS.** Piège coûteux, mesuré le
04/09/2026. `transform: translate3d(var(--x), var(--y), 0)` avec une `transition` semble
correct, le style calculé affiche bien la transition — et rien ne bouge : Chromium traite
le changement comme **discret** quand la valeur dépend d'une custom property non
enregistrée, et une transition discrète bascule à 50 % de sa durée. Mesure : encore au
départ à 140 ms, arrivé à 840 ms, pour une durée de 560 ms. **On pose donc la
transformation en dur sur l'élément mobile** (ou on enregistre la propriété avec
`@property`). Aucune erreur, aucun avertissement : ce défaut ne se voit qu'à la mesure.

**Le mouvement se mesure avec `getAnimations()`, jamais avec `getComputedStyle()`.** Pour
une transformation composée par le GPU, `getComputedStyle().transform` rend la valeur
CIBLE et non la valeur animée — j'ai conclu deux fois de travers avant de m'en apercevoir.
Et un `scale` en cours déforme la boîte : une largeur intermédiaire lue par
`getBoundingClientRect` ressemble à une interpolation qui n'existe pas. Corollaire : **le
volet navigateur de l'agent n'est pas un instrument de mesure du mouvement** — masqué, son
compositeur ne produit aucune image, les transitions rapportent `running` avec un
`progress` figé à 0, et les images par seconde valent 0. La fluidité se juge dans une vraie
fenêtre, par l'utilisateur.

**Les ressorts sont calculés, pas choisis à l'œil.** Trois caractères et pas un de plus —
`--ressort-ample`, `--ressort-vif`, `--ressort-doux` — échantillonnés depuis un oscillateur
amorti et figés en `linear()`, donc interpolés par le compositeur : aucun JavaScript par
image. Un `ease-out` n'arrive jamais au-delà de sa cible ; un ressort si, et c'est ce
dépassement qui fait le geste iOS.

**La réfraction par carte de déplacement SVG ne sert à rien ici, c'est mesuré.** Les deux
bibliothèques de référence (`rdev/liquid-glass-react`, `ybouane/liquidglass`) sont faites
pour du verre posé sur des photos. Sur le fond de GRID — un dégradé sombre et doux — il n'y
a aucun détail haute fréquence à tordre, et `filter` sur un élément qui porte
`backdrop-filter` **perd le découpage du `border-radius`** dans Chromium, sans que
`clip-path` ni `overflow: hidden` ne le rattrapent. Le verre se fait donc en couches CSS :
ombre double (diffuse + contact), liseré pondéré vers le haut, arc spéculaire.

**Une classe seule ne tient pas un fond contre les règles génériques de `button`, et
la spécificité se COMPTE.** `button:hover:not(:disabled)` vaut **(0,2,1)** — deux
pseudo-classes plus un élément — et bat `.ma-classe.mon-etat` en (0,2,0). Pire, elle
emploie le **raccourci** `background`, qui remet `background-image` à `none` : un
dégradé disparaît au survol en gardant son `color: #fff`, donc du texte blanc sur du
verre translucide. Mesuré le 08/09/2026 sur les puces de filtre. Tout élément qui
porte le dégradé Bony doit déclarer son propre état survol, comme
`.principal:hover:not(:disabled)` le fait depuis toujours.

**Un sélecteur descendant large attrape ce qu'on n'a pas encore écrit.**
`.liste-vendeurs .detail` visait la ligne de vendeur et imposait sa couleur — plus un
`grid-area` — à tout `.detail` descendant : le compteur d'un segmenté posé en tête de
liste est devenu gris sur le dégradé. Son pendant actif était pourtant **déjà** scopé
`.vendeur.actif`. C'est la même leçon que `header { position: sticky }`, et la règle
est la même : scoper au parent qu'on vise réellement.

**Deux semantiques opposees ne partagent pas un composant.** `MenuMultiple` est un
filtre : rien de coche veut dire TOUT. Le dialogue d'export est une selection : rien
de coche veut dire RIEN. Les plier ensemble demanderait un drapeau « le vide veut
dire tout ou rien ? », donc de lire ce drapeau pour comprendre chacun des deux
usages. Elles partagent une apparence, ce qui est le travail du CSS.

**Un glyphe de police n'est pas une icone.** « ⌄ » et « ✓ » écrits en texte
tombent sur une police de repli : dessin, épaisseur de trait et position sur la
ligne de base varient d'une machine à l'autre, et ni `font-size` ni `line-height` ne
rattrapent un dessin qu'on ne contrôle pas. Les icônes sont des **SVG** à
`stroke-linecap` arrondi, en `currentColor` — c'est le bout de trait arrondi qui
rapproche le dessin d'iOS, plus que la forme.

**Un état sélectionné dans une liste à choix MULTIPLE reçoit une teinte, pas le
dégradé plein.** Cinq lignes en dégradé Bony feraient cinq actions principales dans
un menu. La coche porte l'information, la teinte ne fait que l'appuyer. Le dégradé
plein reste réservé à la sélection UNIQUE — pastille du segmenté, onglet actif,
curseur de liste.

**Tout ce qui doit echapper a son contexte de mise en page va dans un PORTAIL.**
Trois fois dans la meme journee : un panneau de menu decoupe par
`overflow-x: auto`, un dialogue modal, et le document imprimable — ce dernier
serait sorti en **pages blanches**, parce qu'il etait descendant de `.application`
que `@media print` masque, et **un ancetre en `display: none` retire ses
descendants du rendu, impression comprise**. Un `overflow`, un `transform` ou un
`display: none` d'ancetre rattrape n'importe quel positionnement.

**Un panneau flottant va dans un PORTAIL, jamais en `position: absolute` dans son
parent.** `.carte` déclare `overflow-x: auto` — et CSS interdit qu'un axe défile
pendant que l'autre reste `visible` : la valeur **utilisée** de `overflow-y` devient
`auto`. Une carte découpe donc verticalement **sans qu'aucune ligne de CSS ne
l'écrive**. Un menu `absolute` y disparaît : présent dans le DOM, visible,
dimensionné, et coupé. `position: fixed` seul ne suffit pas non plus — un ancêtre
`transform` redéfinit le bloc conteneur, et le projet en porte plusieurs. Voir
`components/MenuMultiple.tsx`.

**Le coût d'affichage d'un filtre suit la fréquence à laquelle on s'en sert, pas le
nombre de valeurs qu'il porte.** Une puce par valeur donnait vingt puces sur deux
rangées pour les sites, et repoussait les graphiques sous la ligne de flottaison.
Au-delà de quelques valeurs, c'est un menu déroulant.

**Ces défauts-là ne se voient QU'AU NAVIGATEUR.** Les six suites étaient vertes,
`tsc` propre, le build passant. Aucune de ces trois choses ne regarde la cascade CSS.

**Pas de prose de présentation dans l'interface.** Les écrans portaient des paragraphes qui
expliquaient le produit à lui-même — « remplace trois onglets du fichier », « rien n'est
stocké », « jamais l'astuce `valeur − ROW()/1000000` ». Ce sont des arguments de conception,
ils appartiennent aux `.md`. La règle : **on garde ce qui dit à l'utilisateur ce qui va se
passer s'il clique** (clôturer fige la campagne, archiver conserve les RDV, les deux formats
de collage acceptés), on retire le reste.

**Écart assumé : pas de Tailwind.** GEARBOX le charge depuis un CDN ; ici tout est en CSS
simple, dans `index.css`. Deux raisons — la grille du module C impose ses propres
contraintes de mise en page et ne gagnerait rien à des classes utilitaires, et Tailwind
par CDN ajoute une dépendance réseau au démarrage. La charte, elle, est identique.

**Thème sombre par défaut**, bascule dans l'en-tête (`contexts/ThemeContext.tsx`,
classe `dark` sur `<html>`). Le choix du sombre est métier : le module C reste affiché des
heures pendant une session, souvent projeté sur un écran collectif.

**Logo.** Le logotype GEARBOX est un logotype *produit*, pas la marque du groupe : il n'est
pas réutilisé. Le logotype GRID est la marque `public/grid.svg` posée devant le mot
`GRID` composé en Syncopate dans le dégradé (`.logotype`, `.logotype-marque`,
`.logotype-mot`) — voir le début de ce fichier.

## Vocabulaire métier — à respecter dans le code

Le code est en français pour les termes métier. Ne pas traduire.

| Terme | Sens |
|---|---|
| `plaque` | regroupement de sites. CENTRE (alias EAA), NORD, SUD, SUD-OUEST |
| `site` | concession |
| `vendeur` | commercial |
| `table_phoning` | groupe de vendeurs pour **une** campagne, animé par un chef de table |
| `encadrant` | chef de site ou chef de vente. **Une personne avec un compte**, jamais un vendeur |
| `campagne` | exercice de relance daté, porte ses jours et ses créneaux |
| `session` | croisement campagne × plaque, porte le mode d'organisation |
| `rdv` | rendez-vous obtenu |
| `VN` / `VO` | véhicule neuf / véhicule d'occasion |
| `relance` | campagne d'appels sortants |
| `conquete` | prospection de non-clients |

## L'encadrement — la notion la plus facile à se tromper

**Un encadrant est une PERSONNE AVEC UN COMPTE, pas un vendeur.** Je m'y suis trompé une
fois, en faisant du chef de site et du chef de vente deux drapeaux sur `vendeur`. Ça cassait
le cœur de l'exercice, et voici pourquoi, dans les mots de l'utilisateur :

> « Par le biais des tables on fait des groupes le plus hétérogène possible. Je mets
> 5 vendeurs de 5 concessions différentes, et un chef de vente en chef de table d'une **autre**
> concession pour les coacher. Ça fait de la mixité et c'est tout l'intérêt du truc. »

Avec des drapeaux sur `vendeur`, le sélecteur ne pouvait proposer que les vendeurs du site
courant : **la mixité était littéralement inexprimable**.

Le modèle juste :

| Rattachement | Table | Portée |
|---|---|---|
| Encadrant → site | `encadrement_site` | **durable**, hors campagne |
| Chef de table → table | `table_phoning.chef_utilisateur_id` | **une** campagne |

Un même compte peut encadrer plusieurs sites ET animer une table sur une troisième plaque.
Un vendeur qui est aussi encadrant existe des deux côtés, relié par `vendeur.utilisateur_id`.

**Les quatre paliers de compte :**

| Palier | Administration | Gestion des comptes | Saisie |
|---|---|---|---|
| `admin` | oui | **oui** | tout |
| `direction` | oui | non | tout |
| aucun rôle — *encadrant* | non | non | ses sites et ses tables |
| `lecteur` | non | non | rien |

La frontière entre les deux paliers hauts n'est pas cosmétique : sans elle, `direction`
pourrait se promouvoir `admin`.

## Interdits absolus

Ces règles ne se négocient pas, y compris si l'utilisateur demande le contraire dans
l'urgence. Si une demande les enfreint, le dire et proposer l'alternative.

1. **Aucun `DELETE` sur les données métier — sauf par la porte de purge.**
   Archivage par `archive_le` / `date_sortie`. La perte de l'historique de campagne
   est irréversible et c'est exactement ce que l'outil est censé empêcher.

   *Reformulation du 31/08/2026, sur décision de l'utilisateur.* La règle disait
   « aucun `DELETE`, jamais ». Elle rendait impossible de retirer un vendeur créé par
   erreur : la liste ne pouvait que grossir. Deux niveaux ont donc été introduits, et
   la protection de fond est intacte :

   - la **poubelle** de l'écran Vendeurs **archive** — la ligne disparaît, ses RDV
     restent en base, les totaux des campagnes passées ne bougent pas. Réversible ;
   - le volet **Archivage** offre une **purge** définitive, RDV compris. Elle exige
     que le vendeur soit *déjà archivé* et que son nom exact soit retapé.

   **Par défaut, aucun `DELETE` ne passe, sur aucune table.** Il existe UNE porte,
   nommée, ouverte pour la durée d'UNE transaction :
   `SET LOCAL relance.purge_autorisee = 'oui'`. `SET LOCAL` meurt avec la
   transaction — elle ne peut pas rester ouverte par oubli, et aucune autre session
   n'est affectée. Un `ALTER TABLE ... DISABLE TRIGGER` aurait désarmé le garde-fou
   pour tout le monde, y compris pendant une session de saisie.

   *Correction du 31/08/2026 :* cette section annonçait « un seul appelant
   légitime, `DELETE /api/vendeurs/:id` ». Il y en avait **deux** — la suppression
   d'un compte ouvrait la même porte. Et les deux ont déménagé : elles vivent
   maintenant **à l'intérieur** de `relance.vendeur_purger()` et
   `relance.utilisateur_purger()`, deux fonctions `security definer`.

   La protection en sort renforcée : **aucun droit `DELETE` n'est accordé à
   personne, sur aucune table**. La porte n'existe donc plus que dans ces deux
   fonctions, qui exigent toujours que la ligne soit *déjà archivée* et que le nom
   exact soit retapé. Trois serrures au lieu d'une — pas de `GRANT`, pas de
   politique `FOR DELETE`, et les 19 triggers. `test:garde-fous` et `test:rls`
   couvrent les deux sens : le refus par défaut ET l'ouverture sur demande.
2. **Aucun agrégat stocké en base.** Pas de colonne `total_rdv`, pas de compteur
   dénormalisé, pas de table de synthèse. Tout se calcule en lecture par vue ou
   requête. C'est la cause racine de la fragilité du fichier Excel : 677 références
   figées vers des totaux maintenus à la main.
3. **Aucune structure en dur dans le code.** Les 4 plaques, les **20** sites — 19 à
   l'extraction du classeur, Lavaur ajouté le 04/09/2026 —, les 5 jours,
   les 11 créneaux, les 3 marques sont des **données**. Toute constante trouvée en dur
   dans le code est un bug, même si elle est correcte aujourd'hui.
4. **L'autorisation est portée par la BASE, et elle n'a aucun filet.**

   *Troisième reformulation, le 31/08/2026, et la plus lourde de conséquences.*
   Les deux premières disaient « l'API fait autorité, par un portail unique ».
   **Cette API n'existe plus.** Le front est statique, il porte une clé publique,
   et tout ce qu'il sait, l'utilisateur le sait aussi.

   La RLS est donc désormais **la seule chose** entre un chef de table et les
   données de tout le groupe. Il n'y a rien derrière elle. Une politique oubliée
   n'est pas une régression discrète, c'est une fuite.

   Ce qui n'a pas changé : **le périmètre ne se recopie nulle part.** La vue
   `relance.perimetre_saisie` est la transcription des quatre origines de droit, et
   les politiques comme le front lisent celle-là et rien d'autre.

   Les deux modes d'échec sont **silencieux**, et c'est tout le problème : trop
   fermée, la RLS rend zéro ligne sans erreur ; trop ouverte, tout est lisible
   depuis la console. D'où la règle absolue : **activer la RLS et écrire la
   politique vont ensemble, dans la même migration**, et `test:rls` vérifie les
   deux sens avant tout déploiement.

5. **Pas de mise en forme conditionnelle des droits côté client seul.** Cacher un
   bouton n'est pas une sécurité. Le résumé de droits envoyé au front sert à l'affichage ;
   chaque appel est revalidé côté serveur.
6. **Aucune liste de valeurs dupliquée sans contrôle automatique.** Une note
   « à synchroniser » ne synchronise rien.

   *Reformulé le 01/09/2026.* La règle disait que `utils/verifierInvariants.ts`
   comparait les listes **au démarrage du serveur**. C'était vrai, et c'était le
   bon endroit : la faute se voyait dans la session où elle était commise.
   **Il n'y a plus de serveur** — plus rien ne démarrait, donc plus rien ne
   vérifiait, et l'interdit était redevenu une intention.

   Le contrôle est désormais la suite `test:invariants`
   (`backend/prisma/tester-invariants.ts`), jouée comme les cinq autres et en CI
   par `.github/workflows/invariants.yml`. Il perd l'immédiateté du démarrage et
   gagne de tourner **sur les deux bases**. Il couvre trois familles :

   - les **7 contraintes CHECK** contre les 6 listes de valeurs de `auth/roles.ts` ;
   - les **2 listes de paliers** (`ROLES_GESTION_COMPTES`,
     `ROLES_ADMINISTRATION_REFERENTIELS`) contre `relance.peut_gerer_utilisateurs()`
     et `relance.peut_administrer()` — duplication **née de la bascule vers la
     RLS**, et c'est la frontière qui empêche `direction` de se promouvoir ;
   - la **couverture** : toute liste exportée par `auth/roles.ts` doit être citée
     par l'une des deux familles. Sans quoi une septième liste passerait
     inaperçue, et le contrôle serait vert en ne vérifiant rien de la nouveauté.

   Ce troisième contrôle a payé au premier passage : `ROLES_ADMINISTRATION_REFERENTIELS`
   disait `['admin']` contre quatre implémentations qui donnent l'administration à
   `direction`. Elle n'était lue par aucun code — fausse sans conséquence, donc
   invisible, et prête à égarer la personne suivante.

## Conventions

- Dates affichées en **JJ/MM/AAAA**. En base, `date` ou `timestamptz`, jamais de texte
- Identifiants techniques en `snake_case`, en français
- Clés primaires : `bigint generated always as identity`
- Toute table porte `cree_le`, `cree_par`, et `archive_le` nullable si archivable
- Répartition aléatoire : **graine 42**, systématiquement. Le résultat doit être
  reproductible pour être contestable
- Départage des ex æquo dans les classements : documenté et déterministe. Ne jamais
  reproduire l'astuce Excel `valeur - ROW()/1000000`

## Pièges connus, hérités du fichier source

- **Rattachement site → plaque modifiable.** Ne jamais dériver la plaque autrement que
  par jointure sur `site.plaque_id`
- **Un vendeur change de table entre campagnes.** L'affectation est une relation
  `(campagne, table, vendeur)`, jamais un attribut du vendeur. Une première version du
  modèle avait fait cette erreur
- **Les tables mélangent les sites** au sein d'une même plaque. Vérifié sur les données
  de juin 2026 : la table 1 de CENTRE contient des vendeurs de Clermont, Ussel et Mozac
- **Les marques autorisées par vendeur n'existent pas dans le fichier Excel.** Cette
  donnée doit être fournie par l'utilisateur, jamais devinée. Voir la section TODO de
  `db/seed_referentiels.sql`
- **Un site peut n'avoir aucun vendeur** (cas de l'onglet `MDP`). Ne pas supposer
  qu'un site a au moins un vendeur
- **Le planning imprime n'est PAS la grille de saisie, et on ECRIT dessus.** Les
  encadrants collent ces planches au mur et suivent les RDV au crayon pendant les
  cinq jours, **en notant aussi de nouveaux rendez-vous**. Trois conséquences :
  une case doit pouvoir accueillir un nom écrit à la main (48 × 13 mm sur A4
  paysage, une feuille par vendeur et par marque) ; une section de marque **sans
  aucun RDV** se garde, c'est là qu'ils écriront ; et `PlanningImprimable`
  n'utilise **aucun token de thème** — le papier n'a pas de thème, et une planche
  imprimée depuis l'écran sombre coûterait une cartouche par vendeur
- **Une plaque peut n'avoir aucune table.** NORD et SUD-OUEST sont dans ce cas en
  juin 2026. Le mode `par_site` doit être pleinement fonctionnel, pas un cas dégradé
- **L'effectif n'est PAS le nombre de présents.** C'est le nombre de vendeurs
  **mobilisés**, et `backend/src/utils/agregats.ts` (`mobilisation()`) en est la
  source unique : en mode par table, la **réserve** — les vendeurs affectés à aucune
  table — ne compte pas, **sauf si elle a saisi des RDV**. Arbitré par l'utilisateur
  le 08/09/2026 après le premier exercice réel. La conséquence assumée est consignée
  dans `BUGS-CONNUS.md` sous « ACCEPTÉ » : **ne pas la « corriger »**
- **Un agrégat juste, appelé avec le mauvais périmètre, produit un chiffre faux que
  RIEN ne signale.** Le graphique « par jour » du tableau de bord recevait tous les
  vendeurs alors que l'écran en affichait un sous-ensemble filtré : la fonction était
  correcte et testée, l'appel était faux. `tsc` valide, la suite est verte, et le
  chiffre est faux. Tout écran qui filtre doit **recalculer** ses agrégats sur le
  sous-ensemble — en rejouant la fonction pure, jamais en recodant le comptage — et le
  dire à l'utilisateur par une étiquette, sans quoi deux nombres se contredisent sur le
  même écran
- **« Ma table » et « mon équipe de vente » sont deux origines, pas deux valeurs.**
  Un vendeur de ma concession que j'ai placé dans ma table appartient aux deux, et
  doit apparaître dans les deux filtres. `VendeurSaisie` porte donc deux booléens

## Style de travail attendu

L'utilisateur est exigeant et méthodique. Il préfère être contredit tôt qu'accompagné
dans une erreur.

- **Inspecter avant de modifier.** Ne jamais supposer la structure d'un fichier ou
  d'une table : la lire
- **Ne pas deviner en silence.** Toute ambiguïté qui change le résultat se pose en
  question courte et chiffrée avant l'exécution, pas après
- **Déclarer toute correction non demandée.** Aucune modification silencieuse
- **Le contredire quand c'est justifié.** Avec les chiffres à l'appui
- Réponses directes et structurées. Pas de remplissage, pas de préambule

## Pipeline standard, du prompt au code en ligne

Repris de GEARBOX.

1. **Modifications locales** sur une branche `fix/…`, `feat/…` ou `chore/…`.
2. **Vérification locale avant tout commit** — le front lancé, et un vrai test
   dans le navigateur, pas seulement `tsc --noEmit`. Toute migration se joue en local
   d'abord, jamais directement en production.
3. **Si les tests locaux passent : mettre à jour les `.md` AVANT de pousser.**
   `ETAT-PROJET.md`, `ETAT-BACKEND.md` si le backend bouge, `BUGS-CONNUS.md` (cocher ce
   qui est corrigé, ajouter ce qui a été découvert). La doc fait partie du lot livré —
   jamais « je documenterai après », c'est trop tard : un déploiement non documenté fait
   repartir la session suivante sur de fausses bases.
4. Commit, puis **STOP avant le push** : montrer le diff et attendre un OK explicite.
5. **Migrations sur Supabase**, puis `comparer` pour prouver que les deux bases sont
   identiques, puis les suites rejouées **sur Supabase**. Compte rendu de ce qui a
   réellement tourné, jamais de ce qui était prévu.
6. **Le front ne part tout seul que depuis `master`.** Un push sur une branche de
   travail déclenche bien un build Cloudflare, mais sa commande de déploiement est
   `wrangler versions upload`, qui téléverse une version **sans la mettre en ligne**.
   Vérifier le déploiement, pas seulement le build : les deux échouent séparément.

## Commandes

```bash
# Base locale — PostgreSQL 17, service postgresql-x64-17
psql -h localhost -U postgres -d relance

# Migrations. `prisma migrate dev` refuse de tourner sans terminal interactif ici :
node scripts/nouvelle-migration.mjs <nom_en_snake_case>   # écrit le dossier
npm --prefix backend run migrate:deploy                   # applique

# Seed, idempotent et rejouable
npm --prefix backend run seed

# Changer un mot de passe. Par variable d'environnement et non par argument :
# les arguments d'un processus sont lisibles par les autres processus de la
# machine, et ils restent dans l'historique du terminal.
MOT_DE_PASSE="..." npm --prefix backend run mot-de-passe -- admin
npm --prefix backend run mot-de-passe          # sans argument : liste les comptes

# Relier un compte a Supabase Auth. Il faut bien creer le PREMIER : l'Edge
# Function exige un appelant `admin` deja connecte. Sans argument, liste qui est
# relie et qui ne l'est pas.
npm --prefix backend run comptes-auth
MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- admin
MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- --tous

# Comptes de test — un par périmètre, pour éprouver les vues et la saisie.
# Idempotent. Sans MOT_DE_PASSE, il en tire un au hasard et l'affiche une fois.
MOT_DE_PASSE="..." npm run comptes-test

# Les sept suites de vérification. Aucune ne doit passer au rouge.
npm --prefix backend run test:garde-fous    # 39 invariants, chacun doit REFUSER
npm --prefix backend run test:rls           # 116 contrôles des politiques ET des RPC
npm --prefix backend run test:invariants    # 13 contrôles code <-> base (interdit n.6)
npm --prefix backend run test:import        # 19 tests du parseur, fonctions pures
npm --prefix backend run test:agregats      # 36 tests des totaux, contre les 1107 RDV de juin
npm --prefix backend run test:repartition   # 20 tests de la répartition graine 42
npm --prefix backend run test:suivi         # 24 tests des indicateurs du suivi (fichier de suivi fictif, en mémoire)

# Les 1107 RDV de juin, en base depuis le 01/09/2026. SANS `--reel`, il n'écrit
# RIEN et vérifie tout : c'est le garde-fou permanent de la pagination.
set -a; . ./.env.production; set +a
MOT_DE_PASSE="..." npm --prefix backend run importer-juin            # vérifie
MOT_DE_PASSE="..." npm --prefix backend run importer-juin -- --reel  # écrit ce qui manque

# TOUTES SE JOUENT SUR LES DEUX BASES, et c'est le seul usage correct : une suite
# verte en local ne dit rien de la production. Pour viser Supabase, charger son
# environnement sans jamais l'afficher — le mot de passe ne doit pas finir dans
# l'historique du terminal ni dans les arguments d'un processus :
set -a; . ./backend/.env.supabase; set +a; export DATABASE_URL="$DIRECT_URL"

# Comparer les deux bases objet par objet — tables, colonnes, CHECK, triggers,
# fonctions, vues, politiques, index, migrations. « Migrations appliquées » ne
# prouve pas que les deux schémas se ressemblent ; ceci le prouve.
npm --prefix backend run comparer -- "<url de la base de référence>"

# `test:api` (43 contrôles) a été SUPPRIMÉE avec l'API qu'elle testait. Son rôle est
# repris par `test:rls`, qui vérifie les deux sens sur chaque palier.

# Serveur — IL N'Y EN A PLUS QU'UN. Le front attaque Supabase en direct : rien à
# lancer à côté, et rien à proxifier (le proxy `/api` de `vite.config.ts` a été
# retiré, il pointait vers un Express disparu).
npm run dev                    # front sur 3000

# Typecheck. Celui du backend couvre désormais `prisma/**` — les six suites et
# les outils de comptes n'étaient JAMAIS typecheckés : `include` ne portait que
# sur `src/**`, dont il ne reste que le code partagé avec le navigateur.
npx tsc --noEmit                        # front
cd backend && npx tsc --noEmit          # backend + les suites
npm --prefix backend run prisma:validate

# Dérive Prisma — doit répondre « This is an empty migration. »
cd backend && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

**Une suite de sécurité ne dépend PAS des données de production.** `test:rls`
empruntait des comptes réels et supposait leur configuration — « la première table de
juin », « `sbesson` n'a aucun encadrement ». Le jour où l'outil a commencé à servir,
deux gestes légitimes faits depuis l'interface l'ont fait tomber à 82/87 sans qu'aucun
échec ne dise quoi que ce soit sur la RLS ; et archiver les comptes `.test` la
**désarmait entièrement**, 0 contrôle exécuté, en silence. Elle fabrique désormais son
propre monde dans la transaction de chaque contrôle. Même règle pour
`test:garde-fous` : les fixtures doivent être **créées**, jamais **choisies** en base. Ce qui
doit être éprouvé, c'est la contrainte, pas l'état de la base ce jour-là.
*Ce n'est PAS encore le cas de `test:garde-fous`* : il s'appuie sur la vraie campagne
« Juin 2026 », et sa clôture le 02/10 l'a fait tomber à 34/39 sur Supabase. Voir
`BUGS-CONNUS.md`.

**Toute lecture paginée porte un ORDRE STABLE, et pas seulement un contrôle de
volume.** `LIMIT/OFFSET` sur une requête non ordonnée n'a aucune stabilité garantie :
la page 2 peut répéter des lignes de la page 1 et en omettre d'autres. On rapatrie
alors le **bon nombre** de lignes et pas les **bonnes** — le contrôle de volume passe
au vert pendant que les totaux sont faux. Constaté le 01/09/2026 sur les 1107 RDV de
juin : total juste, ventilation VN/VO fausse, trois sites sur-comptés. Invisible tant
qu'aucune campagne ne dépassait 1000 RDV. `toutesLesLignes` exige donc une colonne
d'ordre **en paramètre** et l'applique elle-même : ce n'est pas une consigne, c'est
une signature. Prendre la clé primaire, jamais une colonne non unique.

**Les agrégats se vérifient contre le fichier réel.** `test:agregats` donne aux fonctions
pures de `utils/agregats.ts` les 1107 RDV de juin 2026 **en mémoire** — rien n'entre en base —
et compare aux quatre séries de totaux indépendantes du classeur : par vendeur, par site, par
table, par jour. C'est le critère de recette n°4, et le seul qui prouve que le modèle est
juste. Le produit existe parce que les agrégats de l'Excel étaient faux : livrer les nôtres
sans pouvoir le démontrer reproduirait le défaut qu'on remplace.

**Un typecheck vert ne prouve rien sur le contrat de l'API.** TypeScript ne vérifie que la
cohérence du front avec ses propres déclarations, jamais avec ce que le serveur renvoie. Une
interface de réponse HTTP laissée en arrière est un mensonge que le compilateur valide — ça a
déjà coûté une page blanche muette sur l'écran Vendeurs. Toute modification de la forme d'une
réponse se répercute **à la main** dans `services/*.ts`, et se vérifie par un appel réel.

Il n'y a **pas de framework de test** dans ce projet, comme dans GEARBOX. Les invariants de
la base sont couverts par `test:garde-fous`, qui vérifie qu'ils se déclenchent réellement —
une contrainte qu'on n'a jamais vue refuser quelque chose n'est pas une contrainte, c'est
une intention.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
