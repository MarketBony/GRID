# ETAT-BACKEND — API, base, invariants

Mise a jour : 31/08/2026, apres la bascule sans serveur.

---

## 31/08/2026, soir — L'API a disparu, la base fait autorite

**Tout ce qui suit cette section decrit une API Express qui n'existe plus.** Le contenu
est conserve : il porte le raisonnement, les invariants et les pieges, dont la plupart
restent vrais. Mais les routes, le portail `campagneScope.ts` et `test:api` ont ete
remplaces par ce qui est decrit ici.

`backend/` ne conserve que `prisma/` : schema, migrations, seed, et les suites.

### Le portail, transcrit en SQL

| Objet | Role |
|---|---|
| `relance.utilisateur_courant()` | `auth.uid()` -> `utilisateur.id`, NULL si le compte est inactif ou archive. **Toutes les autres en dependent** |
| `relance.peut_administrer()` | `admin` ou `direction` |
| `relance.peut_gerer_utilisateurs()` | `admin` SEUL — la frontiere qui empeche `direction` de se promouvoir |
| `relance.campagne_ouverte(id)` | R-C.3 |
| **`relance.perimetre_saisie`** (vue) | **SOURCE DE VERITE UNIQUE du perimetre.** L'union des quatre origines, transcription de `vendeursSaisissables` |
| `relance.peut_saisir(vendeur, campagne)` | le meme perimetre en predicat — il LIT la vue, il ne le recalcule pas |
| `relance.rdv_agrege` (vue) | les RDV **sans `client` ni `commentaire`**. Remplace `redacterRdvs` : le nom ne peut pas sortir puisqu'il n'est pas dans la vue |

**Les deux vues contournent la RLS par construction** (pas de `security_invoker`) et
doivent donc porter elles-memes le filtre `utilisateur_courant() IS NOT NULL`. C'est un
defaut qui a ete introduit puis corrige le meme jour sur `rdv_agrege` — voir
`BUGS-CONNUS.md`.

### Trois verifications valent d'etre connues

**`SECURITY DEFINER` sur les fonctions du portail n'est pas un confort : c'est ce qui
casse la recursion.** `utilisateur_courant()` lit `utilisateur`, dont la politique appelle
`utilisateur_courant()`. En `security invoker`, Postgres detecte la recursion et refuse la
requete.

**Ecrire `(select relance.…())` dans une politique, jamais `relance.…()`.** Appelee
directement, la fonction est evaluee **une fois par ligne** ; enveloppee dans un
sous-select, Postgres la remonte en `InitPlan` et ne l'evalue qu'une fois par requete. Sur
1107 RDV, la difference se voit a l'ouverture du tableau de bord.

**La RLS filtre des LIGNES, jamais des COLONNES.** `password_hash` et `auth_uid` ne sont
protegeables que par un `GRANT SELECT (colonne, …)`. Consequence a respecter dans le
front : **ne jamais chainer un `.select()` sans liste de colonnes apres une ecriture sur
`utilisateur`** — un `INSERT ... RETURNING *` exige de lire toutes les colonnes et se
solde par un `42501` sur la table entiere, qui se diagnostique tres mal. Deux controles de
`test:rls` fixent la regle dans les deux sens.

### Les 13 RPC — ce que PostgREST ne sait pas faire

PostgREST n'a **pas de transaction cote client** : chaque appel HTTP est sa propre
transaction. Or le produit comptait onze chemins d'ecriture tout-ou-rien. Chaque fonction
ci-dessous porte une transaction et remplace exactement un `prisma.$transaction` :

`campagne_definir_jours` · `campagne_definir_creneaux` · `table_archiver` ·
`table_definir_vendeurs` · `session_appliquer_repartition` · `session_reprendre` ·
`utilisateur_definir_roles` · `utilisateur_definir_encadrement` · `utilisateur_purger` ·
`vendeur_creer` · `vendeur_modifier` · `vendeur_appliquer_import_marques` ·
`vendeur_purger`

**La graine 42 et le parseur d'import restent en TypeScript**, cote navigateur. Les
retranscrire en PL/pgSQL creerait une seconde implementation du meme algorithme, et le
jour ou les deux divergeraient on ne saurait plus laquelle fait foi. Le navigateur
CALCULE, la fonction ECRIT — atomiquement.

**`REVOKE ... FROM PUBLIC` n'est pas optionnel.** PostgreSQL accorde l'execution d'une
fonction a `PUBLIC` par defaut ; combine a `SECURITY DEFINER`, cela aurait rendu la purge
appelable avec la seule cle publique, sans aucun jeton. Les gardes internes
(`exiger_*`) et `poser_capacites` ne sont accordes a personne.

### Les suites

| Suite | Contrôles | Base |
|---|---|---|
| `test:garde-fous` | 33 | les deux |
| `test:rls` | **81** — politiques, colonnes, RPC, les deux portes de purge | les deux |
| `test:agregats` | 27 | en memoire |
| `test:repartition` | 20 | en memoire |
| `test:import` | 19 | en memoire |
| `comparer` | 9 categories d'objets, entre deux bases | les deux |

`test:rls` se fait passer pour un compte **exactement comme PostgREST** : `SET LOCAL ROLE
authenticated` puis `request.jwt.claim.sub`. Les politiques sont donc evaluees dans les
memes conditions qu'en production. Elle ne laisse **aucune trace** — chaque controle
tourne dans sa transaction, annulee, et les `auth_uid` sont poses dedans.

**Ce qu'elle ne couvre pas, et qu'elle imprime en fin d'execution** : la limite de lignes
de PostgREST, les reglages du tableau de bord Supabase, et l'Edge Function.

**Les assertions portent sur les codes SQLSTATE, jamais sur les messages.** Les messages de
PostgreSQL sont traduits : sur ce poste ils arrivent en francais, sur Supabase en anglais.
Une premiere version comparait des bouts de phrase et passait 46 controles au rouge en
changeant de machine, sans qu'aucune regle n'ait bouge.

---

## Arborescence

```
backend/
  prisma/
    schema.prisma            source de verite du modele
    migrations/              4 migrations, rejeu a blanc valide
    donnees-source.ts        genere par scripts/extraire-seed.mjs — NE PAS EDITER
    seed.ts                  seed idempotent
    tester-garde-fous.ts     18 tests des invariants de la base
  src/
    index.ts                 point d'entree ; le controle d'invariants precede le listen
    db.ts                    UNE instance de PrismaClient pour tout le processus
    auth/
      secret.ts              JWT_SECRET, refus de demarrer si absent ou trop court
      roles.ts               listes de valeurs valides — PAS de referentiel metier
      middleware.ts          authentifier(), signerJeton()
      garde.ts               avecDroits(), exigerAdmin() — gardes de route
      campagneScope.ts       LE PORTAIL — seule porte du cloisonnement
    middleware/errorHandler.ts
    realtime/index.ts        socket.io, salles par campagne, withEmitterContext
    routes/
      auth.ts                login, /moi
      referentiels.ts        GET /api/referentiels — tient l'interdit n.3
      vendeurs.ts            marques, import en deux temps, progression
      campagnes.ts           campagnes, jours, creneaux, sessions — R-A.2
      api.verif.ts           25 verifications de l'API (serveur en marche requis)
      saisie.ts              perimetre de saisie d'un chef — TOUT en un appel
      rdv.ts                 poser, corriger, archiver un RDV — R-C.2
    utils/
      json.ts                patch BigInt.toJSON — a importer en PREMIER
      publicUser.ts          projection publique, jamais de passwordHash
      presenceVendeur.ts     presence d'un vendeur pendant une campagne — source unique
      verifierInvariants.ts  controle code <-> base au demarrage
      importMarques.ts       parseur du collage — fonction PURE, sans Prisma
      importMarques.verif.ts 19 verifications du parseur
```

## Routes

| Route | Droit | Note |
|---|---|---|
| `POST /api/auth/login`, `GET /api/auth/moi` | — / authentifie | Message identique compte inconnu et mot de passe faux |
| `GET /api/referentiels` | compte actif | Plaques, sites, marques, vendeurs, **types de vehicule et modes** |
| `POST /api/vendeurs` | `admin` | Cree un vendeur AVEC ses capacites. Refuse un homonyme sur le meme site |
| `GET /api/vendeurs/archives` | `admin` | Le volet Archivage. Porte le NOMBRE DE RDV de chacun — ce qu'une purge detruirait |
| `POST /api/vendeurs/:id/archiver` | `admin` | La poubelle. La ligne disparait, ses RDV restent |
| `POST /api/vendeurs/:id/desarchiver` | `admin` | Reversible. Peut echouer si le site a recu un nouveau chef entre-temps |
| `DELETE /api/vendeurs/:id` | `admin` | **LA PURGE.** Definitive, RDV compris. Exige un vendeur DEJA archive et son nom exact en `confirmation` |
| `GET /api/utilisateurs` | **`admin` seul** | Les comptes, avec leurs rattachements et les tables qu'ils animent |
| `POST /api/utilisateurs` | **`admin` seul** | Cree un acces. Mot de passe rendu EN CLAIR une seule fois |
| `PATCH /api/utilisateurs/:id` | **`admin` seul** | Nom, palier, activation. Refuse de degrader le DERNIER admin |
| `POST /api/utilisateurs/:id/mot-de-passe` | **`admin` seul** | Reinitialisation |
| `DELETE /api/utilisateurs/:id` | **`admin` seul** | Purge. Refuse un compte qui explique encore une table ou un role |
| `PUT /api/utilisateurs/encadrement` | **`admin` seul** | Rattache — ou detache — un encadrant a un site |
| `PATCH /api/vendeurs/:id` | `admin` | Nom, site (= **transfert**, F-A3.5), chef de site, dates, marques, types |
| `POST /api/vendeurs/capacites/import/analyse` | `admin` | **N'ecrit rien** |
| `POST /api/vendeurs/capacites/import/appliquer` | `admin` | Tout ou rien, refuse un vendeur cite deux fois |
| `GET /api/campagnes` | compte actif | Porte `vendeursSaisissables` : ce que **l'appelant** peut saisir sur chaque campagne |
| `GET /api/campagnes/:id` | compte actif | Jours, creneaux, sessions |
| `PATCH /api/campagnes/:id` | `admin` | Libelle, dates, cloture |
| `PUT /api/campagnes/:id/jours` \| `/creneaux` | `admin` | **R-A.2** — 409 detaille puis choix |
| `PATCH /api/campagnes/:id/sessions/:sid` | `admin` | Mode et effectif cible |
| `GET /api/saisie/:campagneId` | perimetre du portail | **Le module C en UN appel** — voir ci-dessous |
| `POST /api/rdv` | perimetre du portail | **R-C.2** : case occupee -> 409 `CASE_OCCUPEE`, sauf `confirmation: true` |
| `PATCH /api/rdv/:id` | perimetre du portail | Client et commentaire SEULEMENT — deplacer un RDV, c'est archiver puis recreer |
| `POST /api/rdv/:id/archiver` | perimetre du portail | Interdit n.1 : pas de `DELETE` |
| `GET /api/dashboard/:campagneId` | compte actif | **Module D** — tous les axes, classements, totaux du jour, en UN appel |
| `GET /api/dashboard/:id/comparaison/:autreId` | compte actif | F-D.5, `?axe=` libre |
| `GET /api/tables/session/:sessionId` | `peutAdministrerSession` | **Module B** — tables, membres, RESERVE, ecart a la cible, chefs et marques possibles |
| `POST /api/tables/session/:sessionId` | idem | F-B.1 creer. Une table archivee du meme libelle est REACTIVEE |
| `PATCH /api/tables/:tableId` | idem | F-B.1 renommer · F-B.2 chef · specialisation sur une marque · `ordre` |
| `POST /api/tables/:tableId/archiver` | idem | F-B.1 dit « supprimer » : on ARCHIVE, membres rendus a la reserve |
| `PUT /api/tables/:tableId/vendeurs` | idem | F-B.3 composition. Reactivation plutot que recreation |
| `POST /api/tables/session/:sid/repartition-auto` | idem | F-B.5, **graine 42**. `remplacer` archive tout et refait |
| `POST /api/tables/session/:sid/reprendre` | idem | F-B.7. Ce qui ne peut pas suivre est REPORTE, jamais force |

Aucune route de suppression, sur aucune ressource.

### Module D — le dashboard est une COUCHE MINCE

Tout le calcul vit dans `utils/agregats.ts`, en **fonctions pures**. La route charge les
lignes, appelle ces fonctions, repond. Aucun `groupBy` SQL : un total calcule dans la route
serait un second endroit ou la regle vit, et les deux divergeraient — ce sont les deux
denominateurs de progression (99 contre 72) qui ont coexiste des semaines sans que rien ne le
signale.

`GET /api/dashboard/:id` porte aussi `rattachements` (site -> plaque, table -> plaque). Les
fonctions d'agregat restent pures : elles rendent des paniers par cle sans savoir qui contient
qui, donc c'est la route qui expose les liens dont les panneaux du module C ont besoin.

**Lecture ouverte a tout compte actif.** R-C.4 est traitee comme une regle d'ECRAN et non de
confidentialite : le module C ne liste que ta table, le dashboard montre tout. C'est ce qui
donne un objet au role Lecteur, et c'est ce que fait le fichier — l'onglet RANK est lisible
par tous. **Aucun nom de client ne sort d'ici** : les agregats ne portent que des nombres.

### Module B — la specialisation est DECLAREE

`table_phoning.marque_id`, nullable. `null` = table mixte, aucune contrainte : c'est le cas
normal et le seul observe en juin 2026.

Une premiere version la DEDUISAIT des membres presents. Sur la vraie session CENTRE de
septembre, la repartition rendait 11/8/10 au lieu de 10/10/9 : le premier vendeur tire au sort
dans une table vide fixait ses marques pour toujours. **La specialisation d'une table etait
decidee par le tirage au sort.** Detail dans `BUGS-CONNUS.md`.

La repartition (`utils/repartition.ts`) est **pure** et verifiee par `test:repartition` : meme
graine, meme composition, quel que soit l'ordre d'entree des vendeurs ET des tables.

### `GET /api/saisie/:campagneId` — le perimetre en un seul appel

Le chef ouvre l'ecran et doit avoir TOUT : ses vendeurs, les jours et creneaux de la
campagne, les sections de chacun, et les RDV deja saisis. F-C.1 demande que cliquer un nom
ouvre son planning « sans rechargement de page », ce qui suppose que tout soit deja la.

**La forme de la grille sort du serveur, pas du front.** Pour chaque vendeur, la liste de ses
`sections` : une par marque autorisee s'il est VN, **une seule sans marque** s'il est VO.
C'est la regle lue dans le fichier source — le site ALPINE n'a qu'une section, la plupart en
ont deux. Le front n'a aucune regle metier a rejouer.

Un compte sans perimetre sur cette campagne recoit un `message` explicite et non une erreur :
c'est le cas normal d'un chef de table de juin qui ouvre septembre. Les droits sont **par
campagne**.

**`type_vehicule` du RDV est lu sur le VENDEUR, jamais recu du client**, et un trigger impose
l'egalite. `rdv.type_vehicule` reste stocke bien qu'il soit deductible : le deriver ferait
bouger les totaux VN/VO d'une campagne **deja cloturee** des qu'un vendeur change de metier.

Evenements socket.io emis par salle de campagne : `rdv:cree`, `rdv:modifie`, `rdv:archive`,
**sans le nom du client**.

## R-A.2 traite par l'API, pas subi

La cle etrangere composite fait echouer en base le retrait d'un jour portant des RDV.
C'est le garde-fou, mais une erreur de contrainte n'est pas une interface. `PUT /jours` et
`PUT /creneaux` calculent donc l'impact **avant** d'ecrire, renvoient un `409` portant
`code: 'RDV_IMPACTES'` avec la liste des RDV groupes par jour et par vendeur, et attendent
une confirmation `{ mode: 'annuler' }` ou `{ mode: 'deplacer', vers }`.

**Les RDV archives comptent aussi**, et sont annonces separement. La cle etrangere porte
sur toutes les lignes de `rdv`, `archive_le` renseigne ou non : un RDV archive empeche donc
le retrait du jour exactement comme un RDV actif. Il est deplace avec les autres, mais
`3 RDV et 1 archive` est une information differente de `4 RDV`.

L'ordre des operations dans la transaction n'est pas negociable : creer les jours ajoutes,
**puis** deplacer les RDV — sinon la cle etrangere refuse la destination — **puis**
supprimer les jours retires, une fois vides.

## Import des marques

`utils/importMarques.ts` est une fonction **pure** : elle recoit le texte colle et les
referentiels, elle rend un apercu. Elle ne connait pas Prisma, d'ou 19 verifications sans
base ni serveur.

Le fonctionnement en **deux temps** — analyser, montrer, appliquer ce qui a ete valide —
n'est pas une commodite d'interface. Un import qui devine un homonyme attribue des marques
au mauvais vendeur, et le trigger R-C.1 refusera ensuite des RDV parfaitement legitimes :
on chercherait le defaut dans la saisie alors qu'il vient de l'import, des semaines plus
tot. Toute ambiguite est donc remontee, jamais tranchee.

Le rapprochement des noms se fait par **ensemble de mots trie**, accents retires :
`VALENTIN PARPINELLI` et `PARPINELLI VALENTIN` designent le meme vendeur. Verifie sur les
donnees reelles — les 99 vendeurs donnent 99 cles distinctes, donc aucun risque de
collision. Une colonne de code site leve les homonymies si un recrutement en cree un.

## Commandes

```bash
# Base locale (PostgreSQL 17 natif, service postgresql-x64-17)
psql -h localhost -U postgres -d relance

# Migrations — `migrate dev` refuse de tourner sans terminal interactif ici,
# d'ou le script maison qui fait le diff et ecrit le dossier :
node scripts/nouvelle-migration.mjs <nom_en_snake_case>
npm --prefix backend run migrate:deploy

# Seed (rejouable SANS EFFET sur ce qui existe deja — voir plus bas)
npm --prefix backend run seed
SEED_MOT_DE_PASSE=... npm --prefix backend run seed   # mot de passe fixe

# Garde-fous de la base (33) — chacun doit REFUSER quelque chose
npm --prefix backend run test:garde-fous

# Agregats (27) — fonctions pures, contre les 1107 RDV reels de juin
npm --prefix backend run test:agregats

# Repartition graine 42 (20) — fonction pure
npm --prefix backend run test:repartition

# Parseur d'import (19) — fonction pure, aucun prerequis
npm --prefix backend run test:import

# API (43) — exige le serveur en marche
SEED_MOT_DE_PASSE=... npm --prefix backend run test:api

# Changer un mot de passe / lister les comptes
MOT_DE_PASSE="..." npm --prefix backend run mot-de-passe -- admin
npm --prefix backend run mot-de-passe

# Comptes de test, un par perimetre (voir ETAT-PROJET.md). Idempotent.
MOT_DE_PASSE="..." npm run comptes-test

# Serveurs. `dev` passe par tsx et non ts-node, absent du projet : nodemon
# l'appelait par defaut et le script echouait, d'ou une API lancee a la main
# et donc SANS rechargement automatique.
npm --prefix backend run dev    # API sur 3001
npm run dev                     # front sur 3000, proxifie /api et /socket.io
                                # strictPort : refuse de demarrer plutot que de
                                # se rabattre silencieusement sur 3001

# Controles
npm --prefix backend run prisma:validate
cd backend && npx tsc --noEmit
npx tsc --noEmit                # front
```

## Autorisation — le portail

**`src/auth/campagneScope.ts` est la seule porte par laquelle un cloisonnement
s'applique. Aucune route ne recopie une clause de perimetre.** Meme statut que
`siteScope.ts` sur GEARBOX, et pour la meme raison : une regle de perimetre dupliquee
dans les ecrans a fait diverger Budget et Dashboard quatre fois.

Il n'y a **pas de RLS**. Prisma se connecte avec le role proprietaire des tables, qui la
contournerait de toute facon. Ce fichier est donc la seule chose entre un jeton et les
donnees d'une autre plaque. Il n'a pas de filet.

Fonctions :

| Fonction | Role |
|---|---|
| `chargerDroits(utilisateurId)` | Trois requetes, une fois par requete HTTP. Compte inactif ou archive -> droits vides |
| `peutLire` / `peutAdministrer` | Lecture pour tout compte actif ; administration pour `admin` |
| `campagneOuverte(campagneId)` | R-C.3 |
| `vendeursSaisissables(droits, campagneId)` | Union des quatre origines de droit, filtree par la presence du vendeur pendant la campagne |
| `peutSaisirVendeur(...)` | Bati SUR `vendeursSaisissables` — jamais une seconde clause a cote |
| `peutAdministrerSession(...)` | Composition des tables (module B) |
| `redacterRdvs(rdvs, autorises)` | Retire `client` et `commentaire` hors perimetre |

Le jeton ne porte **que l'identite** (`id`, `loginId`). Divergence assumee avec GEARBOX,
qui y met le role : ici les droits sont par campagne et changent pendant une campagne —
un chef de plaque qui recompose une table modifie les droits d'un chef de table en pleine
session. Un role grave dans le jeton serait perime au moment ou il compte.

**Regle d'ecran vs confidentialite.** R-C.4 (« un chef de table ne voit que les vendeurs
de sa table ») est une regle d'ecran : les compteurs sont lisibles par tous, sinon aucun
classement n'est calculable et le role Lecteur n'a plus d'objet. En revanche le **nom du
client** n'est pas public — c'est ce que `redacterRdvs` protege.

### Garde-fous herites de GEARBOX, chacun paye par un incident

- Toute route d'ecriture **sans controle de role** est une porte ouverte (cas d'`/api/uploads`).
- **Filtrer les lignes ne suffit pas**, il faut redacter leur contenu.
- Un role en lecture seule l'est **par absence** de toute liste d'ecriture. Ne jamais y
  ajouter `lecteur` « pour faire propre ».
- **Un role ne se verifie pas sans parcourir son interface** avec un vrai compte. Des
  controles d'API exacts ont laisse passer deux fois une navigation complete.

## Invariants — section citee par le message d'erreur de demarrage

Les listes de valeurs valides existent **deux fois** : dans `src/auth/roles.ts` et en
contraintes CHECK dans la migration `invariants`. PostgreSQL ne peut pas importer du
TypeScript, la duplication est inevitable.

Ce qui ne l'est pas, c'est de la laisser « a synchroniser a la main ».
**`utils/verifierInvariants.ts` compare les deux au demarrage du serveur et refuse de
demarrer si elles divergent**, en nommant la liste en cause. Verifie : ajouter une valeur
d'un seul cote empeche le boot.

Difference volontaire avec `scripts/check-plaques-sync.mjs` de GEARBOX : pas de script
separe a penser a lancer, pas de branchement `predev`/`prebuild` a maintenir. Le controle
est dans le chemin de demarrage, il ne peut pas etre contourne par oubli.

**Pour ajouter une valeur :** l'ajouter dans `roles.ts` ET dans une nouvelle migration qui
remplace la contrainte CHECK. Le serveur refusera de demarrer entre les deux, ce qui est
le comportement voulu.

## Ce que Prisma ne gere pas, et pourquoi c'est sans danger

| Objet | Gere par Prisma ? | Consequence |
|---|---|---|
| Contraintes CHECK | Non, il ne les voit pas | Survivent aux migrations. Aucun risque de suppression |
| Triggers et fonctions | Non | Idem |
| Index et uniques | **Oui** | C'est pourquoi il n'y a **aucun index partiel** : Prisma proposerait de le supprimer a chaque migration |
| Cles etrangeres composites | **Oui** | R-A.2 est donc exprime nativement dans `schema.prisma`, sans SQL brut |

Verifie empiriquement :
`prisma migrate diff --from-schema-datasource --to-schema-datamodel` renvoie
« empty migration » — **zero derive** malgre les 9 CHECK et 13 triggers.

### Ecart assume : `BIGSERIAL` au lieu de `generated always as identity`

`CLAUDE.md` demande `bigint generated always as identity`. Prisma ne sait pas exprimer
les colonnes d'identite et emet `BIGSERIAL`. Forcer l'identite a la main creerait une
derive permanente — exactement le piege qu'on evite pour les index. L'intention de la
convention (cle primaire bigint auto-generee) est tenue ; seule la syntaxe differe. Le
seul comportement perdu est le refus d'une insertion d'`id` explicite, ce que le code ne
fait jamais.

### Consequence des `bigint` : les identifiants sont des CHAINES cote API

`JSON.stringify` leve une exception sur un `BigInt`. `utils/json.ts` patche
`BigInt.prototype.toJSON` et doit etre **importe en premier** dans `index.ts` : sans lui,
la premiere route qui renvoie un enregistrement echoue avec une 500 opaque.

Les identifiants arrivent donc au front en chaine, jamais en nombre. `types.ts` les type
en `string`. Ne jamais comparer un id a un nombre litteral.

## Triggers en place

| Trigger | Regle |
|---|---|
| `affectation_unique_par_campagne` | R-B.4 — un vendeur, une seule table par campagne |
| `rdv_marque_autorisee` | R-C.1 — marque autorisee pour ce vendeur |
| `rdv_type_vehicule_autorise` | R-C.1 etendue — VN/VO autorise pour ce vendeur |
| `rdv_campagne_ouverte` | R-C.3 — rien sur une campagne cloturee ou archivee |
| `*_pas_de_delete` (10 tables) | Interdit n.1 — suppression impossible, pas seulement interdite |

`campagne_jour` et `campagne_creneau` sont volontairement **hors** de la liste
anti-suppression : les retirer est legitime (F-A4.2, F-A4.3), et c'est la cle etrangere
composite de `rdv` qui refuse l'operation quand des RDV en dependent. Les interdire
empecherait de corriger un creneau sur une campagne encore vide.

Les messages sont prefixes `RELANCE:` et `middleware/errorHandler.ts` les renvoie en 422
avec leur texte, pour que le chef de table lise la raison du refus.

## Sources de verite uniques

A ne jamais recopier ailleurs :

| Fichier | Regle |
|---|---|
| `auth/campagneScope.ts` | Tout perimetre |
| `utils/presenceVendeur.ts` | Presence d'un vendeur pendant une campagne — utilisee par le portail ET par l'effectif du dashboard |
| `utils/publicUser.ts` | Projection d'un utilisateur, jamais de `passwordHash` |
| `auth/roles.ts` | Listes de valeurs valides |
| `utils/agregats.ts` | **Tous les totaux, classements et moyennes du produit.** Fonctions pures, verifiees contre les 1107 RDV reels de juin |
| `utils/repartition.ts` | La repartition automatique, graine 42. Pure |
| `utils/messageTrigger.ts` | Le decoupage du message d'un trigger PostgreSQL. Existait en deux exemplaires qui ne decoupaient pas pareil |
| `routes/vendeurs.ts` — `calculerProgression()` | Le compteur de progression |
| `routes/saisie.ts` — le calcul des `sections` | La forme de la grille d'un vendeur |
| `routes/vendeurs.ts` — `calculerProgression()` | Le compteur de progression. Deux implementations divergeaient d'un denominateur (99 contre 72) sans que rien ne le signale, parce que l'ecran n'appelait que l'une des deux |
| `routes/saisie.ts` — le calcul des `sections` | La forme de la grille d'un vendeur |

`presenceVendeur.ts` merite une explication : `schema.sql` comptait l'effectif d'un site
avec `date_sortie is null`, c'est-a-dire les presents **aujourd'hui**, tout en
additionnant les RDV de **tous** les vendeurs. La moyenne RDV/vendeur d'une campagne
passee changeait donc des qu'un vendeur partait. C'est le bug `RANK!AG` du fichier Excel
par un autre chemin. La bonne question n'est pas « ce vendeur est-il encore la ? » mais
« etait-il la **pendant** cette campagne ? ».

## LES ENCADRANTS SONT DES COMPTES — la notion la plus facile a se tromper

Je m'y suis trompe le 31/08/2026, en faisant du chef de site et du chef de vente deux
DRAPEAUX sur `vendeur`. Ca cassait le coeur de l'exercice :

> « Je mets 5 vendeurs de 5 concessions differentes, et un chef de vente en chef de
> table d'une AUTRE concession pour les coacher. »

Avec un drapeau sur `vendeur`, le selecteur ne pouvait proposer que les vendeurs du
site courant : la mixite etait litteralement inexprimable.

| Rattachement | Table | Portee |
|---|---|---|
| Encadrant -> site | `encadrement_site` | **durable**, hors campagne |
| Chef de table -> table | `table_phoning.chef_utilisateur_id` | **une** campagne |

Un meme compte peut encadrer plusieurs sites ET animer une table sur une troisieme
plaque. Un vendeur qui est aussi encadrant existe des deux cotes, relie par
`vendeur.utilisateur_id`.

### Les quatre paliers, et la seule frontiere qui compte

| Palier | `peutAdministrer` | `peutGererUtilisateurs` | `vendeursSaisissables` |
|---|---|---|---|
| `admin` | oui | **oui** | tous |
| `direction` | oui | non | tous |
| aucun role | non | non | ses sites + ses tables |
| `lecteur` | non | non | aucun |

`peutAdministrer` accepte `admin` ET `direction` — d'ou le renommage de `exigerAdmin` en
`exigerAdministration`, un nom qui disait « admin » aurait laisse croire le contraire.

`peutGererUtilisateurs` n'accepte que `admin`. **Sans cette frontiere, `direction`
pourrait se promouvoir `admin`** — c'est le scenario que GEARBOX a du fermer en
interdisant a Director d'attribuer Director.

### Quatre origines de perimetre, reunies en UN endroit

`vendeursSaisissables` fait l'union de :

1. chef de plaque, pour cette campagne ;
2. chef de site pour cette campagne (`role_campagne`, exception ponctuelle) ;
3. **encadrant d'un site, durablement** — vaut pour toutes les campagnes ;
4. chef de table, pour cette campagne.

Les origines 2 et 3 se recouvrent volontairement : l'une est temporaire, l'autre
durable. L'union etant faite dans une seule fonction, aucun risque de divergence.

## L'interdit n.1 et sa porte de purge

**Par defaut, aucun `DELETE` ne passe, sur aucune table.** `interdire_suppression()`
refuse, et c'est le comportement par defaut y compris sur une connexion neuve —
`current_setting(..., true)` rend `NULL` quand le parametre n'a jamais ete pose.

Il existe UNE porte, nommee, ouverte pour la duree d'UNE transaction :

```sql
SET LOCAL relance.purge_autorisee = 'oui';
```

`SET LOCAL` meurt avec la transaction. La porte ne peut donc pas rester ouverte par
oubli, et **aucune autre session n'est affectee** — contrairement a un
`ALTER TABLE ... DISABLE TRIGGER`, qui aurait desarme le garde-fou pour tout le
monde, y compris pendant une session de saisie.

Seul appelant legitime : `DELETE /api/vendeurs/:id`, derriere le volet Archivage,
sur un vendeur **deja archive**, avec son nom exact retape. Trois obstacles
deliberes pour la seule operation du produit qui detruit de l'historique.

`test:garde-fous` couvre **les deux moities** : le refus par defaut, ET l'ouverture
sur demande. Verifier une seule des deux laisserait passer soit un garde-fou
desarme, soit une purge impossible.

## Archivage : trois notions distinctes sur `vendeur`

| Colonne | Sens | Effet sur les totaux passes |
|---|---|---|
| `date_sortie` | La personne a quitte l'entreprise. Donnee METIER | Aucun : elle reste comptee dans les campagnes qu'elle a vecues |
| `archive_le` | Cette ligne n'a plus a apparaitre | Aucun : ses RDV restent en base |
| purge | Destruction definitive | **Les totaux changent.** Irreversible |

`archive_le` est filtre dans `utils/presenceVendeur.ts`, avec la presence : un
vendeur archive ne doit apparaitre NULLE PART — ni saisie, ni tables, ni dashboard,
ni effectif. Le mettre la plutot que de le recopier dans cinq requetes evite qu'un
ecran l'oublie.

## La notion de « confirme » a ete retiree

Une route `GET /api/vendeurs/capacites/progression` et une jauge distinguaient une
donnee validee par un humain du placeholder pose par le seed. **Retirees** sur
decision de l'utilisateur : un vendeur present en base est valide, point.

Les colonnes `capacites_confirmees_le/par` restent, renommees
`capacitesModifieesLe/Par` cote Prisma, comme **provenance** : savoir qui a change
les marques d'un vendeur et quand est utile le jour ou un RDV est refuse et que
personne ne comprend pourquoi. Elles ne portent plus aucun statut.

## Le tri des libelles ne passe PAS par la base

`backend/src/utils/tri.ts` — **source de verite unique** du tri des libelles cote backend.

`order by nom asc` en SQL trie selon la collation de la base, qui n'est pas la meme en
developpement (`French_France.1252`) et dans le conteneur de production (`en_US.utf8`) :
sur les 101 vendeurs reels, cinq noms accentues changent de place. Les quatre routes qui
rendent une liste de personnes trient donc **en JavaScript** :

| Route | Liste |
|---|---|
| `GET /api/saisie/:campagneId` | les vendeurs du perimetre — la liste du module C |
| `GET /api/referentiels` | les vendeurs, et les encadrants disponibles |
| `GET /api/tables/session/:id` | la reserve, et les chefs de table possibles |
| `GET /api/dashboard/:campagneId` | les vendeurs des agregats |

`agregats.ts` importe la meme cle pour son departage des ex aequo. **Toute nouvelle route
qui rend une liste de personnes doit trier avec `trierPar`** : le `orderBy` de Prisma est
conserve comme pre-tri, il ne decide pas.

Consequence utile : la collation de la base de production n'a plus aucun effet sur ce que
voit l'utilisateur, et le choix d'image Postgres n'est plus une decision de produit.

## Un seul vivier de personnes, deux selecteurs

Les encadrants sont des **comptes**, et le meme vivier alimente deux ecrans :

- l'encadrement d'un site (ecran Vendeurs) — `GET /api/referentiels`, champ
  `encadrantsDisponibles` ;
- le chef d'une table (ecran Tables) — `GET /api/tables/session/:id`, champ
  `chefsPossibles`.

**Les deux appliquent le meme filtre : tous les comptes actifs et non archives, sauf ceux
qui portent le role `lecteur`.** Aucune restriction de plaque ni de site : composer des
groupes heterogenes, avec un coach venu d'une autre concession, est le but de l'exercice.

Les deux reponses portent, pour chaque compte, ses `encadrements` (`role` + `siteCode`) et
ses `rolesGlobaux`, de quoi ordonner l'affichage. `chefsPossibles` ajoute `deLaPlaque`, vrai
quand le compte encadre au moins un site de la plaque de la session. **Ces champs servent
l'ordre de lecture, jamais un refus.**

Ces deux filtres avaient diverge — le second exigeait un rattachement prealable, ce qui
rendait un compte neuf inattribuable comme chef de table. Voir `BUGS-CONNUS.md`. Toute
evolution de l'un doit toucher l'autre.

## Le seed n'ecrase pas ce qui existe

Regle, et pas seulement une propriete du code : **le seed etablit un etat initial, il ne se
bat pas avec les modifications de l'utilisateur.** L'idempotence ne suffit pas — rejouer le
seed doit etre *sans effet*, pas seulement *sans doublon*.

Ce qui l'a rendue explicite : `creerCampagne` faisait un `upsert` de chacun des jours de la
campagne, donc reposait ses cinq jours de placeholder par-dessus les cinq jours corriges a
la main. Septembre s'est retrouvee a **neuf jours** apres un simple `npm run seed`.

Comportement actuel, par entite :

| Entite | Rejeu du seed |
|---|---|
| Marques, plaques, sites | `upsert` — le referentiel structurel est realigne sur la source |
| Vendeurs | `findFirst` puis `update` du seul type VN/VO ; jamais de doublon |
| Marques d'un vendeur | `upsert`, sauf pour un VO dont les lignes sont retirees |
| **Campagne existante** | **rien** : ni dates, ni jours, ni creneaux. Seules les sessions par plaque manquantes sont creees |
| Campagne absente | creee entierement, en `create` et non `upsert` — une collision inattendue echoue bruyamment |
| Sessions par plaque | `upsert` avec `update: {}` : un mode change a la main n'est pas remis |
| Mots de passe | `upsert` avec `update: {}` : un rejeu ne reinitialise aucun acces |

## Pas de route de seed

GEARBOX porte un `/api/seed` desactive a dessein, avec la consigne de ne jamais le
rappeler en production parce qu'il reinitialise les mots de passe. Ici le seed est un
script CLI : il n'existe **aucune surface HTTP** pour le declencher, donc aucune consigne
a respecter.
