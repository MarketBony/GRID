# BUGS-CONNUS

Mise a jour : 04/09/2026, apres le passage en liquid glass iOS.

Defauts identifies, corriges ou non. Un defaut retire de ce fichier doit avoir ete
verifie, pas seulement corrige de memoire.

---



## [CORRIGE LE 08/09/2026] Deux defauts de CSS que seul le navigateur a montres

Trouves en montant les nouveautes du jour dans `atelier.html`. **Ni le typecheck ni
la relecture du fichier ne pouvaient les voir** : dans les deux cas le CSS ecrit
etait juste, c'est la CASCADE qui en decidait autrement.

### Le degrade d'une puce retenue disparaissait au survol

`.puce-filtre.retenue` posait `background-image: var(--bony-gradient)` et
`color: #fff`. Mesure : `backgroundImage` valait **`none`** des que la souris passait
sur la puce, `color` restant blanc — donc **texte blanc sur verre translucide, et
illisible en theme clair**.

La cause est une specificite, et elle se compte :

| Selecteur | Specificite |
|---|---|
| `button:hover:not(:disabled)` | **(0,2,1)** — deux pseudo-classes + un element |
| `.puce-filtre.retenue` | (0,2,0) — deux classes |

La regle GENERIQUE gagne. Et comme elle emploie le **raccourci** `background`, elle
ne se contente pas de changer la couleur : elle **remet `background-image` a
`none`**.

`.principal` ne tombe pas dans le piege parce qu'il porte deja son propre
`.principal:hover:not(:disabled)` en (0,3,0) — la reponse etait dans le fichier,
quinze cents lignes plus haut. La puce a desormais la sienne, en (0,4,0).

**La lecon, qui vaut pour tout ce qui porte le degrade Bony** : une classe seule ne
suffit pas a tenir un fond contre les regles generiques de `button`. Il faut un etat
survol explicite, et il faut le compter — pas l'estimer.

### `.liste-vendeurs .detail` attrapait un `.detail` qui n'etait pas une ligne

En posant le segmente « ma table / mon equipe » en tete de la liste des vendeurs,
son compteur est devenu **gris sur le degrade**, donc invisible. `.liste-vendeurs
.detail` imposait `color: var(--text-muted)` ET `grid-area: detail` a **n'importe
quel `.detail` descendant de la liste**.

La regle ne visait que la ligne de vendeur : `grid-template-areas` est declare sur
`.liste-vendeurs .vendeur`, et son pendant actif juste en dessous etait **deja**
scope `.liste-vendeurs .vendeur.actif .detail`. L'un des deux etait scope, l'autre
non. Corrige en `.liste-vendeurs .vendeur .detail`.

C'est la meme lecon que `header { position: sticky }` qui rendait dix elements
collants : **un selecteur descendant large attrape ce qu'on n'a pas encore ecrit.**
Celui-ci attendait depuis le premier jour qu'on pose un `.detail` ailleurs dans la
liste.

`.liste-vendeurs .nom` et `.liste-vendeurs .compteur` portent le meme selecteur trop
large. Ils ne mordent pas aujourd'hui, ils sont signales dans le fichier et laisses
en place.

### [CORRIGE LE 08/09/2026] Un panneau flottant decoupe par `overflow-x: auto`

Troisieme defaut du meme lot, et le plus retors : **le menu ne s'ouvrait pas**. Pas
d'erreur, pas d'avertissement — rien.

Mesure au navigateur : le panneau etait **dans le DOM**, `position: absolute`,
`visibility: visible`, `opacity: 1`, **208 x 284 px**. Il etait simplement decoupe.
En remontant la chaine des ancetres a la recherche d'un `overflow` autre que
`visible`, un seul coupable : `.carte`, avec `overflow: auto` sur **les deux axes**.

Or `index.css` ne declare que `overflow-x: auto` sur `.carte`. **CSS interdit qu'un
axe defile pendant que l'autre reste `visible`** : la valeur *utilisee* de
`overflow-y` devient `auto` a son tour. Une carte decoupe donc verticalement sans
qu'aucune ligne de CSS ne l'ecrive — c'est invisible a la relecture du fichier.

Le tableau de bord, lui, fonctionnait : ses filtres sont poses **hors** carte. Il
fonctionnait donc **par chance de placement**, et le composant aurait casse au
premier deplacement.

**Le correctif** : le panneau part dans `document.body` par un portail React, en
`position: fixed`, place depuis le rectangle du bouton. Un portail est immune a
`overflow` **et** a un ancetre `transform` — qui redefinirait le bloc conteneur d'un
`fixed` et redecouperait tout. Le projet en porte plusieurs (les tuiles KPI, les
cartes de vendeur, la barre segmentee), donc raisonner sur les blocs conteneurs
aurait ete un pari.

Deux consequences a ne pas oublier avec un portail :

- **le clic « dehors » doit tester DEUX conteneurs.** Le panneau n'est plus un
  descendant de l'enveloppe : sans le second test, cliquer une option fermait le menu
  avant de la basculer ;
- **les coordonnees se posent directement sur l'element**, pas par un etat React.
  Replacer a chaque evenement de defilement provoquerait un rendu par image — meme
  raison que dans `useIndicateurGlissant`.

### [CORRIGE LE 08/09/2026] Le meme panneau recouvrait la barre de navigation

Trouve juste apres, dans un volet de 535 px de haut. La regle de placement basculait
vers le haut quand il n'y avait pas la place en bas, et **plaquait le panneau contre
le bord** quand il n'y avait la place ni en haut ni en bas. Resultat : un panneau de
284 px pose a 6 px du haut, par-dessus la navigation.

L'erreur de raisonnement etait de vouloir **faire tenir le panneau entier**. Sa liste
defile deja : il suffit de lui donner la place disponible et de le laisser
retrecir — ce qui vaut aussi pour un portable en paysage. Il prend desormais le cote
le plus spacieux, recoit un `max-height` calcule, et c'est la LISTE qui se retreint,
`Tout afficher` restant visible.

Deux details qui ne se devinent pas :

- `min-height: 0` sur la liste est **indispensable** : sans lui un enfant flexible
  refuse de descendre sous la hauteur de son contenu, et le panneau deborde malgre
  son `max-height` ;
- la hauteur se mesure **apres** avoir pose la contrainte, sinon on place le panneau
  d'apres une hauteur qu'il n'a plus.

### [CORRIGE LE 08/09/2026] `html.dark .glass` declare DEUX FOIS, a six lignes d'ecart

Trouve en cherchant l'idiome du verre pour y aligner le menu. Les deux blocs sont
**consecutifs**, meme selecteur, meme specificite :

- le premier pose `background-image` — l'arc speculaire — et un `box-shadow` a
  **cinq couches** : ombre portee, ombre de CONTACT, liseré haut, liseré interne,
  liseré bas ;
- le second ne pose qu'un `box-shadow` a **deux couches**.

Le second gagne. En theme sombre, tout `.glass` et `.glass-strong` perdait donc son
ombre de contact et ses deux liserés internes — precisement les trois choses qui
detachent une plaque de verre du fond. Mesure apres correction : le `box-shadow`
calcule passe de **2 a 5 couches**.

Le premier bloc est visiblement l'intention : son commentaire explique que l'arc
doit etre plus marque en sombre. Le second est un reste d'avant le lot liquid glass,
laisse en place et jamais relu.

**SEPTIEME occurrence de ce defaut dans `index.css`**, apres `main { max-width }`,
`.saisie-corps`, `.segments`, `.glass` / `.glass-strong` (les corps identiques),
`.liste-vendeurs .vendeur.actif` et `.onglet.actif`. Le motif ne varie jamais : une
regle ajoutee sans voir celle qui existait deja, parfois **quelques lignes** plus
haut. Ce n'est donc pas un probleme de distance dans le fichier.

### [CORRIGE LE 08/09/2026] Un glyphe de police servait d'icone

`« ⌄ »` et `« ✓ »` etaient ecrits **en texte** dans le menu deroulant. Signale par
l'utilisateur sur l'ecran : une fleche fine, mal centree, etrangere au reste.

**Un glyphe n'est pas une icone.** Son dessin, son epaisseur de trait et sa position
sur la ligne de base appartiennent a la police qui le rend — et il n'existe aucune
garantie qu'Albert Sans le dessine, donc il tombe sur une police de repli qui varie
d'une machine a l'autre. Ni `font-size` ni `line-height` ne rattrapent un dessin
qu'on ne controle pas.

Remplaces par deux SVG a `stroke-linecap` et `stroke-linejoin` arrondis, en
`currentColor` pour suivre la couleur du texte sans etre repeints a la main. Le
chevron TOURNE de 180 degres au ressort au lieu de changer de glyphe — la meme regle
que les volets, deja ecrite dans `CLAUDE.md`.

### Ce que ca dit du dispositif de verification

Les six suites etaient vertes, `tsc` propre, le build passant — et les **quatre**
defauts etaient la. **Aucune de ces trois choses ne regarde la cascade CSS ni la
mise en page.** Trois d'entre eux avaient un mode d'echec entierement silencieux :
un degrade qui disparait, un compteur gris sur gris, un menu qui ne s'ouvre pas. C'est
exactement ce que le pipeline du projet exige a l'etape 2 (« le front lance, et un
vrai test dans le navigateur, pas seulement `tsc --noEmit` »), et c'est la deuxieme
fois que cette etape paie.

## [ACCEPTE LE 08/09/2026] L'effectif depend des RDV pour les seuls reservistes

**Ce n'est pas un bug a corriger, c'est un arbitrage rendu en connaissance de
cause.** Ecrit ici pour qu'une session suivante ne le « repare » pas.

La regle de `mobilisation()` compte un reserviste dans l'effectif **s'il a au moins
un RDV**. L'effectif depend donc des RDV pour ces vendeurs-la, ce qui heurte le
garde-fou `RANK!AG` — un chiffre historique ne doit pas bouger tout seul.

**L'effet de bord, chiffre avant la decision** : archiver le dernier RDV d'un
reserviste le fait sortir de l'effectif, et **la moyenne MONTE**.

| CENTRE, septembre | effectif | total | moyenne |
|---|---|---|---|
| avant archivage | 26 | 342 | 13,15 |
| apres | 25 | 341 | **13,64 ↑** |

J'ai recommande d'y renoncer, avec ce chiffre. L'utilisateur a maintenu : « si un
reserviste a des RDV c'est qu'il n'a pas pris part a l'exercice par table, mais
neanmoins il a quand meme pris des RDV donc doit etre pris en compte ». La regle
metier prime sur la stabilite du chiffre, et c'est sa decision.

**L'invariant d'origine reste vrai partout ailleurs**, et il est toujours teste : en
mode par site, et pour tout vendeur affecte a une table, l'effectif ne depend PAS
des RDV. Le controle « la moyenne suit l'effectif PRESENT, pas le nombre de RDV »
passe sans modification — son jeu d'essai vit sur une plaque sans table.

## [CORRIGE LE 08/09/2026] GRID par terre en pleine session — l'effet de meute du temps reel

**Le defaut le plus grave rencontre sur ce projet a ce jour**, et le seul qui ait
arrete le travail de 25 personnes. Il n'etait visible ni en typecheck, ni dans les
six suites, ni a deux onglets ouverts : **il ne se declenche qu'a partir d'une
dizaine de postes connectes**.

### Ce qu'on voyait

Le tableau Supabase annoncait POSTGRES et AUTH `unhealthy`, 65 232 requetes de
passerelle sur l'heure, RAM 74 %. Plus personne ne chargeait la page ni ne posait de
RDV.

### Ce qui se passait vraiment — et ce n'etait PAS la base

Mesure en direct, connexion directe a Postgres :

| Instrument | Lecture | Conclusion |
|---|---|---|
| `pg_stat_activity` | 20/60 connexions, CPU 15 %, **rien en attente de verrou** | la base n'est pas bloquee |
| Tout ce qui attendait | `ClientRead` — Postgres attend le CLIENT | c'est PostgREST qui est en retard, pas Postgres |
| `psql` direct | reponse en 160 ms | la base est **saine et rapide** |
| PostgREST par HTTPS | **timeout a 15 s**, y compris `service_role` | le pool de connexions de PostgREST est sature |
| `/auth/v1/health` | **timeout a 15 s** | GoTrue partage l'instance et se fait affamer |

**La base allait bien. Le pool de PostgREST etait plein.** Les requetes n'arrivaient
meme pas jusqu'a Postgres — d'ou une base au repos et une application morte, une
combinaison qui envoie chercher au mauvais endroit.

### La cause

Le trigger `diffuser_rdv()` envoie **un message a TOUS les postes de la campagne** a
chaque RDV. Chaque poste y repondait par un rechargement **complet** :
`chargerSaisie` (7 requetes, dont deux a ~1 s) **et** `chargerDashboard` (agregats de
toute la campagne).

Le cout n'est donc pas la SOMME des saisies et des spectateurs, c'est leur **PRODUIT** :

```
258 RDV/heure  x  ~25 postes  x  ~17 requetes  =  ~65 000 requetes/heure
                                                   pour un pool de 10 connexions
```

Et les 25 postes repondaient **au meme milliseme de seconde**, puisqu'ils reagissent
au meme message. Une meute, pas une charge.

Pire : la RLS empeche le plus souvent un poste de VOIR le RDV qui vient de le
reveiller. Il rechargeait tout son perimetre pour le relire **a l'identique**.

### Le chiffre qui a confirme

`pg_stat_statements`, sur 7 jours : `perimetre_saisie` appele 10 297 fois pour
**9 900 secondes** cumulees, soit **961 ms de moyenne**. Mesure isolee sur la vue :
121 ms d'execution mais **211 ms de PLANIFICATION** — c'est un `CROSS JOIN`
campagne x vendeur avec quatre `EXISTS` par ligne. La vue est intrinsequement chere,
et il n'y a **aucun index a ajouter** : le plan utilise deja les bons. Le probleme
n'etait pas le cout unitaire, c'etait le **nombre d'appels**.

### Le correctif

`hooks/useRechargementCoalesce.ts`, applique a la saisie et au tableau de bord :

1. **Filtre sur le perimetre.** La charge utile porte `vendeurId` et la liste des
   vendeurs est deja en memoire : un evenement qui ne concerne aucun de mes vendeurs
   ne change rien a ma grille, on l'ignore. `tables:modifiees` n'est PAS filtre — mon
   perimetre peut justement changer.
2. **Regroupement** — tant qu'un rechargement est programme, les evenements suivants
   n'en programment pas d'autre. Fenetre de 8 s pour le perimetre, 30 s pour la vue
   d'ensemble, la plus chere.
3. **Gigue aleatoire** jusqu'a la moitie de la fenetre. Sans elle, regrouper ne
   ferait que **decaler la meute** au lieu de la disperser.

**Ce qu'on perd, et c'est assume** : la saisie d'un collegue apparait au bout de la
fenetre au lieu d'apparaitre tout de suite. Le critere de recette n.5 reste tenu, avec
un delai. **Sa propre saisie n'est pas concernee** : elle s'affiche en memoire, sans
passer par la.

### [CORRIGE LE 08/09/2026] La vue d'autorisation etait evaluee UNE FOIS PAR LIGNE

Trouve APRES le retablissement, parce que le produit restait lent : « 10 secondes
par onglet ». Mesure serveur au repos, perimetre de TROIS vendeurs —
`perimetre_saisie` 333 ms, lecture de 49 RDV 538 ms. **Aucun rapport avec le
volume.**

`perimetre_saisie` appelait `utilisateur_courant()` sept fois et
`peut_administrer()` une fois, **a nu**, dans le `WHERE` d'un `CROSS JOIN
campagne x vendeur`. PostgreSQL les evaluait donc **par ligne du produit** :
`loops=96` dans le plan, et `utilisateur_courant()` jusque dans un `Index Cond`.

Les deux fonctions sont `STABLE` — leur valeur ne bouge pas pendant la requete —
mais elles portent `SET search_path`, et **une fonction SQL avec `SET` ne peut pas
etre inlinee**. Chaque evaluation est un vrai appel de fonction, avec sauvegarde et
restauration du GUC. D'ou 211 ms de PLANIFICATION par appel, mesures separement.

Le correctif est une sous-requete scalaire — `(SELECT relance.utilisateur_courant())`
— que le planificateur sort de la boucle et evalue une fois en `InitPlan`.

**Et c'etait deja la convention du projet** : les quinze politiques `*_lecture`
l'ecrivent toutes ainsi. La vue etait le seul endroit a appeler la fonction a nu.
Le defaut n'etait pas une regle manquante, c'etait **une exception a une regle
existante** — le genre le plus difficile a voir, parce que tout le voisinage est
correct.

| Lecture, meme compte, meme serveur | avant | apres |
|---|---|---|
| `perimetre_saisie` (3 vendeurs) | 333 ms | **174 ms** |
| `rdv` sous RLS (49 lignes) | 538 ms | **48 ms** |

La lecture des RDV est **11 fois plus rapide**, et `peut_saisir()` lisant cette vue,
l'ecriture en profite aussi.

**Pourquoi on peut y toucher malgre l'interdit n.4** : la transformation ne peut pas
changer le resultat — les deux fonctions sont `STABLE` et SANS ARGUMENT, donc une
sous-requete scalaire rend exactement la meme valeur. Le corps est recopie a
l'identique depuis la migration d'origine, commentaires compris. Et surtout,
`test:rls` rend **89/89 avant et apres, sur les deux bases**.

### La lecon, pour la prochaine fois

**Une diffusion a N destinataires qui declenche un rechargement chez chacun est
quadratique.** Deux onglets ouverts en developpement ne la font pas voir, et aucune des
six suites ne la voit non plus — elles ne mesurent que des reponses justes, jamais un
cout collectif. Toute reaction a un evenement diffuse doit etre **regroupee et
dispersee** avant d'atteindre la production, et **un evenement qu'on n'a pas le droit
de voir ne doit rien declencher**.

Corollaire d'instrumentation : quand tout attend en `ClientRead` et que `psql` repond
vite, **ce n'est pas la base**. Chercher du cote du client — ici le pool de PostgREST.

Second corollaire, appris dans la meme heure : **une fonction `STABLE` n'est pas une
fonction gratuite.** Si elle porte `SET`, elle n'est pas inlinee, et un appel a nu
dans un `WHERE` est evalue par ligne. Toute fonction d'autorisation citee dans une
vue ou une politique s'ecrit `(SELECT f())`, sans exception — c'est la seule forme
que le planificateur sort de la boucle.

Troisieme : **le compte « avant / apres » d'une suite ne vaut rien pendant qu'on
travaille.** `test:garde-fous` a annonce « residu 2 » sur Supabase ; verification
faite, aucun objet de fixture ne restait (zero vendeur, campagne, table, site ou
compte cree) et les deux lignes etaient de **vrais RDV saisis par des utilisateurs**
pendant que la suite tournait. Un residu se cherche par la NATURE des lignes, pas
par leur nombre.

## Couche liquid glass iOS — 04/09/2026

Demande de l'utilisateur, avec deux depots de reference a combiner :
`rdev/liquid-glass-react` et `ybouane/liquidglass`. Les deux ont ete clones et lus.

### [MESURE] La technique commune aux deux depots ne sert a rien sur ce produit

**C'est le resultat le plus important du lot, et il contredit la premisse de la
demande.**

`rdev` genere une carte de deplacement (SDF de rectangle arrondi, canal rouge = X,
canal bleu = Y) et l'injecte dans un `feDisplacementMap` applique par
`backdrop-filter`. `ybouane` va plus loin : WebGL, rasterisation du DOM par
`html-to-image`, refraction biconvexe, aberration chromatique, Fresnel et specular
Blinn-Phong a quatre lumieres. Le second a ete ecarte d'emblee — il recapture le DOM
**a chaque image** pour tout contenu marque `data-dynamic`, ce qui est inconcevable
sur un ecran qui vit des heures.

La technique de `rdev` a ete montee sur banc, quatre variantes comparees cote a cote
sur des rayures a fort contraste PUIS sur le fond reel de GRID :

| Montage | Sur rayures | Sur le fond de GRID |
|---|---|---|
| flou seul (l'existant) | correct | **le plus beau des quatre** |
| + `filter: url(#refraction)` | torsion visible | **aucune torsion**, coins carres |
| + refraction dans `backdrop-filter` | idem | idem |
| + lumieres | idem | idem |

Deux raisons de fond. Un degrade sombre et doux **n'a aucun detail haute frequence a
tordre** : la refraction n'existe que sur des photos ou des motifs fins. Et `filter`
sur un element qui porte `backdrop-filter` **perd le decoupage du `border-radius`**
dans Chromium — ni `clip-path` (qui s'applique pourtant apres `filter`) ni un
`overflow: hidden` sur le parent ne le rattrapent.

Ces bibliotheques sont faites pour du verre pose sur des photos. Le verre se fait donc
ici en couches CSS, ce qui a l'avantage de marcher dans tous les moteurs et de garder
les coins : ombre double (diffuse + **contact**, comme le `exp(-d²)` + `exp(-d)` du
shader de `ybouane`), liseré pondere vers le haut (son `topBias`), arc speculaire.

### [CORRIGE] Une variable CSS dans `transform` ne s'interpole pas

**Le piege le plus couteux du lot, et il ne se voit qu'a la mesure.**

Premiere implementation de l'indicateur glissant : quatre variables CSS posees sur le
conteneur, et le CSS lisant
`transform: translate3d(var(--ind-x), var(--ind-y), 0)`. C'est elegant, c'est ce que
montrent la plupart des exemples, le style calcule affiche bien la transition — et
**rien ne bouge** :

```
t=0      y = 259 px   (depart)
t=140ms  y = 259 px   <- rien n'a bouge
t=840ms  y = 110 px   (arrivee)
```

Chromium traite le changement comme **DISCRET** quand la valeur depend d'une custom
property non enregistree, et une transition discrete bascule a 50 % de sa duree —
280 ms ici, ce qui colle exactement a la mesure. Aucune erreur, aucun avertissement.

Corrige en posant la transformation **en dur** sur l'element mobile. L'autre remede
serait d'enregistrer les proprietes avec `@property`, qui les rend interpolables ;
ecarte parce que l'animation vit alors sur le conteneur et que la chaine de dependance
devient difficile a suivre.

Mesure apres correction, avant que le compositeur du volet ne se remette a etrangler :
**23 valeurs distinctes et un depassement a 279 px pour une cible a 258** — soit les
8 % du ressort z=0,62. Le mecanisme est le bon.

### [CORRIGE] Deux fausses confirmations, et comment elles ont ete levees

**Ces deux erreurs sont a moi, et elles ont ete affirmees a l'utilisateur avant
d'etre corrigees.** Elles sont consignees parce que l'instrument est le meme la
prochaine fois.

1. **« La pastille en vol : largeur 69 entre 81 et 64 ».** Ce n'etait pas une
   interpolation, c'etait l'etirement `scaleX` qui deformait la boite mesuree d'une
   valeur DEJA arrivee. `getBoundingClientRect` sur un element en cours de mise a
   l'echelle ne dit rien de la position.

2. **`getComputedStyle().transform` rend la valeur CIBLE**, pas la valeur animee,
   pour une transformation composee par le GPU. Mesure qui l'a revele : a +50 ms le
   style calcule affichait deja la position finale ; a +950 ms il affichait un
   etirement retire 760 ms plus tot.

**L'instrument juste est `element.getAnimations()`** — il rend les objets
`CSSTransition`, leur propriete, leur duree et leur etat.

### [A CONNAITRE] Le volet navigateur de l'agent ne mesure pas le mouvement

Et c'est ce qui a rendu les deux erreurs ci-dessus possibles. Masque, son compositeur
ne produit aucune image :

- `requestAnimationFrame` ne se declenche pas — les images par seconde valent `0` ;
- les transitions rapportent `playState: running` avec un `progress` **fige a 0** ;
- les styles calcules montrent les valeurs cibles, jamais les valeurs animees.

**La fluidite se juge dans une vraie fenetre, par l'utilisateur.** C'est pour cela que
`atelier.html` existe.

### [CORRIGE] L'etirement de l'indicateur ne se voyait pas

Mesure : etirement maximal atteint **1,000**, c'est-a-dire aucun. Translation et
etirement vivent dans le MEME `transform`, donc dans la meme transition de 560 ms :
re-cibler l'echelle a 1 seize millisecondes plus tard ne lui laisse pas le temps de
s'eloigner de 1. Il est desormais tenu ~190 ms, soit un tiers de la course.

### [CORRIGE] Le banc d'essai partait en production

Trouve en verifiant le contenu de `dist` avant de livrer. `public/banc-liquid-glass.html`
etait recopie tel quel : **tout ce qui est dans `public/` part dans `dist`**. Un
fichier HTML a la RACINE, lui, est servi en developpement et exclu du build —
`vite build` ne prend que `index.html` en entree. Le banc a ete retire ; `atelier.html`
vit a la racine, et `dist` ne contient que quatre fichiers, verifie.

### [CORRIGE] Le degrade etait peint DEUX FOIS sur l'onglet actif

Trouve en mesurant le style calcule de l'onglet actif apres avoir pose la pastille
glissante : `background-image` valait encore `linear-gradient(...)`.

Un second bloc `.onglet.actif`, ajoute en fin de fichier dans une section
« finition », reposait le degrade et une lueur orange — a specificite egale et plus
bas, donc gagnant. Consequence visible : la pastille glissait bien, mais elle etait
**doublee a l'arrivee** par le fond de l'onglet et **trahie au depart**, l'onglet
quitte gardant sa couleur jusqu'a la fin du trajet.

Le survol des onglets inactifs ne pose plus de fond non plus : avec une pastille qui
se deplace, un fond sous l'onglet voisin se lit comme une seconde selection.

### [CORRIGE] Quatre valeurs declarees deux fois, encore

`.segments`, `.glass` / `.glass-strong` (corps identiques),
`.liste-vendeurs .vendeur.actif` et `.onglet.actif`. Dans chaque cas la seconde
declaration gagnait sur les proprietes communes. C'est la **sixieme** occurrence de ce
defaut dans `index.css` apres `main { max-width }` et `.saisie-corps`.

Le motif est toujours le meme : une section « correctif » ou « finition » ajoutee en
bas du fichier, qui re-declare une propriete deja posee plus haut. Elle se lit comme un
ajout et agit comme un remplacement.

---

## Deploiement Cloudflare — 03/09/2026

### [CORRIGE] Le deploiement echouait apres un build reussi : aucun `wrangler.jsonc`

Signale par l'utilisateur, journal Cloudflare a l'appui, deux echecs de suite.

Ce que dit le journal, et c'est ce qui rend le defaut trompeur :

```
10:15:16.006  Success: Build command completed
10:15:16.120  Executing user deploy command: npx wrangler versions upload
10:15:25.880  [echec, 12 s]
```

**Le build reussit** — `tsc --noEmit` puis `vite build`, 113 modules, 1,42 Mo — et c'est
l'etape suivante qui casse. Un lot de code parfaitement valide n'arrive donc jamais en
ligne, sans qu'aucune verification locale ne puisse le voir.

**Premiere chose verifiee, avant tout diagnostic : la production etait-elle tombee ?**
Non. `https://grid.bonyauto-mobile.workers.dev` servait toujours l'application, sur
l'ANCIEN bundle (`index-BMYtM9_z.js` en ligne, `index-kKDBZhWj.js` produit par le build).
C'est coherent avec `versions upload`, qui televerse une version **sans la deployer**.

Cause. Le projet Cloudflare est un projet **WORKERS**, pas Pages — `DEPLOIEMENT.md`
ecrivait « Pages » de bout en bout, y compris dans son titre. Ce n'etait pas un ecart de
vocabulaire : un projet Pages se contente d'un « repertoire de sortie » reglé au tableau
de bord, un projet Workers execute une commande de deploiement qui exige une configuration
**dans le depot**. Il n'y en avait aucune, et il n'y en a jamais eu — verifie sur `master`
comme dans tout l'historique.

Reproduit en local, sans rien deployer, plutot que devine :

```
npx wrangler versions upload --dry-run
-> Missing entry-point: ... create a "wrangler.jsonc" file containing ...
```

Wrangler dicte le remede, et c'est le fichier ajoute. Les deux commandes valident
desormais en dry-run, et `wrangler deploy --dry-run` lit bien les 5 fichiers de `dist`.

**Ce qui reste a comprendre** : le deploiement du 01/09 a REUSSI avec le meme depot, donc
sans configuration. Quelque chose a change cote Cloudflare entre les deux — migration
Pages -> Workers, ou commande de deploiement modifiee. Sans acces au tableau de bord on ne
peut pas le trancher, et ca ne change rien au correctif : la configuration est requise
dans les deux cas.

**Mis en ligne et verifie le 03/09/2026.** Le lot est passe sur `master`, et la production
sert desormais `index-kKDBZhWj.js` la ou elle servait `index-BMYtM9_z.js`. Trois controles
sur l'URL de production :

| | |
|---|---|
| bundle | `index-kKDBZhWj.js` + `index-gW5DNGf0.css` |
| `overflow-x` de la racine | `clip` — le correctif du `sticky` est en ligne |
| repli SPA | `/une/route/inexistante` et `/saisie` rendent `200 text/html` avec `index.html` |

Cela tranche l'inconnue qui restait : **un push sur `master` declenche un vrai
deploiement**, et non un `versions upload`. La lecture du tableau de bord ne permettait pas
de le savoir — il n'affiche qu'une commande, celle du build courant.

**Verifie en ligne apres correctif.** Le deploiement suivant est passe, et son journal
tranche le seul point qui restait deduit — le nom du Worker :

```
✨ Read 5 files from the assets directory /opt/buildhome/repo/dist
✨ Success! Uploaded 3 files (1 already uploaded) (1.20 sec)
Uploaded grid (2.94 sec)
Success: Deploy command completed
```

`Uploaded grid` : le `name` designe bien le Worker existant, aucun second Worker n'a ete
cree.

**La lecon, et elle vaut pour la suite : un build vert ne prouve rien sur le
deploiement.** C'est le pendant exact de « un typecheck vert ne prouve rien sur le contrat
de l'API », d'un cran plus haut. Les deux commandes de deploiement se verifient en dry-run,
localement, avant de croire qu'un lot est en ligne — la marche a suivre est dans
`DEPLOIEMENT.md`, avec l'URL d'apercu de branche qui permet d'eprouver le lot deploye sans
toucher a la production.

---

## Audit d'ergonomie du front — 03/09/2026

Parti d'une demande d'utilisateur en quatre points. Les mesures ont deplace trois
des quatre diagnostics.

### [CORRIGE] Trois constantes devinaient la hauteur de l'en-tete, et aucune n'etait juste

**Signale comme « les tableaux Renault/Dacia prennent trop de place, ce qui force
une scrollbar ». La grille etait bien en cause, mais pas seule, et pas d'abord.**

Mesure a 1600x900 sur l'ecran de saisie : **1 067 px de contenu pour 900 px de
fenetre**, alors que les deux colonnes savent defiler dans leur cadre depuis
toujours. Le debordement ne venait pas du volume mais de trois valeurs qui
s'alignaient sur l'en-tete de l'application :

| Endroit | Valeur ecrite | Valeur reelle |
|---|---|---|
| `top` collant de `.liste-vendeurs` | `4.5rem` (72 px) | 57 px |
| `max-height` de `.liste-vendeurs` | `100vh - 6rem` (96 px) | 57 px |
| `max-height` de `.zone-grille` | `100vh - 9rem` (144 px) | 57 px |

Trois nombres differents pour une meme hauteur, et **aucun ne pouvait etre juste** :
l'en-tete est en `flex-wrap`, donc sa barre d'onglets passe a la ligne sur un ecran
etroit et il grandit.

Le plus notable est que le fichier le savait. Le commentaire de la section
« defilement de la grille » d'`index.css` disait deja, mot pour mot : « une
constante qui doit egaler la hauteur d'un element variable est un bug qui attend ».
Il l'ecrivait pour justifier d'avoir retire UNE de ces constantes, et en laissait
trois.

`App.tsx` mesure desormais l'en-tete par `ResizeObserver` et pose `--h-entete` sur
`:root`. Une mesure, une variable, quatre usages — la barre d'outils collante de
l'ecran Vendeurs s'y aligne aussi. **Debordement de page : 0.**

### [CORRIGE] Le mode tablette n'avait jamais fonctionne

**Trouve en verifiant le correctif precedent a 900 px de large.**

`index.css` declarait `.saisie-corps` avec sa media query « une colonne » a la
ligne 989 — puis **une seconde fois a la ligne 2 670**, sans media query et de meme
specificite. La seconde gagnait. A 900 px de large, l'ecran restait donc en deux
colonnes de 320 et 506 px : la grille debordait horizontalement de 96 px et
verticalement de 517.

C'est la **troisieme fois** que ce fichier porte une propriete declaree deux fois
(apres `main { max-width }`, deja fondue par une session precedente). La valeur de
la ligne 2 670 a ete remontee dans la regle d'origine.

Aggravant, et decouvert dans la foulee : le remede d'origine du mode une colonne
etait pire que le mal. Il rendait la liste des vendeurs au flux normal pour qu'elle
ne capture plus la molette, ce qui la faisait mesurer **5 304 px** — la grille de
saisie se retrouvait a **5 523 px du haut de page**. Il fallait faire defiler 104
vendeurs pour atteindre l'ecran de saisie, sur le format meme que F-C.9 vise. Un
plafond a 38 % de la fenetre resout les deux : page a 1 181 px, grille a 523 px.

### [CORRIGE] Les deux sections d'un vendeur VN ne tenaient pas dans un ecran

La demande initiale, et elle etait fondee : deux sections de 11 creneaux empilees
font **988 px**. Il fallait defiler pour voir Dacia — alors que tout l'interet des
sections empilees, ecrit dans `GrilleVendeur.tsx`, est de voir les deux compteurs
se remplir ENSEMBLE.

Elles passent cote a cote des que la largeur le permet (`auto-fit`, seuil 35 rem) :
le meme planning fait **531 px** et tient en entier, sans aucun defilement. En
dessous du seuil elles se rempilent d'elles-memes — rien a basculer, rien a regler.

Ce qui a rendu la chose possible : `min-width` d'une case ramene de 7 rem a
5,5 rem. Ce n'est pas une reduction de la cible tactile — `width: 100%` sur la
table fait etirer les colonnes des qu'il y a de la place, un vendeur VO seul dans sa
section a des cases de 200 px. C'est un plancher, pas une taille. A 7 rem, il
fallait 42 rem par section et elles restaient empilees sur tout ecran de moins de
21 pouces.

**L'ordre DOM ne change pas, donc le clavier ne change pas** : franchir le bas de
Renault mene toujours au haut de Dacia. Le deplacement se lit de gauche a droite au
lieu de haut en bas.

### [CORRIGE] Le classement des vendeurs existait, mais rien ne le montrait

**Signale comme « il manque un classement des vendeurs ». Il ne manquait pas —
`classementVendeurs` etait calcule, servi, et affiche par le segment « Vendeurs ».**

Trois choses le rendaient introuvable :

1. le graphique « Tete du classement » lisait `classementsSites` **en dur**. Changer
   d'axe changeait le tableau et le classement du bas, mais pas lui : on voyait donc
   toujours des concessions, quel que soit le segment actif ;
2. le classement complet est en bas de page, **sous un tableau de 104 lignes** ;
3. le segment general/VN/VO etait enfoui dans le `h3` du classement, alors qu'il
   gouverne AUSSI le graphique — un controle invisible depuis l'un des deux blocs
   qu'il commande.

Cause de fond, cote service : **trois champs de classement de trois formes
differentes**. `classementsSites` etait ventile en general/VN/VO,
`classementVendeurs` et `classementTables` en general seulement. « Le classement des
vendeurs sur le VO » etait donc inexprimable, alors que `classer` sait le faire
depuis toujours — et l'ecran portait un `if` par axe pour aller chercher le bon
champ.

Un seul champ desormais, `classements[axe][critere]`, pour les cinq axes et les
trois criteres. 15 appels a `classer` au lieu de 5 : sur 104 lignes au plus, c'est
gratuit. `classer` reste la source unique du departage des ex aequo. L'axe
« Plaques » gagne au passage un vrai classement — il affichait « le classement porte
sur les concessions et les vendeurs », c'est-a-dire rien.

L'export Excel passe de 5 a 8 series de classement : plaques, et vendeurs ventiles
VN/VO.

### [CORRIGE] Les colonnes du tableau de bord ne se triaient pas

Demande de l'utilisateur, et `EnTeteTriable` existait deja — dans
`pages/Vendeurs.tsx`. Le recopier aurait donne deux fleches, deux regles de bascule
et deux etats « non trie » a maintenir : l'esprit de l'interdit n.6 vaut aussi pour
l'interface. Il vit maintenant dans `components/EnTeteTriable.tsx`, avec sa regle de
bascule, et les deux ecrans l'appellent.

Deux points de conception qui ne sont pas du confort :

- **le premier clic trie dans le sens NATUREL de la colonne** — croissant pour un
  libelle, decroissant pour un nombre. D'un classement on veut la tete, pas la
  queue ;
- **le tri est TOTAL.** Sur 19 concessions dont 17 a zero, un tri par RDV laisse 17
  lignes a egalite : sans second critere leur ordre relatif n'est pas garanti d'un
  rendu a l'autre. Le departage est le libelle, toujours croissant — le meme que
  `classer` prend en dernier recours. Une liste qui se reordonne toute seule sous
  les yeux est exactement ce que ce produit reproche au fichier.

### [CORRIGE] Aucun chemin vers « ajouter un vendeur » sans defiler 8 500 px

Signale par l'utilisateur : « obligé de scroll pendant 2 min pour aller en bas de
page et saisir des vendeurs ». Mesure : la page fait **8 933 px** — 19 cartes de
site depliees — et le seul bouton d'ajout etait en bas de la carte du site, soit
**8 557 px** de defilement pour Villefranche.

Trois ajouts, tous dans une barre d'outils **collante** — une barre qui porte la
recherche et l'ajout ne sert a rien si elle est a 8 900 px au-dessus du regard :

| | |
|---|---|
| `+ Ajouter un vendeur` | ouvre le formulaire EN HAUT DE PAGE, avec un selecteur de site |
| Recherche | porte sur le nom du vendeur ET sur le site (libelle ou code) |
| Filtre par plaque | 19 cartes -> 3 pour NORD, page de 8 933 a 1 833 px |

Le formulaire de creation n'a **pas** ete duplique : il prend un `site` fixe (emploi
de la carte) ou un `sitesAuChoix` (emploi de la barre). Deux jeux de regles de
validation auraient diverge.

La recherche ne filtre les LIGNES d'une carte que si elle a designe des vendeurs :
sur « CLF » on veut la carte de Clermont AVEC ses 19 vendeurs, pas une carte vide
parce qu'aucun nom ne contient « CLF ». Verifie au clavier : « ROUSSET » rend 1 carte
et 1 ligne, page a 900 px ; « MOZ » rend la carte de Mozac et ses 7 vendeurs.

**Les compteurs des cartes ne bougent pas quand on filtre.** C'est la meme regle que
le total du perimetre dans le module C : un effectif qui change quand on cherche un
nom serait un piege.

### [CORRIGE] Des paragraphes qui expliquaient le produit a lui-meme

Demande de l'utilisateur, et elle est juste. Exemple retire :

> Remplace trois onglets du fichier : les totaux, le suivi comparé à une campagne
> antérieure, et les classements. **Rien n'est stocké** — chaque nombre est
> recalculé à la lecture, et l'effectif est calculé, jamais saisi.

Ce sont des arguments de CONCEPTION. Ils ont leur place dans les `.md`, pas sur
l'ecran d'un chef de table. Sept blocs retires ou raccourcis, sur cinq ecrans, plus
deux libelles de KPI (« calculé, jamais saisi » -> « vendeurs présents »).

La regle appliquee, et elle est declaree telle quelle dans `CLAUDE.md` : **on garde
ce qui dit a l'utilisateur ce qui va se passer s'il clique** — cloturer fige la
campagne, archiver conserve les RDV, les deux formats de collage acceptes — on
retire le reste.

### [CORRIGE] La barre de navigation n'avait JAMAIS ete collante

**Le defaut le plus ancien de ce lot, et il dormait depuis le premier jour.**

Trouve en verifiant que la nouvelle barre d'outils de l'ecran Vendeurs collait
bien : elle ne collait pas. Mesure sur l'en-tete de l'application, qui declare
`position: sticky; top: 0` depuis toujours :

```
scrollTo(0, 1200)  ->  header.getBoundingClientRect().top = -1200
```

Cause : `html, body { overflow-x: hidden }`. **Un `overflow` autre que `visible`
sur la racine en fait un conteneur de defilement**, ce qui desarme tout
`position: sticky` relatif a la fenetre. La regle est juste dans son intention —
« la page ne defile jamais horizontalement » — et c'est son effet de bord qui la
defait.

Consequence reelle : sur l'ecran Vendeurs, qui fait 8 900 px, **on perdait la
navigation entiere** des qu'on descendait. Personne ne l'avait remarque parce
qu'un en-tete qui ne colle pas ne produit aucune erreur : il se lit comme un choix
de conception.

Corrige par `overflow-x: clip`. `clip` decoupe exactement pareil **sans** creer de
scrollport, donc les `sticky` fonctionnent. Le seul ecart est qu'on ne peut plus
defiler par programme sur l'axe decoupe, ce qu'on ne veut precisement pas ici.

### [CORRIGE] Dix elements etaient collants a la meme hauteur, et le dernier gagnait

**Revele par le correctif precedent** — un defaut qui dormait tant que rien ne
collait, et qui s'est vu a la seconde ou les `sticky` ont repris.

Le titre de l'ecran s'est mis a **recouvrir la barre de navigation**.
`elementFromPoint(700, 20)`, en plein dans l'en-tete de l'application, rendait le
`h2` de l'ecran.

Cause : `header { position: sticky; top: 0; z-index: 20; ... }` est un **selecteur
d'ELEMENT**. Il visait la coquille et attrapait les six `.ecran-entete`, les deux
en-tetes de panneau live et les deux du module B — dix elements `sticky; top: 0`
au meme `z-index`, dont le dernier du DOM l'emporte.

Corrige en scopant la seule partie nuisible a `.application > header` :
`position`, `top`, `z-index`. Le reste de la regle — fond de verre, flou, liseré —
**reste sur `header`** : c'est lui qui donne aux six en-tetes d'ecran leur cadre,
et le retirer aurait restyle six ecrans sans que ce soit demande.

`.application > header` et non `header:first-of-type` : la relation « en-tete de la
coquille » est structurelle, pas positionnelle.

**La lecon, et c'est la troisieme fois dans ce fichier CSS : un selecteur
d'element attrape ce qu'on n'a pas prevu.** Meme classe de defaut que la regle
fourre-tout qui donnait le degrade Bony a tout `button`, corrigee en son temps par
l'inversion `.principal`.

### [CONNU, NON CORRIGE] L'ecran Vendeurs fait toujours 8 990 px sans filtre

Les 19 cartes restent depliees en permanence. Les filtres et la barre collante
retirent la douleur immediate — on atteint l'ajout et un site donne en un geste —
mais parcourir la liste entiere demande toujours de defiler.

Le remede serait des cartes repliables, avec un etat par site a memoriser. Non fait :
c'est un changement d'interaction, pas un reglage, et la demande portait sur l'acces
a la saisie de vendeurs, qui est reglee. A trancher separement.

---

## Hygiene des droits et vitesse des suites — 03/09/2026

### [CORRIGE] Les 12 fonctions de trigger etaient executables par PUBLIC

Et les chiffres annonces etaient faux, tous les trois. `ETAT-PROJET.md` disait
« 10 alertes de l'analyseur Supabase sur `diffuser_rdv()` et les 11 fonctions
`verifier_*()` » — un enonce qui se contredit lui-meme, 12 fonctions ne faisant pas
10 alertes. Mesure du 03/09, identique sur les deux bases :

| | |
|---|---|
| fonctions de trigger dans `relance` | **14** |
| dont `EXECUTE` accorde a PUBLIC | **12** |
| dont `security definer` **et** PUBLIC — les alertes reelles | **9** |
| fonctions *appelables* `security definer` exposees | **0** |

Les 3 du delta — `interdire_suppression()`, `tracer_creation()`,
`tracer_modification_rdv()` — sont bien exposees mais `security invoker`, donc hors de
cette alerte ; ce qui ne les rend pas plus legitimes. La dixieme alerte n'existe pas
dans l'etat present de la base : elle a probablement disparu avec les deux migrations
du 01/09, les seules a porter deja leur propre `REVOKE`.

**Aucun chemin d'exploitation, et ce n'etait pas la raison.** Les 14 sont
`RETURNS trigger` : PostgreSQL refuse un appel direct (`0A000`) et PostgREST ne les
expose pas au catalogue (`404 PGRST202`). Ce qu'on ferme, c'est le BRUIT — neuf
alertes qui ne signifient rien noient celles qui signifieraient quelque chose.

`20260903065812_revoquer_execute_public` boucle sur
`prorettype = 'trigger'::regtype` : **aucun nom n'est ecrit dans le fichier**, et une
quinzieme fonction serait couverte le jour ou la migration passe. Elle echoue
bruyamment si la boucle ne trouve rien — une boucle vide est indiscernable d'une
boucle qui a travaille.

Deux points declares :

- **elargissement assume** — la revocation porte aussi sur `anon` et `authenticated`,
  alors que la demande parlait de `PUBLIC` seul. Leur droit etait herite de PUBLIC
  (verifie : les 24 RPC appelables ont garde leur `authenticated`). Ne fermer que
  PUBLIC laisserait un futur `GRANT ... TO authenticated` faire taire l'analyseur en
  laissant la fonction appelable par tout compte connecte ;
- **une migration est un evenement, pas une regle.** Elle ne couvre pas la fonction
  ecrite demain. D'ou **deux controles ajoutes a `test:rls`** : l'invariant en
  `NOT EXISTS` structurel, et son garde-fou de non-vacuite (« >= 10 fonctions de
  trigger »), sans lequel le premier serait vert en ne verifiant rien. La suite passe
  de 87 a **89 controles**.

Preuve que le nouveau controle n'est pas vert a vide : joue sur Supabase avant que la
migration n'y passe, il en etait **le seul echec** (88/89).

Le controle qui comptait vraiment : `test:garde-fous` reste a **39/39**. PostgreSQL
verifie `EXECUTE` au `CREATE TRIGGER`, jamais au declenchement — mais ca ne se croit
pas sur parole, ca se mesure. Revoquer trop large etait le seul vrai risque du lot.

### [CORRIGE] `test:rls` mettait 2 min 12 sur Supabase

La cause n'etait pas le volume — 25 lignes de decor — mais le NOMBRE
D'ALLERS-RETOURS : `poserDecor` faisait **24** `INSERT` distincts, rebatis dans
chacune des 87 transactions, soit ~2 000 latences reseau vers eu-west-3.

Il en fait **2**, par CTE modifiantes.

| | avant | apres |
|---|---|---|
| Supabase | 2 min 12 | **31 s** |
| local | 5 s | **2 s** |

**L'isolement conquis le 01/09 n'a pas bouge d'un cran** : chaque controle garde sa
transaction et son decor neuf, et la suite ne depend d'aucune donnee de production.

**Deux instructions et non une**, et ce n'est pas un manque de soin. Dans une
instruction a CTE modifiantes, toutes les branches partagent le meme instantane : une
branche ne voit pas les lignes qu'une branche voisine vient d'inserer. Les cles
etrangeres s'en accommodent — elles sont verifiees par des triggers AFTER, en fin
d'instruction — mais pas les triggers BEFORE, qui lisent pendant. Or deux tables du
decor en portent six qui interrogent d'autres tables (mesure sur les **30 triggers non
internes** du schema — la doc en annonce 19 ailleurs, comptage perime) :

| Table | Triggers `BEFORE` qui lisent ailleurs |
|---|---|
| `encadrement_site` | `verifier_encadrant_actif` lit `utilisateur` |
| `affectation` | `verifier_affectation_meme_plaque`, `..._unique`, `..._marque_table`, `..._presence` lisent `vendeur`, `site`, `plaque`, `table_phoning`, `session_plaque`, `campagne` |

Les mettre dans la meme instruction que leurs dependances, c'est demander a quatre
garde-fous de se prononcer sur un monde qu'ils ne voient pas encore. Ils
refuseraient — ou, bien pire, accepteraient pour la mauvaise raison. D'ou la coupure.

Il reste ~3 allers-retours par controle (pose de l'`auth_uid`, `set_config`,
`SET LOCAL ROLE`). Les replier ferait gagner encore ~10 %, ce qui n'a pas paru valoir
la perte de lisibilite du helper `sousIdentite`.

---

## Vendeurs sortis — 01/09/2026

### [CORRIGE] Des vendeurs sortis en aout figuraient dans la session de septembre

Signale par l'utilisateur. Trois vendeurs portant une date de sortie apparaissaient
encore dans les tables de la campagne de septembre.

**La vue `relance.perimetre_saisie` les excluait correctement** — l'ecran de SAISIE
ne les proposait pas. C'est l'ecran des TABLES qui les montrait : il ne filtrait que
`archive_le`, jamais la presence pendant la campagne. Deux ecrans, une campagne, deux
reponses.

`presenceVendeur.ts` porte pourtant la regle, et son propre bandeau dit « ni dans la
saisie, ni dans les tables » — mais plus personne ne l'appliquait aux tables : seul
`services/dashboard.ts` l'importait encore. La regle etait ecrite, pas branchee.

Corrige a trois niveaux :

| Niveau | Ce qui a change |
|---|---|
| Affichage | `services/tables.ts` applique `etaitPresent` a la reserve ET aux membres des tables |
| Ecriture | trigger `affectation_vendeur_present` — un vendeur absent ne peut plus etre affecte |
| Donnees | l'affectation de septembre restee active a ete archivee par `table_definir_vendeurs` |

Le trigger manquait alors que `relance.session_reprendre` le supposait deja : son
commentaire dit « verifie ici EN PLUS du trigger ». La ceinture existait, les
bretelles non — et ni `table_definir_vendeurs` ni `session_appliquer_repartition` ne
verifiaient quoi que ce soit.

Verifie a l'ecran, sur la vraie base : les trois disparaissent de septembre, et
PIERRE-EDOUARD LAROCHE **reste** en juin, ou il a travaille (10 RDV). La regle ne
sur-filtre pas.

### [CORRIGE] Une date d'entree pouvait effacer 29 RDV d'une campagne close, en silence

**Trouve en verifiant le correctif precedent, pas cherche.**

Deux vendeurs avaient recu une `date_entree` EGALE a leur `date_sortie` — 31/07 et
31/08 — alors qu'ils avaient 13 et 16 RDV en JUIN. Le formulaire a deux champs de
date independants ; les deux ont ete remplis.

Consequence : le tableau de bord de juin affichait **1078 RDV au lieu de 1107**,
effectif 97 au lieu de 99, Clermont 205 au lieu de 218. Sans erreur, sans
avertissement, et sans rien qui relie la cause a l'effet — on saisit deux dates sur
un ecran, et le total d'une campagne CLOSE bouge de 29 RDV.

La donnee brute etait pourtant intacte : les 1107 RDV n'ont jamais bouge. **Seule la
lecture mentait**, parce que `agregats.ts` ne compte que les RDV des vendeurs
presents. C'est le defaut du classeur, reproduit par un autre chemin : un chiffre
plausible et faux.

La regle « un vendeur ne compte que dans les campagnes ou il etait la » n'est pas en
cause — elle est juste, et elle est partout. **Ce sont les dates qui etaient
fausses.** La reponse n'est donc pas d'assouplir la regle mais d'empecher qu'on
puisse la mettre en contradiction avec des faits deja enregistres.

Trigger `vendeur_dates_contre_rdv` : des dates qui excluraient un vendeur d'une
campagne ou il a des RDV non archives sont refusees, avec un message qui NOMME la
campagne et le nombre de RDV. Pour le cas legitime — un RDV attribue par erreur — il
faut archiver le RDV d'abord : la correction porte sur le fait, pas sur la date qui
le rend invisible.

Les deux `date_entree` fautives ont ete retirees ; les dates de SORTIE, elles, sont
voulues et restent. Juin est revenu a 1107 / 903 VN / 204 VO, verifie a l'ecran et
par le recoupement avec les quatre series du classeur.

### [CORRIGE] Trois controles de `test:garde-fous` dependaient de l'etat de la base

Ils ont vire au rouge sur Supabase — pas en local — parce que la base y est
REELLEMENT UTILISEE :

- `R-A3.7` prenait « le site d'identifiant le plus bas ». MASS avait desormais un
  chef de site : trois controles echouaient sur l'unique `(site, role)`. Pire, le
  controle voisin — « un SECOND encadrant est refuse » — passait au VERT pour la
  mauvaise raison, c'est le PREMIER `create` qui echouait ;
- `R-B.5` prenait « un vendeur de la plaque encore libre ». Il est tombe sur
  BAPTISTE DUBOIS, entre le 01/09, qu'un nouveau trigger refuse a bon droit dans une
  table de JUIN. Le test accusait R-B.5 d'un refus venu d'ailleurs.

Meme correctif que pour R-B.1 en son temps : **les fixtures sont fabriquees dans la
transaction annulee, jamais choisies en base.** Ce qui doit etre eprouve, c'est la
contrainte, pas l'etat de la base ce jour-la. 39/39 sur les deux bases.

### [CORRIGE] `test:rls` etait couple aux donnees de production

**La suite la plus importante du produit** — 87 controles sur la seule barriere
d'autorisation — emprunte des comptes REELS et suppose leur configuration :
`sbesson` « n'a aucun encadrement », `encadrant.test` encadre « CLF et MOZ ».

Ces suppositions ne sont plus vraies : `sbesson` est devenue chef de site de MASS, et
la ligne d'encadrement CLF d'`encadrant.test` a ete REPRISE par FRANCK TIXIER
(l'unique `(site, role)` n'est pas partiel : `utilisateur_definir_encadrement` libere
la ligne et la redonne). Deux changements parfaitement legitimes, faits depuis
l'interface.

Resultat : **82 OK, 5 ECHEC**. Les cinq s'expliquent par ces deux changements, et
dans chaque cas **c'est le comportement observe qui est correct** :

| Controle | Attendu par la suite | Observe | Qui a raison |
|---|---|---|---|
| perimetre de `encadrant.test` | 8 | 7 | l'observe — il n'encadre plus CLF |
| perimetre de `sbesson` (juin) | 6 | 8 | l'observe — sa table (6) + MASS (2) |
| `sbesson` sur l'autre campagne | 0 | 8 | l'observe — un encadrement de site est DURABLE |
| `sbesson` ecrit hors de sa table | refuse | accepte | l'observe — le vendeur choisi est de MASS |
| `sbesson` lit des RDV hors perimetre | 0 | 11 | l'observe — memes RDV, meme raison |

**Aucune regression de securite.** La RLS fait exactement ce qu'elle doit ; ce sont
les attentes de la suite qui sont perimees.

**Aggravant, et c'est le vrai sujet : archiver les comptes `.test` DESARME la suite
entierement.** Sa preparation leve `P2025` et pas un seul des 87 controles ne
s'execute. Les 5 comptes ont donc ete REACTIVES apres avoir ete archives a la demande
de l'utilisateur — un menage cosmetique ne vaut pas la mise hors service du garde-fou
qui protege les donnees du groupe.

**CORRIGE le 01/09/2026.** `tester-rls.ts` fabrique desormais son propre monde —
`poserDecor` — dans la transaction de CHAQUE controle, et n'observe que lui :

```
plaque RLS
  site RLS-A   A1 (table), A2 (hors table), A3 (table)
  site RLS-B   B1, B2                <- les seuls sites de `encadrant.rls`
campagne RLS 1   2 jours, 1 creneau  <- ou officie `chef.rls`
campagne RLS 2                       <- pour prouver que ses droits n'y vont pas
table « TABLE RLS », chef `chef.rls`, membres A1 et A3
comptes  admin.rls · direction.rls · encadrant.rls · lecteur.rls · chef.rls
```

Les deux perimetres sont **disjoints** — le chef tient A1 et A3, l'encadrant B1 et
B2 — et chacun compte **deux** membres : un controle qui attend 1 peut passer par
hasard, celui qui attend 2 non. A2 n'est ni dans la table ni sur un site encadre :
c'est le vendeur hors perimetre par lequel on prouve les refus.

Tout est annule avec la transaction, donc rien ne subsiste et les noms fixes
n'entrent jamais en collision — deux controles ne sont jamais simultanes.

**La preuve :** 87/87 sur Supabase **avec les cinq comptes `.test` desactives**. Ils
peuvent enfin etre archives, ce qui etait la demande initiale.

Deux ajustements ont ete necessaires, et les deux etaient des defauts reels :

- `doitValoir` acceptait une valeur attendue evaluee a la DECLARATION du controle.
  Une valeur qui depend du decor n'existe pas encore a ce moment-la : elle accepte
  desormais une fonction, evaluee apres la mesure ;
- le helper `rpc` figeait ses parametres hors transaction — donc avec le decor de
  la transaction PRECEDENTE, deja annulee. Les deux controles qui creent vraiment
  un vendeur echouaient sur une violation de cle etrangere. **La suite a attrape
  mon propre defaut**, ce qui est exactement son role.

Contrepartie mesuree : 2 min 12 sur Supabase contre quelques secondes avant — le
decor est rebati a chaque controle, soit ~25 lignes x 87 allers-retours reseau. En
local, 5 secondes. C'est le prix de l'independance, et il est payant.

**Ce prix a ete ramene a 31 s le 03/09/2026 sans rien ceder de l'independance** —
voir la section du 03/09 plus bas.

---

## Mise en service — 01/09/2026

### [CORRIGE] La campagne courante se reinitialisait a chaque changement d'onglet

Se mettre sur juin au tableau de bord, faire un tour dans la saisie, revenir : on
retrouvait septembre. Signale par l'utilisateur.

Cause : `App` DEMONTE l'ecran quitte et remonte l'ecran choisi. Chaque ecran portait
son `campagneId` dans un `useState` local, qui mourait avec lui.

Ce n'etait pas seulement agacant, c'etait **trompeur** : deux ecrans pouvaient
afficher deux campagnes differentes en meme temps, sans que rien ne le signale. On
lisait alors des chiffres de juin a cote d'une composition de tables de septembre.

`contexts/CampagneContext.tsx` porte desormais UNE campagne courante pour les quatre
ecrans qui en ont une (saisie, tableau de bord, tables, campagnes). Elle survit aussi
a un rechargement de page (`sessionStorage`, lu et ecrit sous `try/catch` : une
exception de stockage empecherait l'application de monter, et ca n'en vaut pas le
risque).

Chaque ecran GARDE SON DEFAUT, qui ne s'applique que quand il n'y a rien a respecter
— la saisie ouvre sur une campagne ou l'on a quelque chose a faire, le tableau de
bord sur une campagne ouverte. Et chacun verifie que l'identifiant retenu figure dans
sa propre liste : un identifiant memorise peut designer une campagne archivee depuis.

### [CORRIGE] L'etiquette « vendeur » s'affichait sur TOUS les comptes

`admin` etait presente comme etant aussi un vendeur. Aucun compte ne l'est
aujourd'hui — `vendeur.utilisateur_id` est vide sur les 100 vendeurs, verifie.

Cause : `vendeur.utilisateur_id` fait de `vendeur` un ENFANT de `utilisateur`.
PostgREST rend donc toujours un **tableau**, vide quand il n'y a rien, jamais `null`.
`services/utilisateurs.ts` le declarait `{ id, nom } | null` et testait
`u.vendeur ? … : null`. **`[]` est vrai en JavaScript** : l'etiquette s'affichait
partout, avec un `id` et un `nom` a `undefined`.

C'est mot pour mot le piege que `CLAUDE.md` decrit — « un typecheck vert ne prouve
rien sur le contrat de l'API » : TypeScript ne verifie que la coherence du front avec
ses PROPRES declarations, jamais avec ce que le serveur renvoie. Une declaration
fausse est un mensonge que le compilateur valide. Le meme defaut avait deja coute une
page blanche sur l'ecran Vendeurs.

Trouve en REGARDANT l'ecran, pas en compilant — et pas cherche : il est apparu en
verifiant autre chose.

### [CORRIGE] La suppression definitive d'un compte etait invisible

Elle existait — `relance.utilisateur_purger`, l'action `supprimer-identite` de
l'Edge Function, le bouton — mais celui-ci n'etait rendu que sur un compte **deja
desactive**. Rien, sur un compte actif, ne laissait deviner qu'elle existait : on la
cherchait, on ne la trouvait pas, on en concluait qu'elle n'avait pas ete faite.

Le bouton est desormais toujours rendu, DESACTIVE tant que le compte est actif, avec
une infobulle qui dit la marche a suivre. Un bouton absent n'enseigne rien ; un bouton
desactive qui dit pourquoi enseigne le chemin. **La protection ne bouge pas d'un
cran** : desactiver d'abord, retaper le nom exact ensuite, et les deux verrous poses
en base par-dessus (compte deja archive, aucun historique).

---

## Chargement des RDV de juin — 01/09/2026

### [CORRIGE] Paginer sans `ORDER BY`, ce n'est pas paginer : c'est tirer au sort

**Le defaut le plus grave rencontre sur ce produit.**

`toutesLesLignes` (`services/supabase.ts`) paginait par `.range(de, a)` et comparait
le nombre rapatrie au `count` exact — un controle ecrit precisement pour empecher un
total faux. **Aucun appelant n'ordonnait sa requete.** Or `LIMIT/OFFSET` sur une
requete non ordonnee n'a aucune stabilite garantie : PostgreSQL peut rendre la page 2
dans un ordre qui repete des lignes de la page 1 et en omet d'autres.

On rapatrie alors le BON NOMBRE de lignes, mais pas les BONNES. **Le controle de
volume passe au vert pendant que les totaux sont faux** — exactement le mode de
defaillance que ce fichier cherchait a interdire.

Constate en vrai, sur les 1107 RDV de juin :

```
OK    total de la campagne     1107 (attendu 1107)
ECHEC ventilation VN / VO      VN 884 / VO 223 (attendu 903 / 204)
ECHEC les 19 sites             MASSAGETTES : 22 au lieu de 20 ; MOZAC : 127 au lieu de 116
```

Le total juste, tout le reste faux.

**Le defaut etait invisible depuis le debut** parce qu'aucune campagne ne depassait
1000 RDV — la premiere page suffisait. Il est devenu reel a la seconde ou juin est
entre en base, et il touchait les deux lectures du produit : le tableau de bord
(`rdv_agrege`) et le module C (`rdv`).

Trouve par le script d'import, dont la verification recoupe la base avec le classeur.
Sans ce recoupement, le tableau de bord aurait affiche des chiffres plausibles et faux
— le defaut de l'Excel qu'on remplace, reproduit a l'identique.

**La correction n'est pas une note « penser a ordonner ».** `toutesLesLignes` prend
desormais une colonne d'ordre en **parametre obligatoire** et l'applique elle-meme :
un appelant ne peut plus l'oublier, le compilateur le refuse. On ordonne sur la cle
primaire, seule colonne dont l'unicite garantit que deux pages ne se recouvrent pas —
`jour` ne departagerait pas deux RDV du meme jour et le probleme reviendrait.

Garde-fou permanent : `npm --prefix backend run importer-juin` (sans `--reel`, il
n'ecrit rien) relit les 1107 RDV par la vue `rdv_agrege` et les recoupe avec quatre
series du classeur. Si une pagination redevenait non ordonnee, il vire au rouge.

### [CORRIGE le 03/09/2026] Le module C ne savait pas montrer deux RDV dans la meme case

Le tableau de bord de juin affichait **1107** RDV, le module C **1105**. Les deux
lisent la meme base ; c'etait l'affichage qui perdait deux lignes.

Cause : `pages/Saisie.tsx` indexe les RDV par `cleRdv(marqueId, creneauCode, jour)` —
une entree par CASE de la grille. Or deux cases du classeur portent **deux
rendez-vous** :

| Vendeur | Quand | Clients |
|---|---|---|
| JEROME SABIN (CLF) | 15/06, 14h-15h, VO | DEVERNOIS **+** DE SOUSA |
| REDWANE TOULOUSE (ISS) | 11/06, 08h-09h, VO | DAUBARD **+** COSTON |

Un vendeur a pris deux clients dans la meme heure, et les deux noms ont ete tapes dans
la meme cellule Excel. Ce ne sont pas des artefacts : les deux comptent dans les 1107,
et les 1107 se recoupent a l'unite avec quatre series de totaux du classeur.

Consequences, dans l'ordre de gravite :

1. le compteur du module C sous-compte de 2 sur juin ;
2. **le second client est invisible a l'ecran** — SABIN affiche `DE SOUSA`, jamais
   `DEVERNOIS` ;
3. saisir dans cette case ecraserait l'un des deux.

**LA DONNEE N'A PAS ETE TOUCHEE.** Fusionner les deux noms dans un seul RDV aurait
fait concorder les compteurs en detruisant un fait : il y a eu deux rendez-vous. La
base avait raison, c'est la grille qui ne savait pas l'exprimer.

**Precision sur la gravite, mesuree et non supposee :** le second client n'etait pas
seulement cache, il etait **perdu selon l'ordre de pagination**. `Map.set` sur une
cle deja prise garde le DERNIER lu — donc ce n'etait pas toujours le meme des deux
qui disparaissait.

#### Ce qui a ete decide, et pourquoi

Arbitrage de l'utilisateur, sur recommandation chiffree : **empiler, avec un
marqueur**. L'argument qui a emporte le choix n'est pas esthetique. L'option « accepter
la limite » supposait de faire concorder le compteur, or celui-ci additionnait les
ENTREES DE LA `Map`, c'est-a-dire les cases. Le corriger imposait donc de tenir la
liste des RDV par case — exactement la structure de donnees de l'empilement. Cette
option payait ~80 % du prix de l'autre en laissant en place les deux consequences les
plus graves.

| | |
|---|---|
| Structure | `Map<cle, RdvSaisie[]>`, ordonnee par **identifiant croissant** |
| Affichage a 1 RDV | **inchange au pixel pres** — 1105 cases sur 1107 |
| Affichage a 2 RDV | les deux noms empiles + un marqueur chiffre, dans la hauteur normale d'une case |
| Compteur | compte les RDV, plus les cases |
| `Entree` / frappe | reprend le PREMIER RDV. N'ecrase jamais le second |
| `Ctrl+Entree` | AJOUTE un RDV a la case. Le champ s'ouvre vide, les noms deja poses restent visibles au-dessus |
| `Suppr` | archive le premier |

L'ordre est trie sur la cle primaire et non sur le nom du client, qui se corrige : un
renommage ne doit pas faire permuter deux RDV sous les doigts du chef.

`Ctrl+Entree` est un geste **distinct et explicite** parce que le mode d'echec compte
plus que le confort : taper dans une case remplie doit continuer a corriger une faute
de frappe, jamais a empiler un homonyme. Symetriquement, un champ d'ajout laisse vide
n'ajoute rien **et ne retire rien** — sans cette branche, `Ctrl+Entree` puis `Echap`
aurait efface le client qui etait deja la.

Verifie a l'ecran sur la base de production : 1107 en tete et en pied du module C,
marqueur « 2 » et les deux noms sur la case de JEROME SABIN du 15/06 14h-15h. Le
geste d'ajout a ete eprouve **au clavier reel** sur la campagne de septembre, pas sur
juin ; les deux RDV d'essai ont ete archives (voir `ETAT-PROJET.md`).

### [CORRIGE le 03/09/2026] Archiver l'un des deux RDV d'une case effacait l'autre a l'ecran

**Trouve en corrigeant le defaut precedent, pas cherche** — et invisible partout
ailleurs, puisqu'il fallait une case a deux RDV pour l'observer.

`archiver` (`pages/Saisie.tsx`) retirait la CASE ENTIERE de l'index :
`pour.delete(cleRdv(...))`. Avec une seule entree par case c'etait juste. Avec une
liste, archiver un RDV faisait disparaitre **tous** les autres de la meme case,
jusqu'au rechargement suivant — un chiffre qui redescend puis remonte tout seul.

`retirer(liste, id)` filtre desormais par identifiant, et la cle ne disparait que
quand la case se vide vraiment. Eprouve au clavier : `Suppr` sur une case a deux RDV
laisse le second affiche et le compteur a 1.

### [CONNU, NON CORRIGE] Une ligne de la grille est 1 px plus haute des qu'elle contient un nom

**Trouve en mesurant l'empilement, et il n'a rien a voir avec lui.**

Mesure sur les 11 lignes du planning de JEROME SABIN : une ligne vide fait
**38,39 px**, une ligne contenant au moins un nom fait **39,41 px**. La correlation
est parfaite avec « la ligne contient une case remplie », y compris sur des lignes qui
ne portent aucune case multiple.

Cause : `.client` a un interligne de 2,4 rem, et une cellule de tableau traite sa
`height` comme un total, `border-bottom` comprise. Le contenu depasse donc d'un pixel
la hauteur annoncee.

Consequence reelle mais tenue : sur 11 creneaux, le rythme vertical de la grille peut
deriver jusqu'a ~11 px selon le remplissage. **Anterieur a l'empilement**, qui occupe
2,3 rem, soit MOINS qu'un nom seul.

Non corrige volontairement : le remede tient en une ligne
(`.client { line-height: 2.3rem }`), mais il change le centrage vertical de **chaque
nom du module C**, l'ecran le plus sensible du produit, et ce n'etait pas la demande.
A trancher separement.

---

## Nettoyage et invariants — 01/09/2026, soir

### [CORRIGE] L'interdit n.6 n'etait plus applique par rien

`verifierInvariants()` comparait `auth/roles.ts` aux contraintes CHECK **au demarrage du
serveur Express**. La bascule sans serveur a supprime le demarrage : plus rien ne
comparait, et personne ne l'a remarque parce que **rien n'echouait**. C'est le mode de
defaillance le plus couteux — un garde-fou qui disparait avec ce qu'il gardait.

Rien n'avait diverge entre-temps sur les 7 contraintes CHECK. Mais la bascule avait cree
**deux nouvelles duplications** que personne ne surveillait : les paliers, transcrits en
SQL par `relance.peut_administrer()` et `relance.peut_gerer_utilisateurs()`.

Remplace par la suite `test:invariants` (10 controles), jouee en CI par
`.github/workflows/invariants.yml`. Detail dans `ETAT-BACKEND.md`.

### [CORRIGE] `ROLES_ADMINISTRATION_REFERENTIELS` disait le contraire du produit

**Trouve par `test:invariants` a son tout premier passage.**

```
ECHEC B  ROLES_ADMINISTRATION_REFERENTIELS = relance.peut_administrer()
         code = [admin] mais fonction = [admin, direction]
```

La constante valait `['admin']`. Quatre implementations disaient l'inverse et
s'accordaient entre elles : `peutAdministrer` (`campagneScope.ts`),
`relance.peut_administrer()`, le calcul de `administre` dans `services/api.ts`, et le
tableau des quatre paliers de `CLAUDE.md`. **`direction` administre les referentiels** —
la seule chose qu'il ne peut pas faire, c'est gerer les comptes.

Aucun code ne LISAIT cette constante. Elle etait donc fausse **sans consequence
observable**, ce qui est la pire des deux situations : une declaration morte qui contredit
le comportement reel, dans le fichier meme ou l'on va chercher la reponse. La personne
suivante s'en serait servie.

Son commentaire aggravait le cas : « `lecteur` (la direction) n'apparait dans aucune liste
d'ecriture » confondait deux roles distincts.

Corrigee en `['admin', 'direction']`, et elle n'est plus morte : `test:invariants` la
compare a la source de la fonction SQL a chaque passage.

**La lecon n'est pas la valeur, c'est le mecanisme.** Ce qui a trouve l'ecart, c'est le
controle de COUVERTURE (famille C) : il exige que toute liste exportee par `roles.ts` soit
citee par un controle, ce qui a force a en ecrire un pour celle-ci. Un garde-fou qui ne se
met pas a jour tout seul finit par ne garder que ce qui n'a pas bouge.

### [CORRIGE] Le typecheck du backend ne voyait pas les suites

`backend/tsconfig.json` avait `include: ["src/**/*.ts"]`. Les six suites, le seed,
`comptes-auth`, `comptes-test` et `comparer-bases` vivent dans `prisma/` : **ils n'ont
jamais ete typecheckes**, alors qu'ils sont le filet de securite du projet. `include`
porte desormais sur `src/**` et `prisma/**`. Aucune erreur n'est remontee — ce qui ne
retire rien au fait que rien ne l'aurait signalee.

### [CORRIGE] `comptes-test` recopiait un portail qui n'existait plus

Il comptait les vendeurs saisissables par `vendeursSaisissables` (`campagneScope.ts`),
supprime avec le reste d'Express. Il lit maintenant la vue `relance.perimetre_saisie` —
le portail actuel — en se faisant passer pour le compte (`request.jwt.claim.sub`, comme
`tester-rls.ts`), **dans une transaction annulee** : un compte de test n'a pas encore
d'identite Supabase, on lui en pose une le temps du comptage. Verifie : 0 `auth_uid` en
base apres passage.

### [CORRIGE] Sept tris du front dependaient de la version d'ICU du navigateur

`ETAT-BACKEND.md` documentait deja que `order by nom` depend de la collation de la base,
et que `tri.ts` etait la source unique **cote backend**. Le front, lui, avait garde trois
normalisations `NFD` recopiees a la main et quatre `localeCompare('fr')`.

`localeCompare('fr')` classe selon la version d'ICU du navigateur : **deux postes du
groupe pouvaient afficher la meme liste dans deux ordres**, et l'export Excel dans un
troisieme. C'est le meme defaut que la collation, deplace d'un cran.

Les sept sites importent desormais `backend/src/utils/tri.ts`, enrichi d'une primitive
`sansDiacritiques`. Deux `localeCompare` restent volontairement dans `exportExcel.ts`, sur
une date ISO et un code de creneau : des chaines ASCII, dont l'ordre ne depend d'aucune
locale.

---

## Edge Function et exploitation — 01/09/2026

### [CORRIGE] `service_role` contourne la RLS, mais PAS les privileges SQL

L'Edge Function `gerer-comptes` echouait sur :

```
permission denied for table utilisateur
```

alors qu'elle s'execute avec la cle qui est censee tout pouvoir.

`service_role` porte l'attribut `BYPASSRLS` : il ignore les **politiques**. Il n'ignore
pas les **privileges** — ce sont deux couches distinctes, et la migration du portail
n'accordait les droits de table qu'a `authenticated`. Le role passait donc a travers la
RLS pour se heurter au mur d'en dessous.

C'est la meme confusion qui guette a chaque fois : **la RLS s'applique APRES les droits
SQL, jamais a leur place.** Le symptome ressemble a un probleme de politique et n'en est
pas un.

Corrige par la migration `20260901090000_droits_service_role`, qui accorde
`SELECT, INSERT, UPDATE` — **pas `ALL`**. L'interdit n.1 vaut aussi pour cette cle : elle
est precisement celle dont on veut qu'elle ne puisse pas detruire l'historique par
accident. Les purges legitimes passent par des fonctions `security definer`, qui
s'executent avec les droits de leur proprietaire et n'ont donc pas besoin de ce droit.

Six controles de `test:rls` couvrent les deux sens : `service_role` PEUT ecrire, et n'a
AUCUN droit de suppression.

### [CORRIGE] Repondre 500 quand on ne peut pas etablir un droit

L'Edge Function repondait « 500 — impossible de verifier vos droits » quand la
verification echouait, ce qui arrive des qu'on lui presente la cle publique au lieu d'une
session : l'appelant est alors vu comme `anon`, qui n'a aucun droit d'executer la
fonction de controle.

Envoyer chercher une panne la ou il n'y a qu'une absence de session est trompeur, et
distinguer finement les causes serait un raffinement inutile. **On refuse des qu'on ne
peut pas etablir le droit** — 403, echec ferme — et le detail reste dans les journaux de
la fonction.

---

## Premier deploiement Cloudflare — 01/09/2026

### [CORRIGE] Une configuration manquante donnait une PAGE BLANCHE

Premier deploiement sur `grid.bonyauto-mobile.workers.dev` : le fond degrade s'affiche,
et **rien d'autre**. Aucun message, aucune interface de connexion.

Cause immediate : les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
n'etaient pas presentes AU MOMENT DU BUILD. Vite les fige dans le bundle a la
compilation — les declarer comme variables d'EXECUTION cote Cloudflare ne sert a rien,
un fichier deja compile ne les lira jamais.

**Mais la vraie faute est ailleurs**, et elle est de conception : `services/supabase.ts`
levait une exception au chargement du module. Une exception a l'import **empeche React
de monter**, donc le message — pourtant explicite — n'existait que dans la console. Ce
qui se voulait « un echec bruyant » etait en realite le mode d'echec le plus muet
possible : une page vide, indiscernable d'une panne d'hebergement.

Ce produit refuse les echecs silencieux partout ailleurs. Il n'y avait aucune raison de
s'en accorder un au seul endroit ou l'application ne demarre pas du tout.

Corrige : `configurationSupabase` expose le diagnostic au lieu de lever, et `index.tsx`
affiche un ecran qui NOMME les variables manquantes et explique la distinction
build/execution. Verifie en construisant sans les variables et en servant le resultat.

**Regle a retenir : ne jamais lever une exception a l'import d'un module charge au
demarrage.** Le cout n'est pas une erreur en console, c'est une application invisible.

---

## Front sur Supabase — 01/09/2026

### [CORRIGE] Un nom de canal Realtime ne peut pas contenir de deux-points

Le canal `campagne:2` ne s'abonne **jamais**. `subscribe()` ne rend NI `SUBSCRIBED`,
NI `CHANNEL_ERROR`, NI `TIMED_OUT` : la demande reste en suspens. Un canal nomme
`essai-prive-<horodatage>`, teste cote a cote, passe `SUBSCRIBED` immediatement.

Supabase Realtime reserve le deux-points a son propre adressage : un sujet `x` devient
`realtime:x` sur le fil. Un sujet qui en contient deja un est mal decoupe.

Le nom venait des salles socket.io, ou `campagne:${id}` etait la convention et ne posait
aucun probleme. **Rien ne signale qu'une convention a change de maison.**

**C'est le mode d'echec le plus insidieux du lot** : la saisie fonctionne parfaitement,
seuls les compteurs des AUTRES cessent de bouger. Personne ne le remarque en travaillant
seul. Le critere de recette n.5 existe pour cela, et il faut le JOUER a deux fenetres,
jamais le supposer.

Corrige par la migration `20260831230000` (le trigger emet sur `campagne-<id>`) et par
`hooks/useTempsReel.ts`.

### [A CONNAITRE] `MissingPartition` de Realtime au premier demarrage d'un projet

Sur un projet Supabase tout neuf, l'abonnement echoue avec « Realtime was unable to find
the expected messages partition » alors que les partitions de `realtime.messages`
existent bel et bien et couvrent l'instant present (verifie : 5 partitions, celle du jour
comprise). Le conteneur Realtime a demarre avant elles et garde une liste perimee.

Un redemarrage du projet (`POST /v1/projects/{ref}/restart`) le corrige. A ne pas
confondre avec le defaut ci-dessus, qui lui persiste apres redemarrage.

### [OUVERT] L'Edge Function `gerer-comptes` n'existe pas encore

`services/utilisateurs.ts` l'appelle deja pour **creer un compte**, **reinitialiser un
mot de passe** et **supprimer une identite**. Ces trois actions echouent tant que la
fonction n'est pas ecrite et deployee.

Le reste de l'ecran Comptes fonctionne — lecture, roles, encadrement, purge — parce
qu'il passe par PostgREST et par des RPC. En attendant, `npm --prefix backend run
comptes-auth` fait le travail en ligne de commande.

C'est la seule chose qui ne peut pas se faire sans code serveur : creer une identite
Supabase Auth exige la cle `service_role`, qui ne doit jamais se trouver dans le
navigateur.

### [A CONNAITRE] Ecrire dans `utilisateur` en redemandant la ligne complete echoue

`INSERT ... RETURNING *` exige le droit de lire TOUTES les colonnes, or `password_hash`
et `auth_uid` ne sont accordes a personne. PostgreSQL repond `42501` **sur la table
entiere**, ce qui envoie chercher une politique manquante la ou il n'y a qu'une question
de droits colonne.

Regle : ne jamais chainer un `.select()` sans liste de colonnes apres une ecriture sur
`utilisateur`. Deux controles de `test:rls` la fixent dans les deux sens.

---

## Bascule sans serveur — 31/08/2026 au soir

### [CORRIGE] Les triggers de validation etaient aveugles par la RLS

Trouve par `test:rls`. Une saisie faite par un compte desactive etait refusee avec :

> RELANCE: ce vendeur n'est pas autorise a vendre cette marque.

**Le verdict etait faux** : le vendeur etait parfaitement autorise.
`verifier_marque_autorisee()` s'executait avec les droits de l'appelant
(`security invoker`). Depuis que `vendeur_marque` porte une politique, un appelant sans
identite n'y voit **aucune ligne** — le trigger, ne trouvant pas l'autorisation, concluait
qu'elle n'existait pas.

Le trigger ne verifiait plus un invariant de la BASE mais un invariant **de ce que
l'appelant voit**. Ce sont deux choses differentes, et la seconde n'a aucun interet.

Rien n'etait ouvert pour autant : toutes les tables lues par ces triggers sont en lecture
ouverte a tout compte authentifie, donc un utilisateur reel obtenait le bon verdict. Mais
le jour ou une lecture est restreinte — et c'est ce qu'on venait de faire sur `rdv` — les
verdicts deviennent faux **sans que rien ne le signale**.

Corrige par `20260831202000_triggers_hors_rls` : les huit fonctions passent en
`security definer` via `ALTER FUNCTION`, sans recopier leur corps. **Regle : un invariant
qui depend du point de vue de celui qui ecrit n'est pas un invariant.**

### [CORRIGE] `rdv_agrege` rendait tout a un compte desactive

Mesure sur un compte `actif = false` :

```
relance.vendeur      ->  0 ligne    (correct, la RLS s'applique)
relance.rdv_agrege   -> 22 lignes   (FAUX)
```

La vue n'active pas `security_invoker` : elle lit `rdv` avec les droits de son
proprietaire, donc **hors RLS**. C'est exactement ce qu'on lui demande — le tableau de
bord doit compter les RDV de tout le monde. Mais le contournement valait aussi pour ceux
qui ne doivent plus rien voir.

Un compte desactive **garde un jeton Supabase valide** : la desactivation est portee par
`utilisateur.actif`, pas par Supabase Auth. Son role reste `authenticated`, et le `GRANT`
sur la vue suffisait a tout lui montrer — indefiniment, sans qu'aucun ecran ne le montre.

Corrige par `20260831203000_rdv_agrege_compte_actif`. **Regle : toute vue de `relance` qui
n'active pas `security_invoker` doit porter `WHERE relance.utilisateur_courant() IS NOT
NULL`.** Trois controles de `test:rls` le verifient, un par vue.

### [CORRIGE] Deux controles de test ne prouvaient rien — reveles par une base vide

Le premier passage de `test:garde-fous` sur Supabase a rendu **32/32 au lieu de 33/33**.

Le test de non-regression R-B.1 cherchait en base « un vendeur de la meme plaque, libre de
toute affectation ». **Sur une base fraichement seedee il n'en existe aucun** : CENTRE a
30 vendeurs et 5 tables de 6, l'effectif est exactement sature. En local il ne passait que
grace a deux vendeurs residuels laisses par d'anciennes executions.

Deux defauts en un :
- le controle ne tournait **que par accident**, sur une base polluee ;
- son `if` n'avait **pas de `else`**, contrairement a toutes les autres branches du
  fichier. Sa disparition etait donc **silencieuse** — seul le total changeait.

Meme classe de defaut dans `test:rls` : « le chef de table ne voit aucun RDV hors de son
perimetre » rendait 0 sur une base sans aucun RDV. Ce zero aurait ete identique avec une
politique absente. La suite l'a signale d'elle-meme (« CONTROLE SANS OBJET »), ce qui vaut
mieux qu'un vert mensonger mais ne remplace pas un vrai controle.

Les deux fabriquent maintenant leur matiere **dans la transaction annulee**.

**Regle : un controle qui depend de l'etat de la base ne prouve rien tant qu'on ne l'a pas
vu tourner sur une base vide. Et un `if` sans `else` dans une suite de tests est un
controle qui peut disparaitre sans bruit.**

### [CORRIGE] Les assertions comparaient des messages traduits

`test:rls` comparait des bouts de phrase (`permission denied`, `row-level security`). Les
messages de PostgreSQL sont **localises** : sur ce poste ils arrivent en francais. Les
46 controles sont passes au rouge d'un coup, sans qu'aucune regle n'ait bouge.

Les assertions portent desormais sur les **codes SQLSTATE** (`42501`, `42703`, `P0001`),
qui sont normalises. Piege associe : un SQLSTATE fait cinq caracteres **alphanumeriques**,
pas cinq chiffres — `P0001` (une exception de trigger) echappait a la premiere expression
reguliere, qui rangeait tous les refus de trigger en « aucun code ».

Comme `42501` couvre **a la fois** un `GRANT` manquant et un refus de politique, une
section verifie separement l'etat exact des droits (`has_table_privilege`,
`has_column_privilege`). Sans elle, un `GRANT` oublie se ferait passer pour une politique
qui fonctionne.

### [A CONNAITRE] Le blocage des ports 5432/6543 n'existe plus

`ETAT-PROJET.md` l'affirmait comme un fait acquis, et il a motive plusieurs decisions
d'architecture — dont le choix d'un Postgres local sur le VPS, puis le detour par la CI
pour les migrations. **Mesure le 31/08/2026 : les trois hotes Supabase repondent.**

A re-mesurer avant de rebatir quoi que ce soit sur cette hypothese : elle a deja ete
fausse une fois, et personne ne l'avait reverifiee.

### [A CONNAITRE] Les comptes `.test` existent sur Supabase

`comptes-test` a ete joue sur la base de production pour permettre a `test:rls` de tourner
la-bas. Ces comptes sont **inertes** — sans `auth_uid`, ils ne peuvent pas se connecter —
mais ils doivent etre archives avant la mise en service.

*Dette : `test:rls` devrait provisionner ses cinq paliers dans la transaction annulee,
comme elle le fait deja pour le palier `lecteur`. Le motif est ecrit, il reste a
l'appliquer aux quatre autres.*

---

## Ouvert — donnees a confirmer

### [CORRIGE] Vite rechargeait la page entiere a chaque edition de la grille

`components/GrilleVendeur.tsx` exportait a la fois un composant React et la fonction
`cleRdv`. Vite refuse alors le rafraichissement a chaud
(« Could not Fast Refresh — export is incompatible ») et **recharge la page**.

Consequence bien pire que la gene de developpement : les tests manuels devenaient
trompeurs. On croit observer une perte de saisie alors qu'on observe un rechargement au
milieu de la sequence — ce qui a coute plusieurs fausses pistes sur le defaut ci-dessus.

`cleRdv` et `libelleJour` vivent desormais dans `utils/grille.ts`. **Regle a retenir : un
module qui exporte un composant n'exporte QUE des composants.**

### [A CONNAITRE] Un test d'integration qui cree une entite metier laisse une trace

Consequence directe de l'interdit n.1 (`test:api` a depuis ete supprimee avec l'API ; le meme piege vaut pour toute suite qui ecrit) : elle creait un vendeur et des RDV, et
l'application ne peut supprimer ni l'un ni les autres — les triggers
`vendeur_pas_de_delete` et `rdv_pas_de_delete` s'y opposent, ce qui est exactement le
comportement voulu en production.

Traitement retenu : le script **purge son propre residu au debut du passage suivant**, par
la porte de purge (`SET LOCAL relance.purge_autorisee`). Le filtrage est etroit et ne peut
pas deraper — le nom du vendeur commence par `VENDEUR VERIF API` et le client du RDV vaut
exactement `CLIENT VERIF API`, deux marqueurs qu'aucune donnee reelle ne porte.

La base ne garde donc qu'**un** vendeur de test et **un** RDV de test entre deux passages,
au lieu d'en accumuler un de plus a chaque fois. Voir le defaut corrige plus bas.

Pour repartir propre : `drop schema relance cascade`, puis `migrate:deploy` et `seed`.

La lecon generale, valable pour la suite : **les tests qui creent des donnees metier ont
besoin d'une base jetable.** C'est a prevoir si une integration continue est mise en place.

### [DONNEES] Les MARQUES des vendeurs VN sont un placeholder

**Une seule dimension reste a confirmer, et non deux.** Le fichier source a ete relu :

*Types de vehicule (VN / VO)* : **ce n'est plus un placeholder.** L'onglet `RESULTATS`
donne le TYPE explicitement, vendeur par vendeur, et `scripts/extraire-xlsx.mjs` le reprend
tel quel — **72 VN et 27 VO**, somme verifiee contre les totaux par site (1107 des deux
cotes). Le seed echoue fort si l'un des 99 noms ne s'apparie pas. Le metier est donc une
donnee reelle, portee par la colonne scalaire `vendeur.type_vehicule`.

*Marques* : toujours un placeholder. Tous les blocs vendeur du fichier portent une section
Renault ET une section Dacia, quelle que soit la realite du terrain. Ce que le fichier donne
est une **activite** (`REN 0 / DAC 20`), pas une **autorisation** : un vendeur a zero RDV
Renault peut etre Dacia seul, ou n'avoir simplement rien vendu ce mois-la. On ne le deduit
donc pas. Le seed pose les marques DU SITE, ce qui est verifiable et non devine — Alpine
seul pour le site ALPINE, Renault + Dacia ailleurs.

**Consequence exacte : tant que ce n'est pas corrige, R-C.1 ne protege pas les VN.** Le
trigger `rdv_marque_autorisee` fonctionne — il est teste — mais il autorise tout, puisque
tout le monde est declare bi-marque. N'importe quel RDV Dacia passera sur un vendeur
exclusivement Renault.

**Les VO, eux, sont proteges** : `rdv_marque_selon_metier` impose `marque_id IS NULL` pour
un vendeur VO, et `rdv_type_coherent` impose l'egalite avec le metier du vendeur.

**Etat au 28/08/2026 : l'outil de correction existe** (ecran Vendeurs), avec import par
collage, grille de cochage, et modification du metier et des marques dans le meme
enregistrement. `vendeur.capacites_confirmees_le` distingue une donnee validee du
placeholder.

Verifie : un vendeur passe en Renault seul refuse bien un RDV Dacia
(`RELANCE: ANTOINE BASTIEN n'est pas autorise a vendre Dacia.`).

**LE SUIVI CHIFFRE DE CETTE DETTE A ETE RETIRE le 31/08/2026**, sur decision de
l'utilisateur : un vendeur present en base est valide, point. La jauge « x/72 » et sa route
n'existent plus.

Le sujet de fond reste : restreindre un vendeur VN a une seule marque se fait vendeur par
vendeur depuis l'ecran Vendeurs, et c'est ce qui donne du mordant a R-C.1. Simplement, ce
n'est plus presente comme une dette a solder — une progression qui ne bouge jamais devient un
reproche permanent.

### [DONNEES] Dates de la campagne de septembre 2026 en placeholder

Le seed cree « Septembre 2026 » du jeudi 10 au lundi 14 septembre, par analogie avec juin
(jeudi a lundi, week-end inclus). Dates inventees, a confirmer. A saisir dans l'ecran
Campagnes — ce qui est aussi le critere de recette n.2 : changer les jours d'une campagne
doit prendre moins de 30 secondes et les 99 plannings doivent suivre.

Le seed a longtemps pose le **14 au 18** alors que ce fichier annoncait le 10 au 14 : la
divergence est levee, code et documentation disent maintenant la meme chose. Voir le defaut
corrige plus bas.

### [DONNEES] L'onglet `MDP` du fichier source

Coquille vide, site sans vendeur. La ligne est commentee dans `seed_referentiels.sql` et
n'est donc pas reprise. A confirmer : site a venir, ou residu ? Le modele accepte un site
sans vendeur (F-A2.4), donc l'ajouter ne coute rien si c'est un vrai site.

### [OUVERT] Les 8 chefs de table ne recoivent aucun RDV en propre

Severine Besson, Thierry Coignac, Lucien Marchetti, JF Larget, Mickael Masson, Franck
Nogues, Jerome Hebert, Gilles Parrain. Aucun ne figure parmi les 99 vendeurs : ce sont
des encadrants sans bloc de saisie, ce qui est exactement pourquoi `Utilisateur` est
distinct de `Vendeur`.

Le modele le permet via `table_phoning.chef_utilisateur_id`, et le seed les cree comme
utilisateurs sans role global. **A confirmer** qu'aucun ne doit recevoir de RDV a son
nom. Si l'un d'eux vend aussi, il faut le creer en `Vendeur` et le relier par
`Vendeur.utilisateurId`.

---

## Resolu — 28/08/2026

### [RESOLU] Saisie enchainee : c'etait le pilote de test, pas l'application

Signale ouvert en priorite 1 en fin de J3 : dans la grille, taper un nom, `Entree`, le nom
suivant, `Entree`… semblait perdre un mot sur deux. **Verifie au clavier reel par
l'utilisateur : la saisie enchainee fonctionne.** Le defaut etait un artefact de
l'automatisation, comme les trois indices le laissaient craindre — la touche `Return` non
reconnue par le pilote alors qu'`Enter` l'est, les rechargements Vite en pleine sequence, et
l'envoi des caracteres par rafales.

Quatre defauts reels avaient tout de meme ete trouves et corriges en chemin, et ils
restent corriges : soumission implicite de `<form>` remplacee par un gestionnaire explicite ;
`edition`, `active` et `brouillon` doubles par des refs parce que les gestionnaires lisaient
l'etat FIGE dans la fermeture de leur rendu ; `Entree` et `Tab` traites aussi sur le
conteneur ; double ecriture par `onBlur` apres validation, qui creait un doublon invisible.

**Lecon a retenir, et elle a coute cher : un pilote de navigateur n'est pas un utilisateur.**
Avant de poursuivre un defaut d'ergonomie clavier trouve par automatisation, le faire
confirmer a la main. L'inverse — croire l'automatisation — a produit plusieurs fausses
pistes.


### [RESOLU] Les jours de juin 2026 comportent un dimanche

`seed_referentiels.sql` donne juin 2026 du **11 au 15 juin**, soit jeudi, vendredi,
samedi, **dimanche**, lundi. Signale comme anomalie probable, puisque le cahier des
charges parlait de « jours ouvres ».

**Confirme : la campagne couvrait bien un week-end.** Les dates du seed sont justes.

Consequence pour le code, plus large que ce seul cas : **les jours d'une campagne sont
libres**. Ni consecutifs, ni au nombre de cinq, ni limites aux jours ouvres. Toute
logique qui supposerait le contraire — un intervalle de dates plutot qu'une liste, un
filtre excluant les week-ends, un decompte fige a cinq — casserait sur des donnees
reelles. La mention « ouvres » a ete retiree de `CAHIER-DES-CHARGES.md` section 2 pour
que le sujet ne resurgisse pas.

---

## Corrige — 31/08/2026 (preparation du deploiement)

### [CORRIGE] L'ordre des listes de vendeurs dependait de la COLLATION DU SERVEUR

Trouve en preparant l'image Postgres de production, en comparant les ordres de tri sur les
101 noms reels :

| Environnement | `datcollate` | Resultat |
|---|---|---|
| Developpement (PostgreSQL sur Windows) | `French_France.1252` | reference |
| `postgres:17-alpine`, locale par defaut | `en_US.utf8` | **5 noms accentues deplaces** |
| `postgres:17-alpine`, `--locale=C.UTF-8` | `C.UTF-8` | tri par point de code : `ÉMILIEN` apres `ZOÉ` |

`JÉRÉMY DA COSTA` et `RÉMI DEGAND` reculaient de huit rangs. Autrement dit : **la liste de
l'ecran de saisie n'aurait pas eu le meme ordre en production que sur le poste ou l'outil a
ete eprouve** — dans le module C, celui qu'un chef parcourt des yeux pendant une session.

Aggravant : le premier `docker-compose.yml` que j'ai ecrit posait `--locale=C.UTF-8`, donc
le pire des trois, avec un commentaire affirmant que c'etait pour eviter exactement ce
probleme. Le commentaire etait juste sur le risque et faux sur le remede.

**Le defaut de fond n'est pas le choix de la locale, c'est d'en dependre.** Le projet le
dit deja deux fois — `agregats.ts` : « un classement qui change en changeant de machine
n'est pas reproductible, donc pas contestable » ; `Vendeurs.tsx` : « un tri qui change de
machine en machine n'est pas un tri ». Regler la locale du conteneur aurait fait
disparaitre le symptome en laissant la dependance.

Correction : `backend/src/utils/tri.ts`, **source de verite unique** du tri des libelles
cote backend (cle accents retires + majuscules, second critere sur la chaine brute pour
garantir un ordre total). Les quatre routes qui rendent une liste de personnes trient
desormais en JavaScript : `saisie`, `referentiels`, `tables`, `dashboard`. `agregats.ts`
perd sa copie privee de la cle et importe celle-la.

Verifie : l'API rend les 101 vendeurs avec **zero ecart** par rapport au tri deterministe,
et `JÉRÉMY DA COSTA` se place entre `JEAN-PIERRE FERRIER` et `JEROME SABIN`. La collation
de la base de production n'a plus aucun effet sur ce que voit l'utilisateur — le choix
d'image Postgres n'est plus une decision de produit.

Restait, et reste, a traiter : le front porte **trois** copies de la meme normalisation
(`Gestion.tsx`, `Saisie.tsx`, `Vendeurs.tsx`) et `Tables.tsx` utilise `localeCompare('fr')`,
qui contredit la doctrine. Sans effet visible aujourd'hui puisque l'API rend deja l'ordre
juste, mais c'est la meme duplication qu'interdit n.6 vise.

### [A CONNAITRE] Le mot de passe SSH du VPS a circule en clair

Transmis en clair dans la conversation du 31/08/2026, avec les acces du serveur.
L'authentification par cle fonctionne et c'est celle utilisee. Deux gestes en attente :
changer ce mot de passe, et desactiver l'authentification par mot de passe
(`PasswordAuthentication no`) une fois la cle confirmee comme seul acces.

---

## Corrige — 31/08/2026 (un garde-fou disparu en silence)

### [CORRIGE] Trois garde-fous ne tournaient que si le jeu de donnees s'y pretait

Trouve en comparant deux passages : la suite est passee de **33/33 a 32/32 sans afficher
quoi que ce soit**. Un compteur qui baisse tout seul est le pire des symptomes — il se lit
comme « rien a signaler ».

Cause : les trois verifications de R-B.5 (table specialisee) cherchaient un vendeur reel
**libre** de la plaque, et deux d'entre elles n'avaient **aucune branche `else`** quand elles
n'en trouvaient pas. La purge de `MARC TESTEUR`, seul VO libre de CENTRE, a donc supprime en
silence le garde-fou « un vendeur VO ne rentre pas dans une table specialisee ».

Le defaut de fond n'est pas la donnee, c'est la dependance : **ce que verifie ce garde-fou
n'a aucun rapport avec la composition des tables du moment.**

Correction :

- quand aucun vendeur reel ne convient, la verification **en fabrique un dans sa propre
  transaction**. `doitRefuser` et `doitAccepter` forcent un `ROLLBACK`, donc rien ne
  survit — verifie apres coup : zero ligne `GARDE-FOU %` en base ;
- les trois cas ont desormais une branche `else` qui **echoue bruyamment** si le prealable
  manque vraiment (marque ALPINE ou site de la plaque introuvables).

De retour a **33/33**, et le compte ne peut plus baisser sans le dire.

**La regle : un garde-fou qui peut ne pas tourner doit dire qu'il n'a pas tourne.** C'est le
meme principe que « une contrainte qu'on n'a jamais vue refuser quelque chose n'est pas une
contrainte » — appliquee au harnais lui-meme.

---

## Corrige — 31/08/2026 (chaine encadrant -> chef de table)

### [CORRIGE] Un compte neuf n'etait pas proposable comme chef de table

Le meme vivier de personnes est demande a deux endroits — le selecteur d'encadrant d'un
site (ecran Vendeurs) et le selecteur de chef de table (ecran Tables) — et les deux routes
l'exprimaient **differemment** :

| Route | Filtre |
|---|---|
| `GET /api/referentiels` | tous les comptes actifs, hors `lecteur` |
| `GET /api/tables/session/:id` | comptes actifs ayant **deja** un site encadre, ou un role `admin`/`direction` |

Consequence, en suivant la sequence decrite pour l'ecran Comptes : je cree un compte, je vais
dans Tables pour l'attribuer, **il n'y est pas**. Il fallait d'abord lui donner un site dans
l'ecran Vendeurs — un ordre impose par rien, sinon par cette requete.

Et l'exclusion frappait aussi les **huit chefs de table de juin**, qui n'encadrent aucun
site : impossible de les redesigner, alors qu'ils animent deja une table.

Correction : la route des tables applique le meme filtre que les referentiels — tous les
comptes actifs sauf les `lecteur`, pour qui animer une table contredirait le palier. L'ecran
les repartit en trois groupes de lecture : encadrants de la plaque, encadrants d'ailleurs,
autres comptes. **Un groupe de lecture, jamais un filtre** : prendre un coach d'une autre
concession est le but de l'exercice.

Verifie dans le navigateur : `THIERRY COIGNAC`, rattache comme chef de site d'ALPINE depuis
l'ecran Vendeurs, apparait aussitot dans « Encadrants de CENTRE » du selecteur de chef de
table ; les quatorze comptes actifs sont proposables. Rattachement annule apres l'essai —
archive, pas supprime.

**La lecon, qui est celle de l'interdit n.6 : deux requetes qui doivent rendre le meme
vivier sont une liste de valeurs dupliquee.** Elles ont divergees sans que rien ne le
signale.

### [A CONNAITRE] La colonne « tables animees » de l'ecran Comptes nommait mal ses lignes

Un chef qui anime la Table 1 de SUD sur juin **et** sur septembre affichait deux etiquettes
`TABLE 1 · SUD` identiques, la campagne n'etant que dans l'infobulle. Ca se lit comme un
doublon de donnees. La campagne est desormais dans l'etiquette : le libelle d'une table
n'identifie rien sans elle.

---

## Corrige — 31/08/2026 (seed et residu de test)

### [CORRIGE] Le seed RE-AJOUTAIT ses jours par-dessus ceux qu'on avait edites

Trouve par la suite API, qui exigeait 4 jours apres un retrait et en trouvait 8.

`creerCampagne` faisait un `upsert` de la campagne **puis un `upsert` de chacun de ses
jours**. Sur une campagne existante dont les jours avaient ete corriges dans l'ecran
Campagnes, le seed reposait donc ses cinq jours de placeholder *en plus* des cinq
existants : la campagne de septembre s'est retrouvee avec **neuf jours** apres un simple
`npm run seed`, et ses dates ramenees a l'ancien placeholder.

Aggravant : le seed posait le **14 au 18 septembre** alors que la documentation annoncait le
**10 au 14**. J'avais corrige la documentation sans corriger le code — une divergence que
rien ne surveillait, et qui a fabrique les quatre jours en trop.

Correction — `creerCampagne` **ne touche plus a une campagne existante** :

- si la campagne existe, il complete seulement ce qui est structurel (les sessions par
  plaque, en `upsert` avec `update: {}`) et rend la main. Ni dates, ni jours, ni creneaux ;
- si elle n'existe pas, il la cree entierement, en `create` et non en `upsert` — l'intention
  devient lisible, et une collision inattendue echoue bruyamment au lieu d'ecraser ;
- les dates du placeholder sont alignees sur le 10 au 14.

**La regle qui manquait : un seed etablit un ETAT INITIAL, il ne se bat pas avec les
modifications de l'utilisateur.** L'idempotence ne suffit pas — rejouer le seed doit etre
*sans effet*, pas seulement *sans doublon*.

Verifie : septembre reste a 5 jours et du 10 au 14 apres deux `npm run seed` consecutifs, et
`test:api` repasse a 43/43.

### [CORRIGE] Le vendeur de test sortait APRES juin, et gonflait l'effectif de juin

`test:api` posait la date de sortie de son vendeur de test au **31/08/2026** — c'etait la
verification « sortir un vendeur sans le supprimer ». Mais ce vendeur survit au script
(interdit n.1), et une sortie posterieure a juin le laisse **present pendant juin** :
l'effectif de juin affichait 101 la ou septembre affichait 100.

Meme classe que le defaut deja corrige a la racine (« le residu des tests gonflait
l'effectif de juin »), a un endroit qui avait ete oublie : le prealable appliquait bien le
01/01/2026, la verification elle-meme non. Corrige — les deux posent desormais le
01/01/2026, avant la premiere campagne. Les deux campagnes affichent 100.

### [CORRIGE] Le residu de test s'accumulait, un peu plus a chaque passage

`test:api` sortait ses vendeurs de test au 01/01/2026 sous un nom unique, et archivait ses
RDV de test. Les chiffres metier etaient bien proteges — un vendeur sorti n'entre dans aucun
effectif, un RDV archive dans aucun total — mais **chaque passage en laissait un de plus** :
seize lignes `VENDEUR VERIF API #NNN` a Mozac, et douze RDV `CLIENT VERIF API` archives sur
un vendeur de Clermont.

Du residu qui grossit n'est pas un residu inoffensif : c'est un residu qu'on finit par
prendre pour une donnee. C'est exactement ce qui s'est passe avec les « 7 RDV » de
`JEAN-FRANCOIS LARGET`, cites plus haut comme preuve qu'il etait un vendeur reel.

Correction : le prealable de la suite **purge le residu du passage precedent** par la porte
de purge, sur les deux marqueurs. Verifie sur deux passages consecutifs : la base reste a
1 vendeur de test et 1 RDV de test, sans croissance.

---

## Corrige — 31/08/2026 (encadrants et comptes)

### [CORRIGE] ERREUR DE MODELE : les encadrants n'etaient pas des comptes

**Le defaut le plus grave de toute la journee, et il etait de moi.** J'avais fait du
chef de site et du chef de vente deux DRAPEAUX sur `vendeur` (`chef_de_site`,
`chef_de_vente`), en croyant que l'encadrant se choisissait parmi les vendeurs du
site.

Consequence directe, rapportee par l'utilisateur : « quand je selectionne ce menu
deroulant sur un site, il me propose uniquement les vendeurs du site en question.
Sauf que c'est la ou ca peche. »

**Ce que le metier demande vraiment :**

> « Par le biais des tables on fait des groupes le plus heterogene possible. Je mets
> 5 vendeurs de 5 concessions differentes, et un chef de vente en chef de table d'une
> AUTRE concession pour les coacher. Ca fait de la mixite et c'est tout l'interet du
> truc. »

Avec un drapeau sur `vendeur`, cette mixite etait **litteralement inexprimable** : le
selecteur ne pouvait proposer que les vendeurs du site courant.

**Correction** — migration `20260831180000_encadrants_comptes` :

- table `encadrement_site` : le rattachement (site, role) -> UTILISATEUR, durable et
  hors campagne. Un site a ses encadrants, une table se compose a chaque campagne ;
- role global `direction` ;
- suppression de `vendeur.chef_de_site` et `vendeur.chef_de_vente`, et de leurs deux
  triggers. Les laisser en place aurait garanti qu'on s'y trompe a nouveau.

Verifie de bout en bout : un compte rattache a Clermont et Mozac apparait dans le
selecteur de chef de table de **SUD-OUEST**, une plaque ou il n'encadre rien.

**Lecon : quand un selecteur ne peut proposer que ce qui est deja au bon endroit,
c'est le modele qui est faux, pas le selecteur.**

### [CORRIGE] `direction` n'avait aucun perimetre de saisie

La specification dit « acces total mais pas a l'interface de gestion des
utilisateurs ». `vendeursSaisissables` ne traitait que `admin` : un compte Direction
ressortait avec **zero vendeur saisissable**.

Trouve par le script des comptes de test, qui REFUSE de livrer un compte sans
perimetre — un garde-fou ecrit pour une autre raison, et qui a servi.

### [A CONNAITRE] La question posee la veille est tranchee

`BUGS-CONNUS.md` portait : « la chaine encadrant -> chef de table est incomplete,
decision en attente ». **Tranchee** : l'encadrant est un compte, cree depuis l'ecran
Comptes, rattache a un site depuis l'ecran Vendeurs et a une table depuis l'ecran
Tables. Les 8 chefs de table du fichier source restent des comptes sans vendeur
rattache — ils n'ont pas de bloc de saisie, et l'effectif reste a 99.

---

## Corrige — 31/08/2026 (passe UX)

### [CORRIGE] L'encadrement d'un site ne s'enregistrait pas — course entre deux requetes

**Symptome rapporte : « je ne peux toujours pas saisir les chefs de site/vente ».**

Changer de titulaire lancait DEUX appels cote a cote, sans les attendre : retirer le
role a l'ancien, le donner au nouveau. Les deux requetes partaient en parallele, et
quand la seconde arrivait avant la premiere, le trigger voyait encore l'ancien
titulaire et refusait avec un 409.

Ca passait ou ca echouait selon le hasard du reseau — donc ca ne marchait pas. Mon
propre essai avait passe par chance de timing, ce qui est la pire facon de valider
quelque chose.

Corrige en UNE action sequentielle : on retire, on ATTEND, on donne. L'ordre inverse
est refuse par construction. Verifie sur les trois roles d'un meme site, transfert
compris.

**Lecon : deux ecritures qui dependent l'une de l'autre ne se lancent pas cote a
cote, meme quand le test passe.**

### [CORRIGE] Une regle CSS fourre-tout peignait tous les boutons en degrade

Detail complet dans la section Charte de `CLAUDE.md`. La regle
`button:not(.lien):not(.onglet):not(.secondaire)…` avait fini par attraper les
segments du tableau de bord, les en-tetes de colonne triables et les cartes de
vendeur du module B. Regle INVERSEE : le defaut est neutre, `.principal` porte le
degrade. Un bouton oublie est desormais discret au lieu d'etre criard.

J'avais note apres la premiere collision qu'il faudrait inverser a la troisieme.
C'etait la troisieme.

### [CORRIGE] Les menus deroulants ignoraient le theme

`background: var(--bg-input)` valant `rgba(0,0,0,0.2)` en theme sombre, le systeme
remplacait ce fond quasi transparent par son propre gris. Et la liste OUVERTE
restait celle de l'OS. Deux surfaces a traiter, et une seule l'etait :
`appearance: none` + chevron dessine pour le champ ferme, `option { background-color }`
pour la liste — la seule prise disponible, et elle suffit.

### [RESOLU] La chaine « encadrant -> chef de table » etait incomplete

Constat de l'epoque : un role d'encadrement etait porte par un `Vendeur`, le chef d'une
table est un `Utilisateur`, et le lien `vendeur.utilisateur_id` n'etait renseigne pour aucun
vendeur. La chaine ne pouvait donc pas fonctionner.

**Voie retenue : les encadrants sont des COMPTES**, pas des vendeurs porteurs d'un drapeau.
`encadrement_site (site_id, role, utilisateur_id)` remplace les colonnes
`vendeur.chef_de_site` / `chef_de_vente`, supprimees. Les 8 chefs de table de juin restent
des comptes sans bloc de saisie, l'effectif reste a 99, et le meme compte peut encadrer un
site et animer la table d'une autre concession.

`vendeur.utilisateur_id` reste utile et facultatif : il relie un chef de vente qui vend
lui-meme a son bloc de saisie. Ce n'est plus un prerequis de la chaine.

### [A CONNAITRE] Le selecteur << Specialisee >> a ete retire de l'ecran Tables

Sur demande. La colonne `table_phoning.marque_id`, son trigger et ses trois garde-fous
RESTENT : ils ne coutent rien et continuent de proteger si une valeur y est posee un
jour. A dire si tu veux les retirer aussi — c'est une migration.

---

## Corrige — 31/08/2026 (ajustements vendeurs)

### [CORRIGE] La suite API a ABIME la campagne de septembre

**Le defaut le plus grave de ce lot.** `test:api` modifie des donnees metier — les
jours de la campagne de septembre — et sa remise en etat vivait en fin de `main()`,
donc ne tournait JAMAIS en cas d'exception.

Ce n'est pas theorique : une simple erreur de serialisation `BigInt` a fait planter
le script en plein milieu, deux fois de suite. Resultat constate — la campagne de
septembre avec **9 jours au lieu de 5**, ses dates ramenees a l'ancien placeholder
du seed (14 au 18 septembre), et les `ordre` melanges.

Reparee par l'API, donc en respectant R-A.2 : les 4 jours surnumeraires ne portaient
aucun RDV, rien n'a bouge. Puis le defaut de fond corrige — la restauration passe par
un **carnet** rempli au fur et a mesure et consomme dans un `finally`, chaque etape
protegee individuellement, et un echec de restauration CRIE au lieu de se taire.

**Lecon : un test qui touche a la donnee metier doit rendre l'etat MEME quand il
echoue.** Verifie : la campagne survit intacte a un passage complet.

### [CORRIGE] Le volet Archivage restait perime

Archiver un vendeur pendant que le volet Archivage etait ouvert le faisait
disparaitre de la liste **sans apparaitre dans les archives** : le volet ne se
rechargeait pas. Un compteur de version, incremente a chaque archivage et passe en
dependance de l'effet, sert desormais de signal de relecture.

### [A CONNAITRE] `JEAN-FRANCOIS LARGET` n'est pas un residu — mais son decompte de RDV l'etait

Signale trois fois comme « cree par l'interface, absent du fichier source ».
Verifie a l'occasion d'un essai d'archivage : il porte **1 affectation et le role de chef de
site a Clermont**. C'est un vendeur reel, cree volontairement le 28/08.

**Correction du raisonnement.** J'avais conclu au vendeur reel en partie sur ses « 7 RDV ».
Verification faite un cran plus loin : ces RDV etaient **les RDV de test de la suite API**,
tous archives, tous nommes `CLIENT VERIF API`, empiles a raison d'un par passage — ils
etaient douze. La conclusion tient (il est bien reel, il porte une affectation et un role),
mais l'argument etait faux. Un decompte n'est un argument que si on a regarde les lignes.

C'est la suite API qui posait ses RDV de test sur lui ; elle purge desormais les siens.

L'archivage teste sur lui a ete annule : etat restaure a l'identique, role compris.
C'est precisement l'interet de l'archivage sur la suppression — un geste de trop ne
coute rien.

Reste `MARC TESTEUR` (site ALPINE, 0 RDV), archive, et disponible a la purge dans le
volet Archivage si l'utilisateur le confirme.

---

## Corrige — 31/08/2026 (modules B et D)

### [CORRIGE] La specialisation d'une table etait decidee par le TIRAGE AU SORT

**Le defaut le plus grave de ce lot, et le desequilibre n'en etait que le symptome.**

F-B.5 demande de « respecter les marques quand la table est specialisee ». Le modele ne
portait aucun lien table -> marque, donc la premiere implementation DEDUISAIT la
specialisation des membres deja presents : les marques que la table couvrait.

Constate sur la vraie session CENTRE de septembre, 29 vendeurs et 3 tables : la repartition
a rendu **11/8/10 au lieu de 10/10/9**. Cause exacte — le premier vendeur tire au sort dans
une table vide fixait ses marques pour toujours. Un vendeur ALPINE (Alpine seule) est tombe
dans la table 2, qui a des lors refuse tout Renault/Dacia et n'a plus accueilli que des
Alpine et des VO. Elle est devenue le **deversoir** des vendeurs sans contrainte.

Le fond : une specialisation decidee par le hasard est l'inverse exact de ce que la regle
demande. **Une table specialisee est une decision humaine, donc une colonne** —
`table_phoning.marque_id`, migration `20260831090000_table_specialisation`, avec son trigger
`affectation_marque_table` et trois garde-fous (R-B.5).

Effet de bord heureux : `utils/repartition.ts` est PLUS SIMPLE qu'avant. L'etat mutable par
table a disparu — c'etait lui qui rendait le resultat dependant de l'ordre de tirage.

**Une premiere tentative de correction etait fausse aussi**, et c'est le test qui l'a dit :
j'avais remplace l'intersection des marques des membres par leur union. L'assertion
« un bi-marque rouvre une table specialisee » a echoue, parce qu'une intersection ne peut que
se reduire. En creusant : une table contenant un Renault-seul ET un Dacia-seul avait une
intersection VIDE, donc plus aucune contrainte — elle acceptait un vendeur Alpine. Une table
plus diverse devenait moins contrainte. Absurde, et invisible a la relecture.

### [CORRIGE] Le temps reel ne se connectait pas, en silence

`hooks/useTempsReel.ts` demandait `transports: ['websocket', 'polling']` — le WebSocket
d'abord, pour economiser le tour de polling. Constate dans un navigateur qui bloque `ws://` :
trois echecs dans la console, **aucun repli**, zero requete socket.io, et le temps reel muet.
Le critere de recette n°5 tombait sans qu'aucune erreur n'apparaisse a l'ecran.

Le probleme n'est pas propre au bac a sable : **un proxy d'entreprise refuse souvent l'upgrade
WebSocket**, et l'outil tournera derriere Caddy sur le reseau du groupe. Retour a l'ordre par
defaut de socket.io — polling, puis montee en WebSocket quand c'est possible — plus un
`connect_error` journalise. Verifie : 5 requetes en polling, et un RDV cree depuis un autre
client fait monter le tableau de bord tout seul (3 -> 4, samedi 12/09 de 0 a 1).

**Lecon : une optimisation qui echoue en silence coute plus qu'elle ne rapporte.**

### [CORRIGE] Un test cassait parce que le travail metier AVANCAIT

`test:api` exigeait deux vendeurs VN de Clermont **non encore confirmes**, pour voir le
compteur de progression franchir une transition. Le script a cesse de demarrer le jour ou les
12 VN de Clermont ont ete confirmes — c'est-a-dire le jour ou l'outil a servi a ce qu'il sert.

Il note desormais l'etat EXACT des deux vendeurs qu'il choisit, le neutralise le temps du
test, et le restaure a l'identique. La restauration remettait par ailleurs
`capacites_confirmees_le` a `null` d'office : sur un vendeur deja confirme par un
administrateur, elle aurait **efface une vraie confirmation**.

### [CORRIGE] Un decompte de structure ecrit en dur dans un test

La meme suite exigeait exactement **99 vendeurs actifs**. Elle a echoue a 98 : un vendeur
ajoute et deux sortis par l'interface. Un decompte de structure ecrit en dur est un bug meme
quand il est juste le jour ou on l'ecrit (interdit n°3). L'effectif attendu est maintenant lu
en base — le test verifie que la route rend CE QUE LA BASE CONTIENT.

### [CORRIGE] Le message d'un trigger fuyait les internes du pilote, a nouveau

`routes/tables.ts` avait sa propre extraction du message d'un trigger, qui coupait au premier
saut de ligne. Or tout tient sur une seule ligne : l'utilisateur lisait
`... severity: "ERREUR", detail: None`. **Exactement la classe de defaut deja corrigee dans le
gestionnaire d'erreurs global, reintroduite en la recopiant** — interdit n°6.

Source unique de l'epoque : `utils/messageTrigger.ts` (supprime le 01/09/2026, sans
appelant — le navigateur ne voit plus d'exception Prisma ; c'est `messageLisible` de
`services/supabase.ts` qui retire le prefixe d'un message PostgREST). Elle de-echappe aussi les
guillemets, ce qui reglait d'un coup les `la table \"Table 1\"` de tous les messages.

### [CORRIGE] Derive Prisma : un index cree en SQL sans etre declare

La migration `20260831090000` cree `table_phoning_marque_id_idx`. Prisma GERE les index :
faute d'etre declare dans `schema.prisma`, il proposait un `DROP INDEX` a chaque
`migrate diff`. Classe de derive deja rencontree sur les index partiels. `@@index([marqueId])`
ajoute.

---

## A connaitre — defauts du FICHIER SOURCE

### [FICHIER] Dix totaux du jour sont faux dans le classeur

Releve a l'extraction des 1107 RDV. La ligne 2 de chaque onglet site porte un `COUNTA` des
blocs vendeur. Sur **GAILL et CARM**, cette formule contient des `#REF!` et vise des lignes
qui n'existent plus — CARM fait 27 lignes et sa formule additionne jusqu'a la 138 — tout en
AFFICHANT un nombre plausible. Ce sont des valeurs figees, jamais recalculees depuis que des
blocs ont ete supprimes.

L'ecart : GAILL sur-compte de 2 par jour (10 au total), CARM de 5 par jour (25 au total).

**RESULTATS, lui, est juste** : notre lecture des cellules retombe a l'unite sur ses totaux
par vendeur et par site. Les totaux de site, de plaque et de groupe du fichier ne sont donc
pas affectes — seules ces deux lignes d'en-tete mentent.

`scripts/extraire-xlsx.mjs` le signale a chaque passage et marque ces entrees `fiable: false` ;
`test:agregats` les exclut de la comparaison et compte celles qu'il ignore. C'est exactement
la fragilite que cet outil remplace : une formule cassee qui continue d'afficher un chiffre.

---

## Corrige — 28/08/2026

### [CORRIGE] Onglet Vendeurs : page blanche muette

**Symptome.** L'onglet Vendeurs n'affichait plus rien. Pas un message, pas une trace a
l'ecran : l'application entiere disparaissait, barre de navigation comprise.

**Cause.** `services/referentiels.ts` declarait encore
`VendeurReferentiel.typesVehicule: TypeVehicule[]` alors que la migration
`vendeur_type_scalaire` avait remplace ce tableau par un scalaire `typeVehicule`. L'ecran
appelait `v.typesVehicule.includes(...)` sur `undefined`.

**Pourquoi `tsc` n'a rien vu, et c'est le vrai enseignement.** Les deux typechecks passaient
au vert. **L'interface mentait sur la reponse de l'API**, et TypeScript ne verifie que la
coherence du front avec sa propre declaration, jamais avec ce que le serveur renvoie
vraiment. Une interface de reponse HTTP non tenue a jour est un mensonge que le compilateur
valide.

**Corrections.** Contrat aligne sur le scalaire. Metier et marques se modifient desormais
**dans le meme enregistrement** : le serveur exige au moins une marque pour un VN et un VO
n'en a aucune, donc deux gestes separes rendaient le passage VO vers VN impossible. Les
colonnes de marque d'un vendeur VO affichent `—`, comme dans le fichier source.

### [CORRIGE] Une erreur dans un ecran vidait toute l'application

Consequence du defaut precedent, et bien plus grave que lui : il n'y avait **aucune
frontiere d'erreur**. Il a fallu ouvrir la console du navigateur pour savoir quel champ
manquait. Inacceptable en session — un chef de table qui perd son ecran a 19h un samedi
n'ouvrira pas les outils de developpement.

`components/Rempart.tsx`, une frontiere **par onglet** : l'ecran fautif nomme sa panne,
propose de reessayer, et les autres onglets restent utilisables.

### [CORRIGE] Vite se rabattait silencieusement sur le port de l'API

`vite.config.ts` demande le port 3000. Sans `strictPort`, Vite passe **sans rien dire** au
port suivant quand 3000 est pris — donc sur **3001, celui de l'API**. Le front se sert alors
depuis le port qu'il proxifie, et le proxy `/api` boucle sur lui-meme. Constate en vrai.
`strictPort: true` : un refus net vaut mieux qu'un demarrage qui mentira.

### [CORRIGE] `npm run dev` du backend ne demarrait pas

`nodemon src/index.ts` appelle `ts-node` par defaut, qui n'est pas une dependance du projet
— celui-ci utilise `tsx`. Le script echouait donc systematiquement
(`'ts-node' n'est pas reconnu`), et l'API avait ete lancee a la main par
`npx tsx src/index.ts`, **sans rechargement automatique**. Consequence : une modification du
backend n'etait pas prise en compte, et il fallait s'en apercevoir.
`nodemon --exec tsx --watch src --ext ts,json src/index.ts`.

### [CORRIGE] Le residu des tests gonflait l'effectif de juin

`test:api` sortait ses vendeurs de test au **31/08/2026**, soit APRES la campagne de juin.
`presenceVendeur` les comptait donc comme presents en juin : l'effectif affichait **106 au
lieu de 99**. Du residu de test qui contamine un chiffre metier, alors que le critere de
recette n.4 exige de retrouver les totaux a l'unite. Sortie repoussee au 01/01/2026, avant
la premiere campagne, et les 7 vendeurs deja en base ont ete remis en conformite — par mise
a jour de leur date de sortie, sans aucune suppression (interdit n.1).

### [CORRIGE] Deux denominateurs differents pour la meme progression

*Entree historique : cette route n'existe plus depuis le 31/08/2026, la notion de
confirmation ayant ete retiree. La lecon sur les implementations concurrentes, elle, reste.*

`GET /api/vendeurs/capacites/progression` comptait les 99 vendeurs, l'ecran n'en comptait
que les 72 VN. Le front n'appelait pas encore la route, donc rien ne divergeait a l'ecran —
c'est exactement le piege de l'interdit n.6 : une implementation concurrente non branchee,
que quelqu'un finira par brancher. L'API compte desormais les VN seuls.

### [CORRIGE] Un chef sans perimetre atterrissait sur un ecran vide

L'ecran de saisie ouvrait sur la campagne la plus recente. Un chef de table de juin
atterrissait donc sur septembre, ou il n'a aucun droit, et lisait « aucun vendeur ne vous est
rattache » comme une panne. `GET /api/campagnes` porte desormais `vendeursSaisissables`, le
nombre de vendeurs que L'APPELANT peut saisir sur chaque campagne : l'ecran ouvre sur une
campagne ou il y a quelque chose a faire, et le selecteur annote les autres.


### [CORRIGE] Le parseur d'import avalait la premiere ligne de donnees

Trois defauts du meme ordre dans `utils/importMarques.ts`, tous trouves par
`npm --prefix backend run test:import` et non par relecture.

1. **En-tete detecte a tort.** Le critere etait « cette ligne contient-elle un nom de
   marque ». Or au format « marques groupees » sans en-tete, la premiere ligne de donnees
   en contient forcement une (`CLF | PARPINELLI VALENTIN | DACIA`) : le premier vendeur du
   fichier disparaissait en silence. Le critere fiable est l'inverse — une ligne d'en-tete
   ne porte **jamais** de nom de vendeur connu.
2. **Collage d'une seule ligne rejete.** Meme cause : une correction ponctuelle sur un
   vendeur inconnu etait refusee comme « contenu reduit a un en-tete ». Ajout d'un second
   garde-fou : un en-tete qui ne laisse aucune ligne de donnees n'est pas un en-tete.
3. **Colonne de marques indetectable des qu'une valeur etait fautive.** La deduction
   exigeait que **tous** les termes d'une colonne soient des marques connues. Une seule
   faute de frappe faisait chuter le score sous le seuil, et l'utilisateur recevait
   « aucune colonne de marques reconnue » — un message qui accuse le tableau entier au
   lieu de designer la ligne. Passe a « au moins un terme connu », plus un dernier recours :
   si les colonnes nom et site sont identifiees et qu'il n'en reste qu'une non vide, c'est
   celle des marques.

**Lecon.** Un parseur tolerant doit degrader ligne par ligne, jamais en bloc. Le bon
comportement face a une anomalie est de l'isoler et de continuer, parce que l'utilisateur
corrige une ligne, pas un fichier de 99.

### [CORRIGE] `verifier_affectation_unique` refusait une reaffectation a la MEME table

**Symptome.** Le seed rejoue une seconde fois echouait sur
`RELANCE: ce vendeur est deja affecte a la table "Table 1" pour cette campagne`, alors
que la table en question etait justement celle qu'on reaffectait. L'idempotence du seed
etait donc cassee — et c'est le test d'idempotence qui a trouve le defaut, pas une
relecture.

**Cause.** La premiere version du trigger s'auto-excluait par
`a.id <> COALESCE(NEW.id, -1)`. Or `upsert` cote Prisma se traduit par
`INSERT ... ON CONFLICT DO UPDATE` : le trigger `BEFORE INSERT` se declenche **avant** que
le conflit ne soit detecte, donc avec un `NEW.id` tout neuf issu de la sequence.
L'auto-exclusion ne reconnaissait jamais la ligne existante, et le trigger voyait son
propre couple (table, vendeur) comme un doublon.

**Correction.** Migration `20260828091000_fix_affectation_unique` : retour a la
formulation de `schema.sql`, `a.table_id <> NEW.table_id`. C'est la regle R-B.4 telle
qu'elle est ecrite — un vendeur ne peut appartenir qu'a une seule table par campagne — et
une reaffectation a la meme table n'a jamais ete une violation.

**Lecon a retenir.** Un trigger `BEFORE INSERT` ne peut pas raisonner sur l'identite
technique de la ligne en cours d'insertion des lors que l'appelant passe par
`ON CONFLICT`. Il doit raisonner sur les **cles metier**.

Test de non-regression en place : `R-B.4 reaffectation a la MEME table` dans
`npm --prefix backend run test:garde-fous`.

### [CORRIGE] `Marque.code` sans contrainte unique

Oubli lors du passage des trois booleens `renault`/`dacia`/`alpine` a une table `marque`.
Le seed echouait sur `marque.upsert` faute de cle unique. Migration
`20260828084642_marque_code_unique`.

---

## Defauts de `schema.sql` corriges par conception dans `schema.prisma`

Consignes ici pour qu'on ne les reintroduise pas. `schema.sql` est conserve a la racine
en reference historique.

| Defaut | Ligne d'origine | Traitement |
|---|---|---|
| Effectif calcule a la mauvaise date : moyenne RDV/vendeur d'une campagne passee qui change des qu'un vendeur part | `schema.sql:212-225` | `utils/presenceVendeur.ts`, source unique, bornee par les dates de la campagne |
| `vendeur.date_entree` absente : un vendeur cree en novembre entre retroactivement dans l'effectif de septembre | — | Colonne ajoutee |
| Classements bases sur les RDV : un vendeur a 0 RDV disparait du classement | `schema.sql:200-209` | Les classements partiront de `vendeur`, pas des RDV |
| 3 marques en dur, en colonnes et en `check` | `schema.sql:35-37`, `:116` | Tables `marque` + `vendeur_marque` |
| `table_phoning.chef_id` doublant `chef_user_id` sans contrainte de coherence | `schema.sql:94-95` | `chef_id` supprime |
| Nom du chef dans le libelle de la table (`SEVERINE BESSON — TABLE 1`) : faux des que le chef change | seed | Libelle `Table N`, chef par cle etrangere |
| `ordre = 0` sur les 8 tables, rendant non deterministe le departage de la repartition a graine fixe | seed | `ordre` 1..n |
| Seed non idempotent : une seconde execution dupliquait 19 sites et 99 vendeurs | seed | `upsert` / `findFirst`, verifie par rejeu |
| RLS activee sans aucune politique — renvoie zero ligne, sans erreur | `schema.sql:231-240` | Sans objet : plus de RLS, l'API fait autorite |
| Triggers non `security definer` lisant des tables sous RLS : controle contournable en silence | `schema.sql:137`, `:160`, `:177` | Sans objet pour la meme raison ; les triggers sont conserves comme filet |
| Vues sans `security_invoker`, executees avec les droits du proprietaire | `schema.sql:192-225` | Sans objet : les agregats seront des requetes Prisma (interdit n.2 dit « par vue **ou requete** ») |
| `on delete cascade` decoratif sur `campagne_jour`/`campagne_creneau` : echoue des qu'un RDV existe | `schema.sql:62`, `:70` | Conserve et documente — c'est le garde-fou voulu de R-A.2 |

---

## Pieges d'environnement

### `prisma migrate dev` ne fonctionne pas ici

Le PowerShell embarque est non interactif ; `migrate dev` le refuse, y compris avec
`--create-only` des lors que la base porte deja des migrations. D'ou
`scripts/nouvelle-migration.mjs`, qui fait le `migrate diff` et ecrit le dossier, puis
`migrate:deploy` pour appliquer.

### Le telechargement de PostgreSQL par winget echoue en 403

`winget install PostgreSQL.PostgreSQL.17` echoue :
`Download request status is not success. 0x80190193 : Forbidden (403)`.
EnterpriseDB refuse le telechargement selon le `User-Agent` — ce n'est pas le reseau du
bureau (aucun proxy configure, et la meme URL repond 200 avec un `User-Agent` de
navigateur). Contournement : telecharger avec `curl.exe -A "<UA navigateur>"` puis lancer
l'installateur avec `--mode unattended`.
