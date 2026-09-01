# ETAT-PROJET — memoire de reference

**Le produit s'appelle GRID** depuis le 31/08/2026. Depot :
`https://github.com/MarketBony/GRID` (prive). Ce qui garde volontairement le nom
« relance » — le schema PostgreSQL, le prefixe des messages de trigger, le vocabulaire
metier — est liste dans CLAUDE.md.

Mise a jour : 01/09/2026, apres l'autonomie de `test:rls`.

Ce fichier est la memoire globale du projet : ce qui est fait, ce qui reste, et les
decisions prises. Pour la methode de travail, lire `CLAUDE.md`. Pour l'etat detaille de
l'API, `ETAT-BACKEND.md`. Pour les defauts connus, `BUGS-CONNUS.md`.

---

## Ou en est le projet

**J1 et J2 termines.** Socle local operationnel de bout en bout, plus les deux ecrans
d'administration qui debloquent les donnees manquantes. Verifie dans le navigateur, pas
seulement compile.

Aucun commit git pour l'instant : le depot est initialise sur `master`, l'arbre est propre
a committer mais le commit initial n'a pas ete fait.

**Rien a pousser sur GitHub avant J7.** Le pipeline GEARBOX est ecrit pour un projet en
production, ou pousser signifie livrer. Ici seuls les commits locaux ont une utilite
immediate : des points de retour. Le depot GitHub devient necessaire en J7, pour la deploy
key du VPS et les workflows de sauvegarde.

## 01/09/2026 — Les vendeurs sortis, et ce que le correctif a fait remonter

Signale par l'utilisateur : des vendeurs sortis en aout apparaissaient dans la session
de septembre. La vue `perimetre_saisie` les excluait bien ; c'est l'ecran des TABLES
qui ne filtrait que `archive_le`. Corrige a trois niveaux — affichage, trigger
d'ecriture, et la ligne restee en base. Verifie a l'ecran : les trois disparaissent de
septembre, et LAROCHE reste en juin ou il a travaille.

**Le correctif en a revele un plus grave.** Deux vendeurs avaient une `date_entree`
egale a leur `date_sortie` alors qu'ils avaient 13 et 16 RDV en juin : le tableau de
bord de juin affichait **1078 au lieu de 1107**, sans erreur ni avertissement. La
donnee brute etait intacte, seule la lecture mentait. Nouveau trigger
`vendeur_dates_contre_rdv`, dates fautives retirees, juin revenu a 1107.

`test:garde-fous` passe de 33 a **39 controles** et ses fixtures sont desormais
fabriquees dans la transaction, jamais choisies en base — trois controles viraient au
rouge sur Supabase parce que la base y est reellement utilisee.

**`test:rls` EST DESORMAIS AUTONOME.** Elle empruntait des comptes et des donnees
reels — « la premiere table de juin », « `sbesson` n'a aucun encadrement » — et deux
changements legitimes faits depuis l'interface l'avaient fait tomber a 82/87, sans
qu'aucun des cinq echecs ne dise quoi que ce soit sur la RLS. Pire, archiver les
comptes `.test` la desarmait ENTIEREMENT : 0 controle execute.

Elle fabrique maintenant son propre monde dans la transaction de chaque controle —
plaque, sites, vendeurs, deux campagnes, une table, cinq comptes — et n'observe que
lui. **87/87 sur Supabase avec les cinq comptes `.test` desactives** : ils ont donc
pu etre archives, comme demande.

Detail du decor et des deux defauts trouves au passage dans `BUGS-CONNUS.md`.

---

## 01/09/2026 — Mise en service : comptes de test retires, premier compte nominatif

**Les 5 comptes `.test` sont desactives** et leurs 2 encadrements de site liberes, par
le meme chemin que l'ecran Comptes (`modifierCompte` retire de tout encadrement en
desactivant : un encadrant fantome dans un selecteur est pire qu'une case vide). Ils
restent visibles sous « Afficher les comptes desactives », et supprimables
definitivement.

**Compte `tlabonne` cree** — THEO LABONNE, palier `admin` (id 92). Connexion eprouvee,
et palier relu EN BASE et non deduit de ce qui a ete demande :
`peut_administrer` et `peut_gerer_utilisateurs` rendent `true`.

Le mot de passe demande, `17061969`, a ete **refuse par l'Edge Function** : 8
caracteres pour un plancher a 12. Un compte a donc ete cree avec un mot de passe
genere. Le plancher est un choix, pas une fatalite — mais 8 chiffres formant une date
de naissance est la premiere chose qu'on essaie sur une application accessible depuis
Internet et qui porte des noms de clients.

### Trois defauts corriges au passage, dont deux non demandes

**La campagne courante se reinitialisait a chaque changement d'onglet** (signale).
`App` demonte l'ecran quitte ; chaque ecran portait son `campagneId` en local. Pire
que l'agacement : deux ecrans pouvaient afficher deux campagnes differentes en meme
temps. Un `CampagneContext` partage la porte desormais, avec survie au rechargement.

**L'etiquette « vendeur » s'affichait sur tous les comptes.** PostgREST rend un
TABLEAU pour un embed enfant, jamais `null`, et `[]` est vrai en JavaScript. La
declaration TypeScript disait `| null` et le compilateur validait — le piege exact que
`CLAUDE.md` decrit.

**La suppression definitive d'un compte etait invisible** tant que le compte etait
actif. Le bouton est desormais toujours rendu, desactive avec une infobulle qui dit la
marche a suivre. Aucune protection n'a ete relachee.

---

## 01/09/2026 — Les 1107 RDV de juin sont en base, et ils ont revele un defaut grave

Sur demande de l'utilisateur, les 1107 RDV du classeur de juin sont charges dans la
campagne Juin 2026. Motif : le tableau de bord de septembre porte un selecteur
« Comparer a… » pointant sur juin ; avec une campagne vide il comparait a ZERO, donc
chaque vendeur apparaissait en progression infinie — pire qu'une absence de
comparaison.

Cela revient sur une decision ecrite (`rdv-juin-source.ts` disait « aucune de ces
lignes n'entre en base »). Elle etait juste tant que juin ne servait qu'a demontrer
les agregats en memoire ; elle ne l'est plus.

**Contrepartie a connaitre :** le champ `client` porte de VRAIS NOMS DE CLIENTS. Ils
sont desormais dans une base hebergee ET dans les dumps hebdomadaires commites par
`backup.yml`. Le depot doit rester prive, et c'est vrai pour une raison de plus.

### Le critere de recette n.4 est tenu sur la vraie base

`test:agregats` le demontrait en memoire, sur des fonctions pures. Le script d'import
le rejoue sur la base : il relit les 1107 RDV **par la vue `rdv_agrege`** — le chemin
du tableau de bord — et les recoupe avec les series du classeur.

| Controle | Resultat |
|---|---|
| total de la campagne | 1107 |
| ventilation VN / VO | 903 / 204 |
| les 19 sites, total et VN/VO | tous conformes |
| la ligne 2 des onglets site | 85 jours conformes, 10 ignores (GAILL et CARM, formule `#REF!`) |

Verifie a l'ecran : le tableau de bord de juin affiche 1107 RDV, 903 VN / 204 VO,
moyenne 11.18, Clermont-Ferrand 218 en tete, 0 concession a zero. Le planning de
VALENTIN PARPINELLI reproduit l'onglet CLF **case pour case**.

Le script est **idempotent et rejouable a blanc** : `npm --prefix backend run
importer-juin` sans `--reel` n'ecrit rien et verifie tout. Il devient de fait le
garde-fou permanent de la pagination.

### Le defaut qu'il a trouve : paginer sans `ORDER BY`

`toutesLesLignes` comparait le nombre de lignes rapatriees au `count` exact — mais
aucun appelant n'ordonnait sa requete. `LIMIT/OFFSET` sans ordre n'a aucune stabilite
garantie : on rapatrie le bon NOMBRE de lignes, pas les BONNES. Le controle de volume
passe au vert pendant que les totaux sont faux.

Constate : total 1107 juste, ventilation 884/223 au lieu de 903/204, trois sites
sur-comptes. **Invisible depuis le debut** parce qu'aucune campagne ne depassait 1000
RDV ; reel a la seconde ou juin est entre en base, sur les DEUX lectures du produit.

Corrige a la racine : la colonne d'ordre est un parametre **obligatoire** de
`toutesLesLignes`, applique par la fonction elle-meme. Un appelant ne peut plus
l'oublier. Detail dans `BUGS-CONNUS.md`.

### Un ecart assume : 1107 au tableau de bord, 1105 au module C

Deux cases du classeur portent deux rendez-vous (un vendeur a pris deux clients dans
la meme heure). Le module C indexe par CASE : le second RDV est invisible a l'ecran et
absent du compteur. **La donnee est juste, c'est la grille qui ne sait pas
l'exprimer.** Rien n'a ete corrige — le choix touche l'ergonomie clavier du module C,
qui est le coeur du produit. A trancher avant septembre ; voir `BUGS-CONNUS.md`.

---

## 01/09/2026, soir — Le code mort est parti, l'interdit n.6 est de nouveau applique

Dernier lot de la bascule. Deux choses, et la seconde a trouve un defaut.

### `test:invariants` — une regle qui avait cesse d'etre appliquee

`verifierInvariants()` comparait `auth/roles.ts` aux contraintes CHECK **au demarrage du
serveur Express**. Il n'y a plus de serveur : plus rien ne demarrait, donc plus rien ne
comparait. L'interdit n.6 etait redevenu une note — exactement ce que ce projet refuse
partout ailleurs.

C'est desormais une suite, `backend/prisma/tester-invariants.ts`, jouee comme les cinq
autres et en CI par `.github/workflows/invariants.yml`, en deux emplois : sur un
**PostgreSQL 17 neuf** bati par `migrate deploy` a chaque push — ce qui prouve au passage
que les 20 migrations se rejouent depuis une base vide — et sur **Supabase** sur `master`.

Elle couvre trois familles (detail dans `ETAT-BACKEND.md`), dont deux sont nouvelles :
les **paliers** (`peut_administrer()` / `peut_gerer_utilisateurs()` contre leurs listes
TypeScript), duplication nee de la bascule vers la RLS ; et **la couverture**, qui exige
que toute liste exportee par `roles.ts` soit citee par un controle. Sans cette derniere,
une septieme liste passerait inapercue et la suite serait verte en ne verifiant rien.

**Elle a trouve un ecart au premier passage** — `ROLES_ADMINISTRATION_REFERENTIELS` valait
`['admin']` contre quatre implementations qui donnent l'administration a `direction`.
Fausse, lue par personne, donc invisible. Voir `BUGS-CONNUS.md`.

### Phase 8 — 24 fichiers supprimes

`src/index.ts`, `src/db.ts`, les 4 fichiers de `src/auth/` autres que `roles.ts`,
`src/middleware/`, `src/realtime/`, les **10 routes**, trois utilitaires sans appelant,
`docker-compose.yml`, les deux Dockerfiles et leurs `.dockerignore`, `nginx.conf`,
`grid.caddy`, `scripts/sauvegarde.sh`, le proxy `/api` de `vite.config.ts`, et six
`.js`/`.js.map` compiles laisses a cote de leurs sources.

**`backend/src/` ne contient plus QUE le code que le navigateur execute.** La frontiere
se verifie d'un coup d'oeil : un fichier de `src/` qui n'est ni dans l'`include` du front
ni dans une suite n'a rien a y faire.

Deux angles morts fermes au passage : le **typecheck du backend ne voyait pas `prisma/`**
— les six suites n'etaient jamais typecheckees — et **`comptes-test` recopiait le portail
disparu**, il lit maintenant la vue `perimetre_saisie`.

### La dette de tri est soldee

Sept sites du front recopiaient la normalisation ou triaient par `localeCompare('fr')`,
qui classe selon la version d'ICU du navigateur : deux postes du groupe pouvaient
afficher la meme liste dans deux ordres. Ils importent tous `backend/src/utils/tri.ts`,
enrichi d'une primitive `sansDiacritiques`. Table detaillee dans `ETAT-BACKEND.md`.

---

## 01/09/2026 — Le front parle a Supabase, l'API a disparu

Les 7 `services/*.ts` sont reecrits sur `supabase-js`. **Les ecrans n'ont pas bouge** :
les signatures et les formes de reponse sont conservees a l'identique, y compris
`ErreurApi` avec son `statut` et son `corps` — `Campagne.tsx` lit toujours un 409 pour
afficher les RDV impactes par R-A.2, sauf que ce 409 est desormais fabrique par
`services/campagnes.ts` a partir du sondage de la fonction SQL.

### Les utils partages sont REUTILISES, pas recopies

C'etait la promesse du plan, et elle est tenue litteralement : `agregats.ts`,
`repartition.ts`, `importMarques.ts`, `tri.ts`, `presenceVendeur.ts` et `auth/roles.ts`
sont **les memes fichiers**, servis au navigateur. Le seul changement est une entree dans
l'`include` de `tsconfig.json`. On le voit dans l'onglet reseau : le navigateur charge
`/backend/src/utils/agregats.ts`.

Consequence directe : les 27 controles des agregats, les 20 de la repartition et les 19
du parseur **valent toujours** pour le code qui tourne en production. Il n'y a pas eu de
seconde implementation a redemontrer.

Le partage est le meme partout : **le navigateur CALCULE, la base ECRIT**. La graine 42
et le parseur d'import restent en TypeScript ; `session_appliquer_repartition` et
`vendeur_appliquer_import_marques` se contentent d'ecrire, atomiquement.

### La pagination defensive

`toutesLesLignes` pagine ET compare au `count: 'exact'`. Si les deux divergent, elle
LEVE au lieu d'afficher un total. La limite de PostgREST tronque **sans erreur** : un
chiffre faux presente comme un chiffre juste serait exactement le defaut de l'Excel que
ce produit remplace. Le reglage Supabase est a 5000, mais un reglage de tableau de bord
n'est pas une garantie — il se perd a la recreation d'un projet.

### Le temps reel : un conflit reel, et un piege

`postgres_changes` etait le reflexe, et il est **inutilisable ici** : cette diffusion
respecte la RLS, donc un chef de table ne recevrait aucun evenement pour les RDV des
autres tables — la politique de `rdv` restreint la lecture au perimetre pour proteger le
nom du client. Le compteur du tableau de bord aurait cesse de bouger, en silence.

D'ou la diffusion **par trigger** : `rdv_diffusion` emet une charge utile sans nom de
client sur un canal par campagne, exactement ce que faisait `emettre()` du temps de
socket.io. L'auteur ignore son propre evenement en comparant `auteur` a son identifiant,
ce qui remplace l'en-tete `x-socket-id` — une piece mobile de moins.

**DEFAUT TROUVE ET CORRIGE : un nom de canal ne peut pas contenir de deux-points.**
`campagne:2` ne s'abonne JAMAIS — pas d'erreur, pas de delai d'attente, rien. Realtime
reserve le `:` a son propre adressage (`realtime:<sujet>`). Le nom venait des salles
socket.io, ou il ne posait aucun probleme. Corrige en `campagne-2` par la migration
`20260831230000`.

### Un outil d'amorcage : `comptes-auth`

Il faut bien creer le PREMIER compte : l'Edge Function exige un appelant `admin` deja
connecte. `npm --prefix backend run comptes-auth` cree l'identite Supabase Auth et pose
`auth_uid`, comme `mot-de-passe.ts` le faisait pour l'authentification precedente. Sans
argument, il liste qui est relie et qui ne l'est pas.

L'adresse est une **synthese** — `<loginId>@grid.bonyauto-mobile.com` — et **ce domaine
ne recoit rien**. Personne ne doit croire qu'on peut ecrire a ces adresses.

### Ce qui a reellement tourne, dans le navigateur, contre Supabase

- connexion avec un identifiant, session Supabase etablie, palier reconnu ;
- module C : 23 vendeurs, 5 jours x 11 creneaux, la grille et ses sections par marque ;
- **saisie au clavier** : RDV pose, compteur du vendeur a jour, ventilation par marque
  suivie, curseur descendu a la case suivante ;
- `cree_par` **impose par le trigger** — la requete du navigateur ne l'envoie pas ;
- tableau de bord : totaux, effectif calcule (99), moyenne, meilleure concession,
  concessions a zero — tout recalcule dans le navigateur par `agregats.ts` ;
- **temps reel prouve** : un RDV ecrit depuis le terminal est arrive dans le navigateur,
  charge utile complete et **sans nom de client**.

### Ce qui manque encore, et qui bloque un ecran

**L'Edge Function `gerer-comptes` n'est PAS ecrite.** `services/utilisateurs.ts`
l'appelle deja pour trois operations — creer un compte, reinitialiser un mot de passe,
supprimer une identite. **Ces trois actions echoueront** tant que la fonction n'existe
pas. Le reste de l'ecran Comptes fonctionne : la lecture, les roles, l'encadrement et la
purge passent par PostgREST et par des RPC.

C'est la seule chose qui ne peut pas se faire sans code serveur : creer une identite
Supabase Auth exige la cle `service_role`, qui ne doit jamais se trouver dans le
navigateur. En attendant, `comptes-auth` fait le travail en ligne de commande.

---

## 31/08/2026, soir — GRID part sur Supabase, sans serveur

**Ce qui a changé, et pourquoi.** L'outil était complet et vérifié mais n'avait **aucun
point d'entrée public**. Toutes les voies passant par le VPS de gearbox sont fermées —
exigence textuelle de l'utilisateur, « Gearbox reste Gearbox » ; le VPS a été remis dans
son état d'origine. Et `grid.bonyauto-mobile.com` **n'existe pas en DNS**, la zone est
chez Gandi, l'accès n'est pas disponible : rien côté serveur ne peut créer un nom qui ne
résout pas.

Décision : **front statique sur Cloudflare Pages, et Supabase attaqué directement par le
navigateur.** Le backend Express disparaît. Zéro euro par mois.

### Ce que ça coûte, dit sans l'enjoliver

1. **La RLS est seule.** `auth/campagneScope.ts` n'existe plus. Les politiques sont la
   seule chose entre un chef de table et les données du groupe, et il n'y a rien
   derrière elles.
2. **Le front est public** : modèle de données, requêtes et clé `anon` lisibles par
   quiconque ouvre les outils de développement. C'est normal et sans risque — *à
   condition* que `test:rls` soit vert.
3. **`test:api` (43 contrôles) a disparu** avec l'API qu'elle testait. Son rôle est repris
   par `test:rls`, qui compte aujourd'hui **87 contrôles** et vérifie les deux sens.

### Ce qui a survécu intact — et c'est la majorité

Les 12 migrations existantes, `agregats.ts` et ses 27 contrôles contre les 1107 RDV réels,
`repartition.ts` (graine 42) et ses 20 contrôles, `importMarques.ts` et ses 19, `tri.ts`,
`presenceVendeur.ts`, et **tous les écrans React**. Trois des cinq suites n'ont pas bougé
d'une ligne. C'est ce qui a rendu la bascule supportable.

*(`messageTrigger.ts` figurait ici : il a été supprimé le 01/09/2026, sans appelant. Il
découpait la représentation Prisma d'une exception, que le navigateur ne voit plus.)*

### Cinq migrations ajoutées

| Migration | Contenu |
|---|---|
| `20260831200000_auth_uid` | colonne `auth_uid` sur `utilisateur`. Pas de FK vers `auth.users` : Prisma ne sait pas référencer un autre schéma sans `multiSchema`, et une FK qu'il ignore serait proposée à la suppression à chaque `migrate diff` |
| `20260831201000_rls_portail` | 6 fonctions, la vue `perimetre_saisie`, la vue `rdv_agrege`, RLS + **48 politiques sur les 17 tables**, 9 triggers de traçabilité |
| `20260831202000_triggers_hors_rls` | les 8 triggers de validation passent en `security definer` — correctif, voir plus bas |
| `20260831203000_rdv_agrege_compte_actif` | la vue agrégée filtre les comptes inactifs — correctif, voir plus bas |
| `20260831210000_rpc_privilegies` | **13 fonctions transactionnelles**, les deux portes de purge, et le retrait des droits d'exécution à `PUBLIC` |

### Trois défauts trouvés en chemin, tous corrigés

**1. Les triggers de validation étaient aveuglés par la RLS.** Ils s'exécutaient avec les
droits de l'appelant : depuis que `vendeur_marque` porte une politique, un appelant sans
identité n'y voyait aucune ligne, et `verifier_marque_autorisee()` concluait « ce vendeur
n'est pas autorisé à vendre cette marque » — un verdict **faux**. Le trigger ne vérifiait
plus un invariant de la base mais un invariant *de ce que l'appelant voit*. Les huit
fonctions sont passées en `security definer` par `ALTER FUNCTION`, sans recopier leur corps.

**2. `rdv_agrege` rendait tout à un compte désactivé.** Mesuré : `vendeur` → 0 ligne
(correct), `rdv_agrege` → toutes les lignes (faux). La vue contourne la RLS par
construction — c'est ce qu'on lui demande, le tableau de bord doit compter les RDV de tout
le monde — mais le contournement valait aussi pour ceux qui ne doivent plus rien voir. Un
compte désactivé garde un jeton Supabase valide : il aurait lu les compteurs de toutes les
plaques indéfiniment. **Règle à retenir : toute vue qui n'active pas `security_invoker`
doit porter elle-même `WHERE relance.utilisateur_courant() IS NOT NULL`.**

**3. Deux contrôles de test ne prouvaient rien, et c'est le déploiement sur une base
propre qui l'a révélé.** Le premier passage de `test:garde-fous` sur Supabase a rendu
**32/32 au lieu de 33/33**. Un test de non-régression R-B.1 cherchait un vendeur libre en
base : sur une base fraîchement seedée il n'en existe aucun — CENTRE a 30 vendeurs et
5 tables de 6, l'effectif est exactement saturé. Il ne tournait en local que grâce à des
vendeurs résiduels d'anciennes exécutions, et son `if` n'avait **pas de `else`** : il
disparaissait en silence. Même classe de défaut dans `test:rls`. Les deux fabriquent
maintenant leur matière dans la transaction annulée.

*Leçon générale : un contrôle qui dépend de l'état de la base ne prouve rien tant qu'on ne
l'a pas vu tourner sur une base vide.*

### Deux réglages Supabase qui étaient dangereux

`db_schema` n'exposait pas `relance` (aucune requête n'aurait abouti) et `max_rows` était à
**1000**, soit moins que les 1107 RDV de juin — la troncature silencieuse, exactement le
défaut de l'Excel que le produit remplace. Porté à 5000, **et** le front paginera quand
même : un réglage de tableau de bord n'est pas une garantie.

Surtout : **`disable_signup` était à `false`**. N'importe qui pouvait se créer un compte
avec la clé publique. La RLS tenait — `utilisateur_courant()` rend NULL pour un `auth.uid()`
inconnu — mais la porte n'avait aucune raison d'être ouverte. Fermée, avec
`mailer_autoconfirm` activé (sans quoi aucun compte n'aurait pu se connecter, nos adresses
de synthèse n'existant pas) et le minimum de mot de passe porté de 6 à 12.

### Ce qui a réellement tourné

```
16 migrations puis 17e (RPC)   ·  comparaison des deux bases : AUCUN ECART
   17 tables · 144 colonnes · 11 CHECK · 28 triggers · 35 fonctions
   2 vues · 48 politiques · 35 index

Supabase   garde-fous 33/33   ·  rls 81/81
Local      garde-fous 33/33   ·  rls 81/81   ·  agregats 27/27
           repartition 20/20  ·  import 19/19
tsc front + backend : vert    ·  derive Prisma : nulle
```

Et le contrôle qui compte le plus, fait **en HTTP réel avec la clé publique** : lecture des
vendeurs, lecture des RDV, lecture de la vue agrégée, écriture d'un RDV, appel de
`vendeur_purger`, appel de `session_appliquer_repartition` — **six tentatives, six refus**
`42501 permission denied for schema relance`.

### Reste à faire

| Sujet | État |
|---|---|
| Réécriture des 7 `services/*.ts` sur `supabase-js` | **à faire** — c'est le gros du travail restant |
| `hooks/useTempsReel.ts` sur Supabase Realtime | à faire, avec le trigger de diffusion |
| Edge Function `gerer-comptes` (création de comptes, clé `service_role`) | à faire |
| Workflows sauvegarde + keep-alive | à faire, adaptés de gearbox |
| Comptes `.test` sur Supabase | **inertes** (aucun `auth_uid`, donc incapables de se connecter), à archiver avant mise en service |
| Cloudflare Pages | à brancher par l'utilisateur |
| Révocation des secrets exposés en conversation | à faire par l'utilisateur |

---

## Cible

Outil operationnel pour la campagne de **septembre 2026**, une semaine de developpement.
L'Excel reste en place, non modifie, comme filet.

### ~~Le VPS, tel qu'il est — releve du 31/08/2026~~ — PERIME, voir la section du 31/08 au soir

Reconnaissance en lecture seule. Le detail et le mode operatoire sont dans
**DEPLOIEMENT.md**, qui est le seul document a suivre pour deployer.

| | |
|---|---|
| Hote | `51.83.75.181`, Ubuntu 26.04, 8 vCPU, 22 Gio de RAM, 184 Gio libres |
| Deja en place | gearbox, en trois conteneurs Docker, projet compose `gearbox` |
| Point unique de contact | `gearbox-caddy-1` tient les ports 80 et 443 |
| Postgres | **aucun** sur la machine : gearbox est sur Supabase |
| Marge | 1,1 Gio de RAM utilises sur 22, 5 % du disque. GRID tient largement |

**Exigence de l'utilisateur, textuelle :** « Je ne veux qu'il ne soit en aucun cas mele a
Gearbox et qu'il entrave son fonctionnement. » Ce qui la tient :

- projet compose `grid` distinct — conteneurs, volumes et reseaux separes ;
- la base de GRID est sur un reseau **prive** et **ne publie aucun port** : ni gearbox ni
  l'internet ne peuvent l'atteindre ;
- aucun fichier de gearbox modifie, sauf **une** chose, inevitable : un bloc de site
  ajoute a son `Caddyfile`, parce qu'un seul processus peut ecouter le port 443.
  `caddy reload` valide avant d'appliquer — un bloc mal ecrit est refuse et gearbox
  continue de servir l'ancienne configuration. Sauvegarde horodatee et retour arriere
  d'une ligne dans DEPLOIEMENT.md.

**Piege identifie et evite** : sur un reseau Docker, chaque service porte son nom comme
alias DNS. Gearbox a deja `api` et `web`. Nommer nos services pareil aurait rendu ces noms
ambigus et le Caddy de gearbox aurait proxifie **une requete sur deux vers GRID**. D'ou
`grid-api` et `grid-web`, avec un controle explicite a l'etape 5 du runbook.

**Deja valide sur le serveur, sans rien y installer** : le `docker-compose.yml` de GRID
(`docker compose config`), et le Caddyfile de gearbox **augmente du bloc de GRID** —
« Valid configuration », dans un conteneur Caddy jetable. Gearbox n'a pas ete touche :
memes conteneurs, memes duree de fonctionnement, `Caddyfile` inchange.

**Ce qui bloque encore le deploiement** : `grid.bonyauto-mobile.com` **n'existe pas en
DNS**. A creer chez le registrar, en A et AAAA vers le VPS, avant l'etape 6 — Caddy demande
le certificat des la premiere requete et Let's Encrypt limite les tentatives echouees.

### ~~Decision du 31/08/2026 — pas de Supabase, Postgres sur le VPS~~ — RENVERSEE le meme jour

Prise par l'utilisateur. Ce qu'elle change :

- **une dependance externe de moins**, et un `.env` de production plus simple : une seule
  chaine de connexion au lieu des deux poolers (transaction pour l'app, session pour les
  migrations) ;
- le blocage des ports 5432/6543 par le reseau du bureau **n'a plus aucune incidence**,
  meme pour une migration de production ;
- Postgres 17 et l'API de relance vivent dans un `docker-compose` **separe** de celui de
  gearbox, qui n'est pas modifie. Redemarrer relance ne peut pas toucher gearbox ;
- **contrepartie assumee : les sauvegardes sont a notre charge.** Supabase les faisait.
  Le runbook de J7 doit donc decrire la sauvegarde ET prouver la restauration — une
  sauvegarde jamais restauree n'est pas une sauvegarde, c'est une intention, exactement
  comme une contrainte qu'on n'a jamais vue refuser quelque chose.

Le coeur du produit est le **module C**, le planning de saisie. Tout le reste est du
support.

## Architecture

Parite structurelle avec GEARBOX (`C:\Users\Operateur\Documents\gearbox3backup`).

| Couche | Choix |
|---|---|
| Front | Vite + React 19 + TypeScript, a plat a la racine, port 3000 |
| API | **aucune.** Le navigateur attaque Supabase : PostgREST + 13 RPC transactionnelles |
| Base | PostgreSQL 17, schema `relance`. Local en dev, **Supabase en prod** (`eu-west-3`) |
| Autorisation | **La BASE fait autorite**, par RLS. 48 politiques, aucun filet derriere |
| Temps reel | Supabase Realtime (a cabler) |
| Deploiement | Cloudflare Pages, build `npm run build`, sortie `dist` |
| URL cible | fournie par Cloudflare Pages |

Le front n'appelle que des URL **relatives** (`/api/...`) : Vite proxifie en dev, Caddy
sert les deux sous le meme domaine en prod. Aucune variable d'URL d'API a se tromper.

## Decisions structurantes

| Sujet | Decision | Motif |
|---|---|---|
| Marques | Table `marque` + `vendeur_marque` | Interdit n.3. Ajouter Mobilize devient une ligne de donnees |
| VN/VO | **Metier du vendeur**, un scalaire VN ou VO | Lu dans l'onglet RESULTATS du fichier : un vendeur figure dans le bloc VN ou dans le bloc VO, jamais les deux. Le selecteur en tete de grille etait une erreur |
| Suppression | `archive_le` partout, aucune route de suppression, triggers `BEFORE DELETE` | Interdit n.1 |
| RLS | Abandonnee | Prisma se connecte avec le role proprietaire, qui la contourne. Interdit n.4 reformule : autorisation serveur, portail unique |
| Auth | JWT + bcrypt, comptes crees par l'admin | Supprime le seul delai externe de la semaine (pas d'enregistrement Entra ID a obtenir) |
| Index partiels | Aucun | Prisma gere les index et proposerait de les supprimer a chaque migration. Reactivation plutot que recreation (voir ci-dessous) |
| Cles primaires | `BIGSERIAL` et non `generated always as identity` | Ecart assume, voir `ETAT-BACKEND.md` |
| Lot 0 (reparer l'Excel) | Abandonne | L'outil le remplace |

### Reactivation plutot que recreation

Toutes les unicites sont **simples**, pas partielles. Un code de site deja porte par un
site archive se recupere en **desarchivant** ce site, pas en creant un doublon :
l'historique reste sur une seule ligne. Meme regle pour une affectation vendeur-table
(`archive_le` remis a `null`).

## Ce qui tourne, verifie

- PostgreSQL 17.11 local, base `relance`, schema `relance`.
- 12 migrations, **rejeu complet depuis un schema vide REVERIFIE le 31/08/2026** — sur une
  base jetable, sans toucher a la base de travail : 16 tables et 19 triggers, identiques a
  ceux de la base de travail, noms compares un a un. C'est le chemin de J7.
- 11 contraintes CHECK, 19 triggers. **33/33 garde-fous testes et confirmes**
  (`npm --prefix backend run test:garde-fous`). Chacun doit REFUSER quelque chose : un
  invariant qu'on n'a jamais vu refuser n'est pas une contrainte, c'est une intention.
- Seed **rejouable sans effet** sur ce qui existe : 3 marques, 4 plaques, 19 sites,
  99 vendeurs, 196 `vendeur_marque`,
  9 utilisateurs, 2 campagnes, 10 jours, 22 creneaux, 8 sessions, 8 tables,
  48 affectations. Rejoue deux fois : comptes identiques.
- Authentification : jeton, refus 401, message identique compte inconnu / mot de passe
  faux, aucune fuite de `passwordHash`.
- Perimetre par campagne : `sbesson` ressort avec `tablesParCampagne {"1":["1"]}` et aucun
  droit plaque ni site.
- Boucle complete dans le navigateur : front 3000 -> proxy -> API 3001 -> Prisma -> PG.
- **Parseur d'import : 19/19** (`test:import`), fonction pure, sans base ni serveur.
- **Agregats : 27/27** (`test:agregats`), fonctions pures, comparees aux 1107 RDV reels de
  juin 2026 tenus EN MEMOIRE — rien n'entre en base. C'est le critere de recette n.4.
- **Repartition : 20/20** (`test:repartition`), fonction pure. Graine 42 reproductible sur
  trois axes : deux executions, ordre des vendeurs, ordre des tables.
- **API : 43/43** (`SEED_MOT_DE_PASSE=... npm --prefix backend run test:api`, serveur en
  marche) — portail d'autorisation, import en deux temps, R-A.2, module B, dashboard.
  **Sa remise en etat tourne dans un `finally`** : ce script modifie des donnees metier, et
  une version precedente a abime la campagne de septembre en plantant avant sa restauration.
- **Zero derive Prisma** : `migrate diff` rend « empty migration ».
- **Temps reel verifie de bout en bout** : un RDV cree depuis un autre client fait monter le
  tableau de bord tout seul, sans rechargement.
- **R-C.1 devenue reelle** : un vendeur passe en Renault seul refuse un RDV Dacia avec un
  message lisible. C'est la preuve que le point bloquant se leve vendeur par vendeur.
- **R-A.2 verifiee dans l'interface** : retirer un jour portant 2 RDV ouvre le choix,
  annonce le vendeur concerne, propose les seuls jours conserves comme destination, et le
  deplacement s'applique — aucune erreur de contrainte n'atteint l'ecran.

## Reste a faire

## J3 — module C, le planning de saisie (28/08/2026)

### Le fichier Excel a ete LU, et il a corrige le modele

Jusqu'ici le travail s'appuyait sur la *description* du classeur dans les specs. Sa lecture
(onglets `RESULTATS`, `TABLES(EAA)`, `SUIVI`, `RANK`, `CLF`, `ALPINE`) a corrige deux
erreurs et confirme une regle generale.

**Un vendeur est VN ou VO, jamais les deux.** `RESULTATS` porte une colonne `TYPE` par
vendeur : 72 VN et 27 VO sur juin 2026. C'est son METIER, pas une propriete du rendez-vous.
La relation many-to-many precedente etait fausse ; `vendeur.type_vehicule` est desormais un
scalaire, et la donnee est REELLE (extraite du fichier), plus un placeholder.

**Le selecteur VN/VO en tete de grille n'existe pas dans le metier.** C'est le vendeur
selectionne qui determine la forme de sa grille.

**La regle, validee sur le site ALPINE** (bloc de 16 lignes et non 27, en-tete `ALP` au lieu
de `REN`/`DAC`) :

> Une section par marque autorisee pour un vendeur VN. Une seule section, sans marque, pour
> un vendeur VO.

Alpine → 1 section, Renault + Dacia → 2, VO → 1 sans marque. La table `vendeur_marque`
etait donc juste, et c'est elle qui pilote la grille.

**`rdv.marque_id` devient nullable**, obligatoire pour un VN et interdite pour un VO, par
trigger. **`rdv.type_vehicule` reste stocke** et un trigger impose l'egalite avec le metier
du vendeur : deriver ferait bouger les totaux d'une campagne cloturee des qu'un vendeur
change de metier — la classe du bug `RANK!AG`.

### Chiffres de reference extraits pour la recette

`scripts/extraire-xlsx.mjs` produit `backend/prisma/donnees-xlsx.ts` : types VN/VO,
marques par site, et **les totaux attendus** — par vendeur, par site, par table, par jour.
Somme des vendeurs = somme des sites = 1107, coherence verifiee a l'extraction. C'est la
reference du critere de recette n.4.

### Ce qui existe

- `GET /api/saisie/:campagneId` — tout le perimetre en UN appel, avec la forme de la grille
  de chaque vendeur calculee cote serveur.
- `POST /api/rdv`, `PATCH /api/rdv/:id`, `POST /api/rdv/:id/archiver`. Aucune suppression.
- **R-C.2** enfin implementee : deuxieme RDV sur la meme case → 409, applicable sur
  confirmation explicite.
- `pages/Saisie.tsx` + `components/GrilleVendeur.tsx` : liste a gauche avec compteurs
  vivants et total, grille a droite, sections empilees, en-tetes et colonne des creneaux
  collants, aide clavier en pied.
- socket.io par salle de campagne, evenements `rdv:cree` / `rdv:modifie` / `rdv:archive`.

### La saisie enchainee fonctionne — c'etait le pilote de test

Signale ouvert en priorite 1 en fin de J3. **Verifie au clavier reel : la saisie enchainee
fonctionne.** Le defaut etait un artefact de l'automatisation. Detail et lecon dans
`BUGS-CONNUS.md`.

## J5-J6 — socle d'agregats, module B, panneaux live, dashboard (31/08/2026)

### Le socle d'agregats, et pourquoi il vient en premier

`utils/agregats.ts` — **fonctions pures**, aucun Prisma. Source de verite unique de TOUS les
totaux : le dashboard les affiche, les panneaux live du module C les affichent en direct,
l'alerte d'effectif du module B en a besoin. Ecrits trois fois, ils auraient diverge.

**Verifies contre le fichier reel.** `test:agregats` donne aux fonctions les 1107 RDV de juin
2026 EN MEMOIRE — rien n'entre en base, c'etait la decision — et compare aux quatre series de
totaux independantes du classeur. 27 verifications, dont :

| Controle | Attendu | Obtenu |
|---|---|---|
| Total groupe | 1107 | 1107 |
| CLERMONT total / VN / VO | 218 / 171 / 47 | conforme |
| Plaque CENTRE | 407 | 407 |
| Tables EAA 1 a 5 | 78 / 84 / 75 / 91 / 79 | conforme |
| Tables SUD 1 a 3 | 43 / 76 / 64 | conforme |
| Totaux du jour CLF | 52 / 49 / 42 / 38 / 37 | conforme |
| Les 19 sites, VN et VO | `ATTENDUS_SITES` | conforme |
| Les 99 vendeurs, un par un | `TYPES_VENDEURS` | conforme |

Le controle des 8 tables valide **aussi les affectations de juin**, qui n'avaient jamais ete
verifiees autrement que par leur nombre.

Deux regles y sont tenues explicitement, parce qu'elles ont deja coute des bugs : les totaux
partent des **vendeurs** et non des RDV (sinon un vendeur a 0 RDV disparait du classement,
defaut de `schema.sql`), et l'effectif vient de `presenceVendeur` et jamais des RDV (bug
`RANK!AG`).

### Module B — le constructeur de tables

Ecran `Tables`, route `/api/tables`, gardee par le seul `peutAdministrerSession`. Creer,
renommer, designer un chef, specialiser sur une marque, composer par **glisser-deposer ET par
clic** — le glisser-deposer HTML5 est mauvais au doigt, et l'outil s'utilise sur tablette.
Archiver, jamais supprimer.

**R-B.1 n'etait tenue par rien.** « Une table ne contient que des vendeurs de sa propre
plaque » etait au cahier des charges depuis le debut et aucun des 18 invariants ne l'imposait.
Elle n'avait pose aucun probleme parce que seul le seed ecrivait des affectations ; le module B
est justement celui qui peut la violer. Trigger `affectation_meme_plaque` + 2 garde-fous.

**La specialisation d'une table est DECLAREE, pas deduite.** Une premiere version la deduisait
des membres presents : la repartition rendait 11/8/10 au lieu de 10/10/9 sur la vraie session
CENTRE, parce que le premier vendeur tire au sort fixait les marques de la table pour
toujours. Colonne `table_phoning.marque_id` + trigger + 3 garde-fous. Detail complet dans
`BUGS-CONNUS.md` — c'est le defaut le plus instructif du lot.

**F-B.8 etait deja acquise** : `vendeursSaisissables` reunit table ET site, donc un vendeur en
reserve reste saisissable par son chef de site. Verifie par `test:api`, pas suppose.

Graine 42 verifiee sur trois axes : deux executions identiques, ordre d'entree des vendeurs
indifferent, ordre de declaration des tables indifferent. Sur les vraies donnees : **10/10/9,
reproductible a l'identique**.

### Panneaux live du module C

`components/PanneauxLive.tsx`, sous la grille et **replies par defaut** : en cas d'arbitrage
entre l'elegance d'un tableau de bord et la fluidite de la saisie, la saisie gagne.

- **Les autres tables de ma plaque** — equivalent de `TABLES(EAA)`, alimente par un calcul et
  non par 677 references de ligne figees. Quand la plaque est en `par_site`, ce sont les SITES
  cote a cote : les tables sont un supplement.
- **Classement live des concessions** — general / VN / VO, les trois classements de `RANK`.
  Les ex aequo sont SIGNALES : l'ordre entre eux est stable mais arbitraire, et le panneau
  finit projete sur un ecran collectif.

### Module D — le dashboard

Remplace trois onglets du fichier : `RÉSULTATS`, `SUIVI` et `RANK`. Totaux sur cinq axes avec
ventilation par marque, effectif calcule, moyennes, comparaison a une campagne anterieure
(F-D.5 — le « mars : 351 » ecrit a la main), totaux par jour, classements.

**Export Excel cote client**, avec `xlsx-js-style` deja present : aucune dependance nouvelle.
Cinq feuilles, dont une feuille **Provenance** qui dit que le fichier est une photographie et
ne contient aucune formule. Le detail nominatif vient de `/api/saisie`, donc du portail : un
chef de table exporte sa table.

### Temps reel : un defaut silencieux corrige

Le front demandait le WebSocket AVANT le polling. Dans un environnement qui bloque `ws://` —
un bac a sable, ou un proxy d'entreprise — il n'y avait **aucun repli** et le temps reel etait
muet, sans erreur visible. Le critere de recette n°5 tombait en silence. Retour a l'ordre par
defaut. Verifie de bout en bout : un RDV cree depuis un autre client fait monter le tableau de
bord tout seul.

## Ajustements vendeurs (31/08/2026)

Demandes par l'utilisateur avant le deploiement.

### La notion de « confirme » est retiree

Une jauge et une route `capacites/progression` distinguaient une donnee validee du
placeholder du seed. **Retirees** : un vendeur present en base est valide, point. Une
progression qui ne bouge jamais devient un reproche permanent, et elle mesurait une dette de
saisie, pas une propriete du metier.

Les colonnes restent comme **provenance** (`capacitesModifieesLe/Par`) : savoir qui a change
les marques d'un vendeur et quand sert le jour ou un RDV est refuse sans qu'on comprenne
pourquoi.

### Deux niveaux de retrait

| Geste | Ou | Effet | Reversible |
|---|---|---|---|
| Poubelle | ligne de l'ecran Vendeurs | la ligne disparait, **ses RDV restent** | oui |
| Purge | volet Archivage | destruction definitive, RDV compris | **non** |

L'interdit n.1 est **reformule et non leve** : par defaut aucun `DELETE` ne passe, sur aucune
table. Une porte nommee s'ouvre pour la duree d'UNE transaction. Trois obstacles deliberes
avant une purge — etre archive, retaper le nom exact, voir le nombre de RDV qui partiront.
Detail dans `CLAUDE.md` interdit n.1 et `ETAT-BACKEND.md`.

### L'encadrement se gere depuis l'ecran Vendeurs

Un bloc en tete de chaque carte de site : **un chef de site** (un seul, tous metiers
confondus) et **un chef de vente par metier** (VN, VO — beaucoup de sites n'en ont aucun).
Tenus par deux triggers qui ne comptent que les vendeurs en poste. Le front retire le role a
l'ancien titulaire avant de le donner au nouveau : l'ordre inverse serait refuse.

### Tri par colonne

Toutes les colonnes du tableau sont triables, dans chaque site : le nom, chaque marque, le
metier, le role. Departage TOUJOURS par le nom — sans lui, deux vendeurs indiscernables sur
la colonne triee changeraient de place a chaque rendu.

### Ce qui NE fonctionne pas encore

Le **deploiement** (J7) : VPS, Caddy, sauvegardes, `DEPLOIEMENT.md`.

L'utilisateur a annonce une passe **UX** apres ces ajustements.

Les residus de donnees sont **tranches, le 31/08/2026 sur decision de l'utilisateur** :

- `BLANDINE CLÉMENT` et `PIERRE-EDOUARD LAROCHE` portaient une date de sortie (01/08 et
  31/07/2026) qui ne venait ni du fichier source ni du seed. **Retirees** : tous deux sont
  remis en poste, et l'effectif de septembre passe de 98 a 100 ;
- `MARC TESTEUR` (ALPINE, 0 RDV, 0 affectation) est **purge definitivement**. Le volet
  Archivage est vide ;
- les `VENDEUR VERIF API` sont purges, et la suite API purge desormais les siens a chaque
  passage au lieu de les accumuler.

**Effectif de reference : 100 vendeurs en poste** — les 99 du fichier source plus
`JEAN-FRANCOIS LARGET`, cree a la main le 28/08 et confirme comme vendeur reel (1 affectation,
chef de site a Clermont). Les deux campagnes affichent 100 au tableau de bord.

---

## Ajouts du 28/08/2026 (apres J2)

### Charte Bony

Reprise de GEARBOX a l'identique : couleurs, dégradé, Syncopate + Albert Sans, couche
liquid glass, memes noms de tokens et memes classes. Theme sombre par defaut avec bascule.
Ecart assume : pas de Tailwind, tout en CSS simple. Detail dans `CLAUDE.md`.

### Differenciation VN / VO PAR VENDEUR

`type_vehicule` ne vivait que sur le RDV : rien n'empechait un RDV VN chez un vendeur
exclusivement VO. La distinction est reelle en concession — stock et objectifs differents —
donc elle appartient au vendeur.

**Corrige a J3 apres lecture du fichier source : c'est un SCALAIRE, pas un ensemble.**
L'onglet `RESULTATS` porte, par site, un tableau `VENDEUR | TYPE | REN | DAC | RDV` ou chaque
vendeur figure dans le bloc VN **ou** dans le bloc VO, jamais dans les deux. La premiere
version du modele avait une table `vendeur_type_vehicule` autorisant les deux : c'etait faux.
Colonne `vendeur.type_vehicule` (`VN` | `VO`), table de jonction supprimee, migration
`20260828140000_vendeur_type_scalaire`.

Trois consequences, toutes tenues par des triggers :

- `rdv.marque_id` devient **nullable** — un vendeur VO n'a aucune ventilation par marque, les
  colonnes REN et DAC sont vides pour lui dans le fichier. `rdv_marque_selon_metier` impose
  `NULL` pour un VO et une marque pour un VN.
- `rdv.type_vehicule` reste **stocke** bien qu'il soit deductible du vendeur :
  `rdv_type_coherent` impose l'egalite a l'ecriture. Le deriver ferait bouger les totaux
  VN/VO d'une campagne **deja cloturee** des qu'un vendeur change de metier — c'est la meme
  classe de bug que `RANK!AG`.
- La forme de la grille sort du serveur : **une section par marque autorisee pour un VN, une
  seule section sans marque pour un VO.** Le site ALPINE le prouve, son bloc fait 16 lignes
  et non 27, une seule section.

**Et le type n'est pas un placeholder** : `scripts/extraire-xlsx.mjs` le lit vendeur par
vendeur — **72 VN et 27 VO** —, le seed echoue fort si l'un des 99 noms ne s'apparie pas.

`marques_confirmees_le` devient **`capacites_confirmees_le`**. Le compteur ne porte que sur
les marques et ne compte que les **VN** au denominateur : un vendeur VO n'a aucune marque a
confirmer, l'inclure donnait un objectif inatteignable.

### Gestion des vendeurs dans l'application

Plus aucun aller-retour par un fichier Excel. L'ecran « Vendeurs » permet, par site :
creer, renommer, **transferer d'un site a l'autre** en conservant l'historique (F-A3.5),
designer un chef de site, renseigner entree et sortie, et regler les capacites.

Aucune suppression (interdit n.1) : sortir un vendeur, c'est renseigner `dateSortie`. Il
quitte les classements courants, son historique reste. Verifie dans l'interface.

Un homonyme sur le **meme** site est refuse — il rendrait tout import par collage ambigu et
la grille de saisie illisible. Sur deux sites differents c'est admis, le code site separe.

### Les quatre paliers de compte

| Palier | Administration | Gestion des comptes | Saisie |
|---|---|---|---|
| `admin` | oui | **oui** | tout |
| `direction` | oui | non | tout |
| aucun role — *encadrant* | non | non | ses sites et ses tables |
| `lecteur` | non | non | rien |

**Un ENCADRANT est une personne avec un compte, jamais un vendeur.** Ses droits viennent de
ses rattachements : les sites qu'il encadre (durablement) et les tables qu'il anime (par
campagne). C'est ce palier qui fait tourner l'exercice — un chef de vente de Clermont peut
animer une table de Villefranche pour coacher des vendeurs de cinq concessions.

L'ecran **Comptes** (reserve a `admin`) cree ces acces, reinitialise un mot de passe,
desactive un compte, et le supprime definitivement s'il n'explique plus rien.

### Comptes

**Comptes de test, un par PERIMETRE.** Poses et reposes par
`MOT_DE_PASSE="..." npm run comptes-test`, script idempotent. Ils existent parce que les
droits de cet outil sont **par campagne**, et que c'est justement ce qui est penible a
mettre en place a la main.

| Identifiant | Perimetre | Campagne | Vendeurs |
|---|---|---|---|
| `admin.test` | admin — tout, y compris la gestion des comptes | les deux | 100 |
| `direction.test` | direction — tout SAUF la gestion des comptes | les deux | 100 |
| `encadrant.test` | encadrant — chef de site CLF, chef de vente VN MOZ | **les deux** | 24 |
| `chef.plaque.test` | chef de plaque CENTRE | Septembre 2026 | 31 |
| `chef.site.test` | chef de site Clermont (CLF) | Septembre 2026 | 17 |
| `sbesson` | chef de la Table 1 de CENTRE | **Juin 2026** | 6 |

Mot de passe commun, celui passe dans `MOT_DE_PASSE`. Le meme sert a la suite API
(`SEED_MOT_DE_PASSE`), qui se connecte avec `admin` et `sbesson`.

**Pourquoi `sbesson` n'est pas un compte `.test`.** Le droit de chef de table n'est pas un
role : c'est `table_phoning.chef_utilisateur_id`, et le seed reecrit cette colonne depuis le
fichier source a chaque passage — un compte de test greffe la serait efface au prochain
`npm run seed`. Fabriquer une table de test aurait par ailleurs demande d'inventer des
affectations, donc de fausser les totaux que la recette doit retrouver a l'unite. Le script
aligne donc seulement le mot de passe de `sbesson`, chef reel issu du fichier.

**Septembre 2026 ne porte aucune table** : le perimetre « table » ne s'eprouve donc que sur
juin, jusqu'au module B. L'ecran de saisie ouvre automatiquement sur une campagne ou le
compte a un perimetre, et annote les autres dans le selecteur.

Les 5 comptes `.test` ne doivent **jamais** exister sur le serveur. Le suffixe est la pour
qu'ils sautent aux yeux.

`admin` reste le compte du seed. Pour changer un mot de passe individuellement :
`MOT_DE_PASSE="..." npm --prefix backend run mot-de-passe -- admin`. Sans argument, le script
liste les comptes existants.

---

### Bloquant avant la mise en service

1. **Restreindre les marques des vendeurs VN.** Une seule dimension reste a saisir, et non
   deux : le metier VN/VO vient du fichier (72 VN / 27 VO, apparies sur les 99 noms). Les
   **marques**, elles, n'y sont pas — le fichier donne une activite (`REN 0 / DAC 20`), pas
   une autorisation, et on ne le deduit pas. L'outil existe (ecran Vendeurs : import par
   collage, cases a cocher, metier et marques dans le meme enregistrement).

   **Ce n'est plus suivi par un compteur** : la jauge « x/72 » et sa route ont ete retirees le
   31/08/2026 sur decision de l'utilisateur. Tant qu'un vendeur reste bi-marque, R-C.1 ne le
   restreint pas — c'est un fait, pas une dette a afficher.
2. **Dates reelles de la campagne de septembre.** Le seed pose jeudi 10 au lundi 14 septembre
   2026 en placeholder, par analogie avec juin ; l'ecran Campagnes les modifie en quelques
   secondes.

Les jours de juin 2026 sont confirmes : la campagne couvrait bien un week-end, dimanche
compris. Voir `BUGS-CONNUS.md` — et la consequence generale, qui est que **les jours d'une
campagne sont libres**.

### Lotissement

| Jour | Contenu | Etat |
|---|---|---|
| J1 | Socle : base, migrations, garde-fous, seed, auth, front minimal | **fait** |
| J2 | Ecran A3-marques (collage Excel) + ecran A4-campagne | **fait** |
| J3 | Module C — grille de saisie, clavier, socket.io | **fait** |
| J4 | Ecran Vendeurs : archivage, purge, tri, recherche | **fait** |
| J5 | Module B — tables, glisser-deposer, repartition graine 42 | **fait** |
| J6 | Module D — socle d'agregats, dashboard, export, panneaux live | **fait** |
| J6+ | Passe UX, encadrants comme comptes, ecran Comptes, 4 paliers | **fait** |
| J7 | v1 en ligne : depot GitHub, Supabase, Cloudflare, sauvegardes | **fait** |

Etat de J7 au 01/09/2026. **La voie du VPS a ete abandonnee** le 31/08/2026 (« Gearbox
reste Gearbox », et `grid.bonyauto-mobile.com` n'existe pas en DNS) : Docker, Caddy,
nginx et `scripts/sauvegarde.sh` ont ete ecrits, valides, puis supprimes le 01/09/2026.

| Etape | Etat |
|---|---|
| Renommage en GRID, logotype `public/grid.svg` | **fait** |
| Depot GitHub `MarketBony/GRID` (prive), pousse | **fait** |
| Projet Supabase `ganeczlhcprljuazldpp`, `eu-west-3` — 20 migrations, seed | **fait** |
| RLS, 13 RPC, diffusion Realtime — `test:rls` 87/87 sur les deux bases | **fait** |
| Front en ligne sur Cloudflare : `https://grid.bonyauto-mobile.workers.dev/` | **fait** |
| Edge Function `gerer-comptes` — creation de comptes depuis l'interface | **fait** |
| Les 14 comptes relies a Supabase Auth | **fait** |
| `keep-alive.yml` — une requete tous les 3 jours (pause a 7 jours) | **fait, vert en CI** |
| `backup.yml` — dump hebdomadaire + **epreuve de restauration** | **fait, vert en CI** |
| `invariants.yml` — interdit n.6, base neuve ET Supabase | **fait** |
| `DEPLOIEMENT.md` — runbook Supabase + Cloudflare | **fait** |
| Copie de sauvegarde **hors du depot** | a faire, et a ne pas oublier |
| Archiver les comptes `.test` sur Supabase avant la mise en service | **a faire** |
| Rotation des trois secrets exposes en conversation | **a faire, cote utilisateur** |

Hors perimetre avant la campagne : ecrans A1 (plaques) et A2 (sites), fournis par le seed
et stables en septembre.

**Point de bascule :** a J6 au soir, decision binaire sur les criteres de recette 3, 4
et 5 — septembre se saisit dans l'outil, ou dans l'Excel intact.

## Documents devenus obsoletes

| Fichier | Statut |
|---|---|
| `schema.sql` | Reference historique. Source de verite : `backend/prisma/schema.prisma` |
| `seed_referentiels.sql` | Reference historique. Source de verite : `backend/prisma/seed.ts` |
| `VIABILITE-FREEMIUM.md` | **Perime de bout en bout.** Il conclut sur Supabase Auth + Cloudflare Pages + crons GitHub : l'authentification est un JWT maison, l'hebergement est le VPS, et **Supabase a ete ecarte le 31/08/2026** — Postgres tourne sur le VPS. Ses V2 et V4 sont deja traites par les workflows de gearbox ; V3 (la region) n'a plus d'objet |

`CAHIER-DES-CHARGES.md` et `MODELE-DONNEES.md` restent des references valides, aux
arbitrages tranches pres consignes ci-dessus.
