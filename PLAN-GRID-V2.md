# GRID v2 — plan d'attaque

*Rédigé le 02/10/2026. Révisé le même soir avec les réponses de l'utilisateur.*

Ce document est le plan de travail de la v2. Il ne remplace ni `ETAT-PROJET.md` ni
`BUGS-CONNUS.md` : ce qui est livré y sera consigné lot par lot, comme d'habitude.

On avance lot par lot. **La fin, c'est l'utilisateur qui la décide** : ce plan fixe un
ordre et des critères de passage, pas des dates.

---

## 0. Cadre

### Objectif

1. Une application qui **tient** une séance de phoning complète sur le palier gratuit
   de Supabase.
2. Une interface refaite dans la **DA Gearbox, en liquid glass**, clair et sombre,
   responsive, installable (PWA), et **animée partout**.
3. La **gestion des effectifs** sur toutes les sessions, par table comme par site.
4. Une **gestion des comptes** propre, avec des réglages par palier.
5. Une **prise de RDV** repensée.
6. Une nouvelle rubrique **Suivi des RDV**.

### Contraintes, rappelées parce qu'elles décident de tout

- **Pas de Supabase Pro**, sauf cas de force majeure. Tout le gain vient du code.
- **Les interdits de `CLAUDE.md` restent absolus** :
  - aucun `DELETE` hors de la porte de purge ;
  - aucun agrégat stocké ;
  - aucune structure en dur ;
  - la RLS est la seule barrière ;
  - toute liste dupliquée est sous contrôle automatique.
- **Juin et septembre ne bougent pas d'un poil.** Toute migration est vérifiée par une
  empreinte avant/après des campagnes 1 et 2.
- **Le front de développement attaque la production.** Une migration part donc en
  production avant tout test au navigateur, et elle doit rester compatible avec le
  front en ligne.

### Trois principes de livraison

1. **Migrations ADDITIVES uniquement.** On ajoute des tables, des colonnes (nullables ou
   avec une valeur par défaut) et des fonctions. On ne renomme rien et on ne supprime
   rien.
   - Conséquence : l'ancien front fonctionne sur la nouvelle base.
   - Si la v2 déraille, on revient en arrière par `wrangler rollback`, sans toucher à
     la base.
2. **La robustesse part seule, et la première.** Le lot 1 est fusionné et mis en ligne
   sur l'interface actuelle dès qu'il est validé, sans attendre le reste.
3. **Chaque lot a sa porte de passage.** Un lot qui n'est pas vert ne part pas, et il
   ne bloque pas les autres.

---

## 1. Décisions prises

| # | Décision |
|---|---|
| D1 | **On reprend la DA Gearbox, pas l'OS ni son moteur.** On prend les jetons, les primitives, l'en-tête sur une ligne, les volets, les sélecteurs et le mouvement. On ne prend ni les fenêtres, ni le dock, ni `ui2/os/engine`. C'est une copie dans GRID, pas un partage : « Gearbox reste Gearbox » |
| D2 | **Liquid glass uniquement**, en thème clair ET sombre. Pas de variante pixel, pas de variante opaque |
| D3 | **Réglages par palier, à la Gearbox** : une rubrique Réglages dont les sections dépendent du palier |
| D4 | **On reste en React 19 + TypeScript + Vite.** React pèse ~60 Ko. Le bundle de 1,4 Mo vient de l'export Excel et des graphiques chargés d'office ; le découpage du code règle ça (lot 4) |
| D5 | **Les RDV de trafic naturel (« Showroom ») se saisissent dans GRID, depuis le Suivi des RDV.** Ils ne comptent **pas** dans les classements du phoning. Jour ET créneau obligatoires, comme un RDV de phoning |
| D6 | **CS = contrat de service** |
| D7 | **Octobre sert de bac à sable au test de charge**, à condition d'être rendu vide. Juin et septembre sont intouchables |
| D8 | **Commande « sèche » = commande sans aucun avantage** : ni DIAC, ni CS, ni STOCK. Une commande STOCK n'est pas sèche. **Elle se DÉDUIT, elle ne se coche pas** : c'est une commande sans aucune des trois puces. Saisie par boutons, jamais par liste déroulante |
| D9 | **Suivi : un seul champ en plus, le modèle de véhicule** |
| D10 | **Le suivi se ferme avec la campagne.** Une campagne clôturée fige la saisie ET le suivi. ⇒ **On ne clôture une campagne qu'une fois son suivi terminé.** Le dire dans la confirmation de clôture |
| D11 | **Un vendeur non mobilisé disparaît de la grille de saisie**, comme la réserve d'une table |
| D12 | **L'onglet « Tables » devient « Effectifs »** : c'est la gestion des vendeurs présents à chaque session, en mode table comme en mode site |
| D13 | **Prise de RDV : les sept premières améliorations** de la liste du lot 5.1 |
| D14 | **Après une réinitialisation, l'utilisateur choisit son mot de passe** à la connexion suivante |
| D15 | **Mode salle** : seulement s'il est solide. Le tableau de bord fait déjà bien le travail |
| D16 | **Des animations partout** (§ 2) |
| D17 | **La navigation se décide sur maquettes**, pas sur description (lot 4.1) |
| D18 | **Navigation retenue : l'Île (A) sur ordinateur, la barre flottante du bas (B) sur téléphone.** Les défauts de la maquette sont corrigés à l'écriture en React : l'indicateur doit suivre l'item actif PENDANT la rétractation, et non 380 ms après |
| D19 | **La rubrique Vendeurs reste** (préparation) : la base des vendeurs et des responsables. Son absence de la maquette était un oubli |
| D20 | **Une seule grille par vendeur, toutes marques confondues.** La marque se choisit au moment de poser le RDV. Pour un vendeur mono-marque, il n'y a rien à choisir ; pour un vendeur bi-marque, la dernière marque utilisée est proposée par défaut et une touche la change. **Le modèle ne bouge pas** (`rdv.marque_id`, R-C.1 et ses triggers) : c'est un changement d'interface. La grille affiche la marque de chaque RDV par une pastille, et les compteurs par marque restent visibles. Le planning imprimable suit le même principe |
| D21 | **DIAC / STOCK / CS : pas de grosses puces.** Il faut une commande compacte, intégrée à la ligne, discrète au repos |
| D22 | **Recherche : une icône loupe** dans l'Île. Le raccourci `Ctrl K` reste disponible, sans être affiché |

---

## 2. Les animations : une exigence, pas une finition

Elles font partie de la DA. Elles ne seront donc pas « ajoutées à la fin ».

### Règles techniques (apprises à la dure, voir `CLAUDE.md`)

- **Seulement `transform` et `opacity`**, composées par le GPU. Aucun JavaScript par
  image.
- Les ressorts sont **calculés** et figés en `linear()` (`--ressort-ample`, `-vif`,
  `-doux`). On n'en ajoute un que s'il porte un caractère nouveau.
- **Une transformation animée est posée en dur sur l'élément**, jamais par une variable
  CSS non enregistrée : elle ne s'interpolerait pas (piège mesuré le 04/09).
- Une sélection **se déplace**, elle ne réapparaît pas ailleurs : un seul élément mobile
  par groupe, via `useIndicateurGlissant`.
- `prefers-reduced-motion` est respecté partout, plus une bascule « animations
  réduites » dans les Réglages.
- La mesure se fait par `getAnimations()`, jamais par `getComputedStyle()`. **La fluidité
  se juge dans une vraie fenêtre**, pas dans le volet navigateur de l'agent.

### Catalogue

| Où | Animation |
|---|---|
| Navigation | Sélection qui **glisse et se déforme** en ressort · barre qui se rétracte au défilement · passage d'une rubrique à l'autre par **transition à élément partagé** (View Transitions API) |
| Thème | Bascule clair/sombre en **disque qui s'étend** depuis le bouton |
| Verre | **Reflet spéculaire qui suit le pointeur** sur les surfaces actives · liseré qui s'allume au survol · fond vivant à trois couches, conservé |
| Volets et menus | Volets qui **montent en ressort** · menus qui **naissent de leur bouton** (origine de la transformation) · palette de commandes qui s'ouvre en zoom |
| Listes | Entrées **échelonnées** au chargement · **réordonnancement glissé** (FLIP) quand un classement ou un compteur change d'ordre |
| Chiffres | Compteurs et indicateurs qui **roulent** jusqu'à leur nouvelle valeur |
| Saisie | Une case qui reçoit un RDV **se pose** (léger rebond, lueur Bony) · RDV en attente d'envoi qui **pulse** doucement · curseur de case qui glisse · **célébration discrète aux paliers** d'un vendeur (10e, 20e RDV) |
| Suivi | Choisir une issue fait **glisser** le RDV vers son groupe · les puces DIAC / STOCK / CS **s'allument en ressort** · l'étiquette « sèche » apparaît ou disparaît en fondu |
| Graphiques | Barres qui **poussent** · donut qui **se dessine** · transition animée quand un filtre change |
| Chargement | Squelettes à reflet au lieu d'écrans vides |
| Mode salle (D15) | Classement en direct qui se réordonne en glissant · compteurs qui roulent · mise en avant du dernier RDV posé |

---

## 3. Les lots, dans l'ordre

### Lot 0 — Mesure de départ *(agent en arrière-plan, en cours)*

- **L'outil** : il exécute le **vrai code du front** (bundle esbuild, un poste virtuel par
  `worker_thread` avec connexion, chargement initial, temps réel et saisie). Il vit dans
  `scripts/charge/`.
- **Paliers** :
  1. 10 postes ;
  2. 25 postes à 258 RDV/h, le rythme de septembre ;
  3. 25 postes à ~500 RDV/h ;
  4. 40 postes, si les précédents tiennent.
- **Un test dédié** : 30 connexions simultanées depuis la même IP.
- **Écritures** : uniquement sur des vendeurs fictifs `CHARGE`, dans Octobre. À la fin,
  ils sont purgés par `vendeur_purger`, les comptes `.test` sont redésactivés, et des
  empreintes prouvent que juin et septembre n'ont pas bougé.
- **Livrable** : `scripts/charge/RAPPORT-BASELINE.md`. Le même outil sera rejoué après le
  lot 1, puis à la recette.

> **Tant que le test tourne, ne pas composer les tables d'octobre** : l'agent compare
> l'empreinte d'octobre avant et après.

### Lot 1 — Robustesse *(part seul, sur l'interface actuelle)*

**Constat de l'audit.** La base est saine au repos : 40 ms pour le périmètre, contre
873 ms pendant la panne. C'est le **volume de requêtes** qui fera tomber l'instance. Il
est estimé à ~20 000 requêtes/h ; la cible est **moins de 1 500**.

| # | Changement | Gain attendu |
|---|---|---|
| 1.1 | **La vue d'ensemble se met à jour en mémoire** à partir du message temps réel, dont la charge utile porte déjà tous les champs de `rdv_agrege`. On ne recharge plus rien sur un événement | −17 000 req/h |
| 1.2 | **Une resynchronisation de sécurité** toutes les ~5 min, avec un décalage aléatoire par poste. Une reconnexion du canal déclenche aussi une resynchronisation | filet de sécurité |
| 1.3 | **Plus de rechargement après sa propre écriture** : le RDV est appliqué en mémoire | −1 800 req/h |
| 1.4 | **Poser un RDV = 1 requête** au lieu de 3, archiver = 1 au lieu de 4 | −600 req/h, saisie plus vive |
| 1.5 | **Une fonction serveur par écran** : `charger_saisie(campagne)` et `charger_tableau(campagne)`, en `security invoker` pour que la RLS s'applique pleinement | 18 requêtes → 2 au chargement |
| 1.6 | **Politique `rdv_lecture` réécrite** : une sous-requête non corrélée, évaluée une fois, au lieu d'un `EXISTS` sur la vue à chaque ligne | 117 ms → ~15 ms pour un chef de table |
| 1.7 | **Plus de rechargement complet sur échec d'écriture** | supprime une boucle qui aggravait la saturation |
| 1.8 | **File d'attente locale des écritures.** Un RDV tapé ne se perd jamais : il s'affiche « en attente » et repart avec un délai croissant. Une clé d'idempotence (`rdv.cle_client uuid unique`, nullable) empêche les doublons | zéro RDV perdu |
| 1.9 | **Témoin de santé** dans l'en-tête : latence récente, temps réel connecté ou non, écritures en attente | diagnostic pendant la séance |
| 1.10 | **Émettre enfin `tables:modifiees`**, écouté par trois écrans et jamais émis : trigger de diffusion sur `affectation` et `table_phoning` | une table recomposée se propage |
| 1.11 | **Les droits ne sont plus rechargés à chaque renouvellement de jeton** | moins de bruit |
| 1.12 | **Fiche réflexe de séance** dans `DEPLOIEMENT.md` : reconnaître une saturation, quoi regarder, quoi faire | humain |

**Porte de passage.** Le lot part quand trois conditions sont réunies :
- le test de charge rejoué tient 25 postes à 500 RDV/h sans erreur ;
- les six suites sont vertes sur les deux bases ;
- `comparer` montre que les deux bases sont identiques.

### Lot 2 — Modèle de données

Toutes ces migrations sont additives. Chacune active la RLS **et** écrit ses politiques
dans la même migration, avec ses cas `test:rls` dans les deux sens et ses garde-fous
`test:garde-fous`.

| # | Objet | Contenu |
|---|---|---|
| 2.1 | `rdv.source` | Deux valeurs : `relance` (défaut) ou `showroom`. La liste est contrôlée par `test:invariants`, et `rdv_agrege` l'expose. **`agregats.ts` filtre `relance` pour tout ce qui relève du phoning.** `test:agregats` reste à 35/35 sur juin et gagne un cas Showroom |
| 2.2 | `rdv.cle_client` | Idempotence de la file d'attente (1.8) |
| 2.3 | `rdv_suivi` (une ligne par RDV) | `issue` : `commande`, `offre_en_cours`, `annule` ou `clos_sans_suite` ; **pas de ligne = à traiter** · `diac`, `stock`, `cs` (booléens, permis seulement pour une commande) · `modele` (D9) · `commentaire` · `maj_le`, `maj_par`. **« Sèche » n'est pas stocké** : c'est une commande sans aucune des trois puces (D8). Mêmes règles que `rdv` : périmètre de saisie, campagne ouverte (D10). Aucun agrégat stocké |
| 2.4 | `mobilisation(campagne_id, vendeur_id, mobilise, motif)` | Une ligne par **exception**. En mode par site, tout vendeur présent est mobilisé sauf ligne contraire. En mode par table, la règle actuelle reste : la réserve n'est pas mobilisée, sauf si elle a des RDV (« ACCEPTÉ » dans `BUGS-CONNUS.md`). `mobilisation()` dans `agregats.ts` reste la source unique. Un vendeur non mobilisé sort de la grille de saisie (D11) |
| 2.5 | `utilisateur.doit_changer_mdp` | Posé au moment d'une réinitialisation, retiré quand l'utilisateur a choisi son mot de passe (D14) |
| 2.6 | `journal_compte` | Qui a réinitialisé, désactivé ou changé le palier de qui, et quand. Alimenté par des fonctions `security definer`, lisible par les admins. Aujourd'hui, le journal d'audit de Supabase est vide en base : impossible de savoir qui a réinitialisé quoi |
| 2.7 | Fonctions serveur | `charger_saisie`, `charger_tableau` (1.5) · `rdv_poser` (un aller-retour, idempotent) · `charger_suivi` · `compte_reinitialise` (2.5 + 2.6) |
| 2.8 | Trigger de diffusion des tables | 1.10 |

**Pour chaque migration, la même séquence :**
1. jouée en local, les suites passent ;
2. puis sur Supabase ;
3. `comparer` ;
4. les suites **rejouées sur Supabase** ;
5. empreintes de juin et septembre identiques avant et après.

### Lot 3 — Système visuel : DA Gearbox en liquid glass

- **Sources** : `gearbox3backup/maquettes/v2/css/ui.css`, `os.css`, `da.css` et
  `ui2/os/maquette.css`.
- **Ce qu'on reprend** :
  - les jetons : `--surface-1..4`, `--line`, `--text-2/3`, `--accent`,
    `--ok/warn/danger/info`, `--r-*`, `--t-*` ;
  - les primitives : `.btn`, `.seg`, `.chip`, `.field`, `.badge`, `.card`, `.kpi`,
    `.list-row`, `.tbl`, `.app-head`, `.sheet` ;
  - les sélecteurs (`pick`, `dateRange`), **réécrits en React** dans `components/ui/`.
- **Ce qu'on garde de GRID**, parce que c'est mesuré :
  - le fond vivant à trois couches ;
  - les ressorts calculés ;
  - `useIndicateurGlissant` ;
  - les règles de la section « couche visuelle » de `CLAUDE.md` : portails, spécificité,
    `overflow-x: clip`, SVG plutôt que glyphes, transformations posées en dur.
- **Lisibilité** : on applique les règles v2.1 de Gearbox :
  - texte courant ≥ 13,5 px ;
  - cartes nettement détachées du fond ;
  - couleurs de fond porteuses de sens (issues du suivi, marques) ;
  - vérification dans les deux thèmes.
- **`index.css`** (4 726 lignes) est remplacé par une feuille en couches : jetons, base,
  primitives, écrans. Chaque valeur n'est déclarée qu'une fois.
- **`atelier.html`** est mis à jour. C'est là qu'on règle la DA, hors du build.

### Lot 4 — Coquille : navigation, réglages, responsive, PWA

#### 4.1 Navigation : à trancher sur maquettes animées (D17)

On construit **trois maquettes manipulables**, avec leurs animations, dans des pages de
mise au point à la racine (servies en dev, exclues du build). Chacune est vue au bureau
et au téléphone, en clair et en sombre.

| | A — « Île » | B — Rail + barre flottante | C — Accueil et espaces |
|---|---|---|---|
| Bureau | Barre de verre **flottante** en haut, dont la pastille active glisse et se déforme. Elle se rétracte au défilement | **Rail de verre** à gauche, repliable en icônes, sélection glissante. Chaque rubrique a son en-tête sur une ligne | **Accueil en tuiles vivantes**. Une tuile s'ouvre en plein écran par transition à élément partagé |
| Téléphone | La même île, en bas | **Barre d'onglets flottante** en bas, qui se rétracte au défilement | Les mêmes tuiles, en pile |
| Pour | Très moderne, peu d'emprise | Pratique au quotidien : la saisie garde sa hauteur, les sous-rubriques ont leur place | Le plus spectaculaire |
| Contre | Peu de place pour les sous-rubriques | Principe plus classique, rendu moderne par le verre et le mouvement | Un clic de plus pour tout |

**Commun aux trois** :
- **palette de commandes** (`Ctrl K`) ;
- **mode séance** : la saisie passe en plein écran et la coquille s'efface ;
- transitions entre rubriques.

#### 4.2 Les rubriques et qui les voit

| Rubrique | Palier |
|---|---|
| **Saisie** | tous sauf `lecteur` |
| **Suivi des RDV** (nouvelle) | tous sauf `lecteur` |
| **Tableau de bord** | tous |
| **Préparation** : Campagnes · **Effectifs** (ex-Tables, D12) · Vendeurs | `admin`, `direction` |
| **Réglages** | tous, mais les sections dépendent du palier ↓ |

#### 4.3 Réglages par palier

| Section | Contenu | Palier |
|---|---|---|
| Mon compte | Nom, identifiant, **changer mon mot de passe**, dernière connexion | tous |
| Apparence | Thème clair, sombre ou système · animations réduites | tous |
| Application | Installer GRID (PWA), version, état du service | tous |
| Comptes | Gestion des comptes (lot 7) | `admin` |
| Référentiels | Plaques, sites, marques | `admin`, `direction` |
| Journal | Journal des comptes (2.6) | `admin` |

**Filtrer les sections ne fait que de l'affichage.** Chaque action est revalidée par la
base (interdit n°5).

#### 4.4 Responsive

- **Cibles** : 360 px (téléphone), 768 px (tablette, F-C.9), bureau, et grand écran.
- **Principes repris de Gearbox** :
  - requêtes de **conteneur** plutôt que de média ;
  - pile liste → détail en largeur étroite ;
  - tableaux à défilement horizontal, ou colonnes secondaires masquées.
- **Le cas phare sur téléphone** : le suivi des RDV, quand un encadrant qualifie un RDV
  depuis le showroom.

#### 4.5 PWA et poids

- **Installation** :
  - un `manifest.webmanifest` ;
  - des icônes tirées de `public/grid.svg` : SVG, PNG 192/512, `maskable` et
    `apple-touch-icon` ;
  - un écran de démarrage aux couleurs Bony.
- **Service worker écrit à la main**, sans dépendance :
  - la coquille de l'application est mise en cache, et **jamais Supabase** : aucune
    donnée n'est en cache ;
  - une nouvelle version s'annonce, **sans jamais recharger de force pendant une
    saisie** ;
  - **un `wrangler rollback` doit atteindre les postes**. C'est vérifié explicitement.
- **Découpage du code** : l'export Excel et les graphiques se chargent à la demande.
  Cible : moins de 400 Ko au premier chargement, contre 1,4 Mo aujourd'hui.
- La règle « `dist` doit contenir 4 fichiers » de `CLAUDE.md` est remplacée par la liste
  exacte attendue.

### Lot 5 — Les écrans

#### 5.1 Saisie : la prise de RDV repensée

Le **geste clavier ne change pas** : `Entrée`, `Échap`, flèches, `Tab`. Les sept
améliorations retenues (D13) :

1. **Une grille aérée**, dans la DA :
   - case du jour courant surlignée ;
   - marques en étiquettes pleines ;
   - l'état de chaque case se lit d'un coup d'œil : libre, prise, en attente d'envoi,
     deux RDV.
2. **Saisie express** : un champ « Nom du client ⏎ » qui pose le RDV dans la prochaine
   case libre, ou dans la case choisie. Le curseur avance tout seul.
3. **Annuler la dernière saisie** (`Ctrl Z`) pendant quelques secondes. C'est un
   archivage en dessous (interdit n°1).
4. **Changer de vendeur au clavier** (`Alt ↑/↓`), avec la liste qui suit en glissant.
5. **Alerte de doublon** quand le même nom de client est déjà posé dans la campagne.
   C'est un avertissement, jamais un refus.
6. **Vue « table »** : tous les vendeurs pour un jour, en carte de chaleur, pour voir
   les trous.
7. **Compteurs et classement de la table animés** quand un rang change.

#### 5.2 Tableau de bord

- Le contenu actuel est conservé, redessiné : totaux, classements, par jour, filtres
  plaque/site, comparaison, export.
- **Le classement exclut le Showroom**, et l'étiquette le dit.
- **Mode salle** : seulement si le résultat est solide (D15). Il ne coûte aucune requête
  de plus grâce à 1.1.

#### 5.3 Préparation

- **Campagnes** : création, jours et créneaux, mode par plaque, clôture. La confirmation
  de clôture dit qu'elle **fige aussi le suivi** (D10). F-A4.4 (dupliquer une campagne
  avec ses tables) reste hors du périmètre de la v2.
- **Effectifs** (ex-Tables, D12) : **qui est présent à quelle session**.
  - En mode par table : le constructeur actuel, avec l'effectif cible et son écart.
  - En mode par site : cocher ou décocher qui participe, avec un motif facultatif.
  - Un seul écran pour les deux modes ; la réserve et les non-mobilisés sont visibles.
- **Vendeurs** : on passe de 8 990 px de hauteur à une liste filtrable, avec une fiche
  vendeur en volet.

### Lot 6 — Suivi des RDV

Fondation : `SUIVI_RDV_PHONING_BONY_3.xlsx`. On en garde le **contenu**, pas la forme.

- **Qui** : les personnes qui saisissent les RDV de leurs vendeurs, sur le même
  périmètre (`perimetre_saisie`).
- **Liste de travail** :
  - « À traiter » d'abord, groupé par jour puis par vendeur ;
  - chaque ligne : client, modèle, vendeur, jour, créneau, marque, source, issue ;
  - filtres : issue, vendeur, site, jour, source ; recherche par client.
- **Qualifier un RDV en deux gestes** :
  - l'issue se choisit dans un contrôle segmenté coloré : Commande, Offre en cours,
    Annulé, Clos sans suite ;
  - pour une commande, trois **boutons-puces** : DIAC, STOCK, CS. **« Sèche » s'affiche
    seule** quand aucune n'est allumée ;
  - modèle et commentaire facultatifs ;
  - enregistrement immédiat, file d'attente comprise.
- **« + Trafic naturel »** : vendeur, jour, créneau, marque, client et modèle. Le RDV
  porte une étiquette Showroom et reste hors des classements du phoning.
- **Indicateurs**, calculés à la lecture par une **fonction pure testée**
  (`backend/src/utils/suivi.ts`, servie au navigateur comme `agregats.ts`) :
  - planifiés, traités, à traiter, commandes, offres, annulés, clos sans suite ;
  - **taux de transformation = commandes ÷ traités** ;
  - ventilation par source, issue, composition de commande, site et vendeur ;
  - classement des vendeurs aux commandes ;
  - départage des ex æquo documenté et déterministe, **jamais** l'astuce
    `(20 − n)/10000` du fichier.
- **Nouvelle suite `test:suivi`**, rejouée en mémoire contre les chiffres du fichier :
  342 planifiés, 236 traités, 119 commandes, 47 offres, 33 annulés, 37 clos, 50,4 %.
- **Ce qui est corrigé au passage** :
  - le fichier compte comme commande toute valeur inconnue ; ici, l'issue est un choix
    explicite ;
  - DIAC, STOCK et CS se recouvrent, et le fichier les additionne comme des catégories
    distinctes ; ici, la ventilation le dit.
- **Export Excel** du suivi.

### Lot 7 — Comptes

**Correctifs urgents, à livrer avec le lot 1** :

1. **Des messages de connexion honnêtes** : mauvais identifiants, trop de tentatives
   (429, avec le délai à attendre), service indisponible ou trop lent, réseau absent.
   Aujourd'hui, tout s'affiche comme « mot de passe incorrect » (`services/api.ts:166`).
2. **Réinitialiser un mot de passe demande une confirmation**, dans un volet qui nomme la
   personne.
3. Chaque réinitialisation est inscrite au **journal** (2.6).

**La nouvelle gestion** (Réglages → Comptes, réservée à `admin`) :

- une **liste filtrable** : palier, actif, relié à Supabase ou non ;
- une **fiche en volet** : identité, palier, sites encadrés, tables animées, dernière
  connexion, journal ;
- les **actions** : créer, changer de palier, réinitialiser, désactiver, supprimer
  (porte existante) ;
- **côté utilisateur** : changer son mot de passe soi-même, et choisir le sien après une
  réinitialisation (D14).

**Contrainte technique.** Modifier l'Edge Function `gerer-comptes` demande un
déploiement par la CLI, avec un jeton `sbp_` qui n'est pas stocké sur le poste. **Le
plan l'évite** : tout passe par l'interface et des fonctions SQL.

### Lot 8 — Recette et mise en ligne *(à chaque livraison)*

- **Contrôles automatiques** :
  - les six suites, plus `test:suivi`, **sur les deux bases** ;
  - `comparer` ;
  - dérive Prisma vide ;
  - `tsc` sur le front et le backend ;
  - test de charge, même outil, mêmes paliers.
- **Essai au navigateur, écran par écran** : dans les deux thèmes, à 360, 768 et
  1600 px, et en mode installé. Les défauts de cascade CSS ne se voient qu'au
  navigateur.
- **Version de prévisualisation** : `wrangler versions upload` donne une URL d'essai,
  qui permet de tester sur téléphone avant de toucher `master`.
- **Documentation mise à jour avant le push** :
  - `ETAT-PROJET`, `ETAT-BACKEND`, `BUGS-CONNUS` ;
  - `CLAUDE.md` : DA, contenu de `dist`, navigation, renommage Effectifs ;
  - `CAHIER-DES-CHARGES` : l'issue du RDV et le hors-ligne partiel sortent du
    « hors périmètre v1 » ;
  - `DEPLOIEMENT` : la fiche réflexe.
- **Mise en ligne** :
  1. `git fetch`, puis fusion ;
  2. **STOP avant le push**, pour l'accord de l'utilisateur ;
  3. vérification du **déploiement**, pas seulement du build.

---

## 4. Ce qui appartient à l'utilisateur

| # | Geste |
|---|---|
| U1 | Choisir la navigation sur les maquettes (lot 4.1) |
| U2 | **Composer les tables d'octobre** (CENTRE, SUD), une fois le test de charge terminé |
| U3 | Supabase → Authentication → **Rate Limits** : relever la limite de connexion par IP. Tout le bureau sort par la même adresse |
| U4 | Supabase → Authentication → **Leaked Password Protection** (en attente depuis le 04/09) |
| U5 | Donner le nombre de postes connectés pendant une séance, pour caler le test de charge |
| U6 | Donner un accord explicite avant chaque push sur `master` |

---

## 5. Risques, et leurs parades

| Risque | Parade |
|---|---|
| Nouvelle interface juste avant une séance : 25 personnes à réorienter | Le geste clavier de la saisie ne change pas · mode séance · `wrangler rollback` prêt, et la base reste compatible avec l'ancien front |
| Un service worker qui fige une version cassée sur les postes | Mise à jour au chargement, testée avec un vrai retour en arrière sur la prévisualisation |
| Une politique RLS oubliée sur une nouvelle table, donc une fuite silencieuse | RLS et politique dans la même migration · `test:rls` dans les deux sens pour `rdv_suivi`, `mobilisation`, `journal_compte` |
| Des indicateurs du suivi faux, sans que rien ne le signale | Fonction pure + `test:suivi` contre les chiffres du fichier |
| Le filtre « relance » oublié quelque part, donc un classement gonflé par le Showroom | Filtre posé dans `agregats.ts`, la source unique, et un cas Showroom dans `test:agregats` |
| Une campagne clôturée trop tôt fige le suivi (D10) | La confirmation de clôture le dit, avec le nombre de RDV encore « à traiter » |
| Des animations qui coûtent pendant la saisie | Composition GPU seulement · aucun JavaScript par image · animations réduites disponibles · fluidité jugée dans une vraie fenêtre |
| Le test de charge laisse des traces dans Octobre | Vendeurs fictifs purgés, empreintes avant/après, rapport |
| La limite de débit d'Auth sature quand tout le monde se connecte | Messages honnêtes (lot 7) · réglage U3 · aucune reconnexion forcée |
| Les ports 5432/6543 bloqués au bureau | Mesurer avant de conclure · partage de connexion 4G en secours |
