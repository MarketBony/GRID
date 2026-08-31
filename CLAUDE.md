# CLAUDE.md — Relance Bony

## Ce qu'est ce projet

Outil web de pilotage des campagnes de relance téléphonique du Groupe Bony
(concessions Renault / Dacia / Alpine). Remplace un classeur Excel de 25 onglets.

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
| `DEPLOIEMENT.md` | Runbook VPS (à écrire en J7) |

Ne jamais dupliquer leur contenu ici.

`VIABILITE-FREEMIUM.md` est **périmé** : il conclut sur Supabase Auth + Cloudflare Pages,
abandonnés au profit du VPS existant. `schema.sql` et `seed_referentiels.sql` sont des
références historiques, remplacées par `backend/prisma/`.

## Stack

Parité structurelle avec GEARBOX (`C:\Users\Operateur\Documents\gearbox3backup`) : même
arborescence, même pipeline, même discipline documentaire.

- Front Vite + React + TypeScript, **à plat à la racine**, port 3000
- API Express + Prisma + JWT + socket.io, dans `backend/`, port 3001
- Le front n'appelle que des URL **relatives** (`/api/...`) : Vite proxifie en
  développement, Caddy sert les deux sous le même domaine en production
- PostgreSQL 17, schéma `relance`. **Local en développement, et sur le VPS en
  production** — dans le `docker-compose` du VPS, à côté de gearbox. Supabase a été écarté
  le 31/08/2026 sur décision de l'utilisateur : une dépendance externe de moins, et le
  blocage des ports 5432/6543 par le réseau du bureau n'a plus d'incidence. Contrepartie
  assumée : **les sauvegardes sont à notre charge**, donc au runbook de J7 de les décrire
  et de les prouver par une restauration
- Authentification JWT + bcrypt, comptes créés par un administrateur. Pas d'Entra ID
- Déploiement sur le VPS qui héberge gearbox : son Caddy gagne une ligne
  `import relance.caddy`. Son `docker-compose.yml` n'est pas modifié — Postgres et l'API
  de relance vivent dans un `docker-compose` **séparé**, pour qu'un redémarrage de relance
  ne touche jamais gearbox
- URL cible : `relance.bonyauto-mobile.com`

**Tout se développe en local d'abord.** La v1 ne part sur le VPS que quand les critères de
recette passent en local. Effet de bord utile : la boucle quotidienne ne sort pas du
poste, donc le blocage des ports 5432/6543 par le réseau du bureau ne gêne plus.

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

   Le seul appelant légitime est `DELETE /api/vendeurs/:id`. Les deux moitiés de la
   règle sont couvertes par `test:garde-fous` : le refus par défaut, ET l'ouverture
   sur demande.
2. **Aucun agrégat stocké en base.** Pas de colonne `total_rdv`, pas de compteur
   dénormalisé, pas de table de synthèse. Tout se calcule en lecture par vue ou
   requête. C'est la cause racine de la fragilité du fichier Excel : 677 références
   figées vers des totaux maintenus à la main.
3. **Aucune structure en dur dans le code.** Les 4 plaques, les 19 sites, les 5 jours,
   les 11 créneaux, les 3 marques sont des **données**. Toute constante trouvée en dur
   dans le code est un bug, même si elle est correcte aujourd'hui.
4. **L'autorisation est portée par le serveur, jamais par le front, et passe par un
   portail unique.** Ce portail est `backend/src/auth/campagneScope.ts` : **aucune route
   ne recopie une clause de périmètre.**

   *Reformulation du 28/08/2026.* La règle disait « RLS sur toutes les tables, sans
   exception ». Elle est incompatible avec la parité GEARBOX retenue : Prisma se connecte
   avec le rôle propriétaire des tables, qui contourne la RLS de toute façon — l'activer
   aurait donné une garantie imaginaire. L'exigence de fond est intacte, et même plus
   exigeante : sans RLS, le portail n'a **aucun filet**.
5. **Pas de mise en forme conditionnelle des droits côté client seul.** Cacher un
   bouton n'est pas une sécurité. Le résumé de droits envoyé au front sert à l'affichage ;
   chaque appel est revalidé côté serveur.
6. **Aucune liste de valeurs dupliquée sans contrôle automatique.** Les listes de rôles et
   de modes existent dans `auth/roles.ts` et en contraintes CHECK :
   `utils/verifierInvariants.ts` les compare **au démarrage du serveur** et refuse de
   démarrer si elles divergent. Une note « à synchroniser » ne synchronise rien.

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
2. **Vérification locale avant tout commit** — les deux serveurs lancés, et un vrai test
   dans le navigateur, pas seulement `tsc --noEmit`. Toute migration se joue en local
   d'abord, jamais directement en production.
3. **Si les tests locaux passent : mettre à jour les `.md` AVANT de pousser.**
   `ETAT-PROJET.md`, `ETAT-BACKEND.md` si le backend bouge, `BUGS-CONNUS.md` (cocher ce
   qui est corrigé, ajouter ce qui a été découvert). La doc fait partie du lot livré —
   jamais « je documenterai après », c'est trop tard : un déploiement non documenté fait
   repartir la session suivante sur de fausses bases.
4. Commit, puis **STOP avant le push** : montrer le diff et attendre un OK explicite.
5. Déploiement VPS ensuite, avec compte rendu de ce qui a réellement tourné.

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

# Comptes de test — un par périmètre, pour éprouver les vues et la saisie.
# Idempotent. Sans MOT_DE_PASSE, il en tire un au hasard et l'affiche une fois.
MOT_DE_PASSE="..." npm run comptes-test

# Les cinq suites de vérification. Aucune ne doit passer au rouge.
npm --prefix backend run test:garde-fous    # 33 invariants, chacun doit REFUSER
npm --prefix backend run test:import        # 19 tests du parseur, fonctions pures
npm --prefix backend run test:agregats      # 27 tests des totaux, contre les 1107 RDV de juin
npm --prefix backend run test:repartition   # 20 tests de la répartition graine 42
SEED_MOT_DE_PASSE="..." npm --prefix backend run test:api   # 43 routes, serveur allumé

# Serveurs
npm --prefix backend run dev   # API sur 3001
npm run dev                    # front sur 3000

# Typecheck
npx tsc --noEmit                        # front
cd backend && npx tsc --noEmit          # backend
npm --prefix backend run prisma:validate

# Dérive Prisma — doit répondre « This is an empty migration. »
cd backend && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

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
