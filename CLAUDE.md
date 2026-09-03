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
| `DEPLOIEMENT.md` | Runbook : Supabase + Cloudflare Pages |

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
- Déploiement du front sur **Cloudflare Pages**, relié au dépôt : build
  `npm run build`, sortie `dist`. HTTPS et nom de domaine fournis
- **Aucune ressource partagée avec gearbox.** Exigence textuelle de l'utilisateur :
  « Gearbox reste Gearbox ». Le VPS a été remis dans son état d'origine, il ne reste
  aucune trace de GRID dessus. `grid.bonyauto-mobile.com` n'existe pas en DNS et la
  zone Gandi n'est pas accessible : c'est ce qui a fermé la voie du VPS
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

**Le fond est vivant.** Le dégradé tamisé vit dans `body::before` et `body::after`, deux
couches animées à des périodes non multiples (38 s et 61 s) pour que la dérive ne se répète
pas à l'œil. Animées en `transform` et non en `background-position` : la transformation est
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
pas réutilisé. `RELANCE` est composé en Syncopate dans le dégradé (`.logotype`). Un
logotype dédié s'y substituerait sans autre changement.

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
3. **Aucune structure en dur dans le code.** Les 4 plaques, les 19 sites, les 5 jours,
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
- **Une plaque peut n'avoir aucune table.** NORD et SUD-OUEST sont dans ce cas en
  juin 2026. Le mode `par_site` doit être pleinement fonctionnel, pas un cas dégradé

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
6. Le front part tout seul : chaque push sur le dépôt déclenche Cloudflare Pages.

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

# Les six suites de vérification. Aucune ne doit passer au rouge.
npm --prefix backend run test:garde-fous    # 39 invariants, chacun doit REFUSER
npm --prefix backend run test:rls           # 89 contrôles des politiques ET des RPC
npm --prefix backend run test:invariants    # 10 contrôles code <-> base (interdit n.6)
npm --prefix backend run test:import        # 19 tests du parseur, fonctions pures
npm --prefix backend run test:agregats      # 27 tests des totaux, contre les 1107 RDV de juin
npm --prefix backend run test:repartition   # 20 tests de la répartition graine 42

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
`test:garde-fous` : les fixtures sont **créées**, jamais **choisies** en base. Ce qui
doit être éprouvé, c'est la contrainte, pas l'état de la base ce jour-là.

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
