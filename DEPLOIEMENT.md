# DEPLOIEMENT — GRID sur Supabase et Cloudflare Workers

Mise a jour : 03/09/2026, **apres** la reparation du deploiement. Ce document decrit ce
qui a reellement tourne, pas ce qui etait prevu.

**Ce fichier disait « Cloudflare Pages » partout, et c'etait faux** : le projet est un
projet **Workers** avec assets statiques. Ca n'etait pas un detail de vocabulaire — un
projet Workers execute une commande de deploiement qui exige une configuration dans le
depot, et il n'y en avait aucune. Voir la section « Le front sur Cloudflare ».

Il remplace integralement le runbook VPS precedent. Le VPS de gearbox a ete remis dans son
etat d'origine : **il ne reste aucune trace de GRID dessus**, et c'est une exigence de
l'utilisateur, pas une preference — « Gearbox reste Gearbox ».

---

## L'architecture, en trois lignes

- **Front statique** sur Cloudflare Workers (assets seuls, aucun code serveur). Il porte
  une cle publique et attaque Supabase en direct.
- **Base et API** : Supabase. PostgREST pour les lectures et les ecritures simples,
  13 fonctions `security definer` pour tout ce qui doit etre transactionnel.
- **Aucun serveur applicatif.** L'autorisation est portee par la RLS, et **elle n'a aucun
  filet** — c'est l'interdit n.4 dans sa troisieme formulation.

Ce qui a ferme les autres voies, pour memoire : `grid.bonyauto-mobile.com` **n'existe pas
en DNS** et la zone Gandi n'est pas accessible ; et la CSP de `www.bonyauto-mobile.com` ne
declare qu'un `default-src`, donc une page Elementor s'executerait mais le navigateur
refuserait chaque appel a la base.

---

## Le projet Supabase

| | |
|---|---|
| Nom | Grid |
| Reference | `ganeczlhcprljuazldpp` |
| Region | **`eu-west-3` (Paris)** — donnees de concessionnaires francais |
| PostgreSQL | 17.6 |
| URL | `https://ganeczlhcprljuazldpp.supabase.co` |

### Les reglages qui ne vont pas de soi

Trois d'entre eux etaient **dangereux par defaut**. Les revoir apres toute recreation de
projet, dans *Settings > API* et *Authentication > Providers*.

| Reglage | Defaut | Valeur retenue | Pourquoi |
|---|---|---|---|
| `db_schema` | `public,graphql_public` | `public,graphql_public,relance` | **Sans `relance`, aucune requete ne passe.** PostgREST n'expose que ce qu'on lui nomme |
| `max_rows` | **1000** | 5000 | Juin 2026 compte **1107 RDV**. La troncature est SILENCIEUSE et fausserait les totaux — exactement le defaut de l'Excel que le produit remplace. Le front pagine quand meme : un reglage de tableau de bord n'est pas une garantie |
| `disable_signup` | **`false`** | `true` | **N'importe qui pouvait se creer un compte** avec la cle publique. La RLS tenait, mais la porte n'avait aucune raison d'etre ouverte |
| `mailer_autoconfirm` | `false` | `true` | Nos adresses sont de synthese (`<loginId>@grid.bonyauto-mobile.com`) et n'existent pas : sans autoconfirmation, **aucun compte ne peut se connecter** |
| `password_min_length` | 6 | 12 | — |

### Les cles, et lesquelles sont des secrets

| Cle | Secret ? |
|---|---|
| URL du projet, `publishable key` | **non** — publiques par conception, elles partent dans le bundle. C'est la RLS qui protege |
| `secret key` (`service_role`) | **oui.** Contourne toute la RLS. Ne doit **jamais** se trouver dans le navigateur. Les Edge Functions la recoivent d'office dans leur environnement : il n'y a aucune raison de la copier ailleurs |
| `access token` (`sbp_…`) | **oui, et c'est le plus large** : il porte sur le COMPTE entier, gearbox compris |
| Mot de passe de la base | **oui** |

---

## Deployer le schema

`backend/.env.supabase` porte les chaines de connexion. Il est ignore par git ; le modele
versionne est `backend/.env.supabase.example`.

**Le mot de passe ne doit jamais etre passe en argument** — les arguments d'un processus
sont lisibles par les autres processus de la machine et restent dans l'historique du
terminal. On charge le fichier dans l'environnement, sans l'afficher :

```bash
set -a; . ./backend/.env.supabase; set +a
export DATABASE_URL="$DIRECT_URL"
```

### Les deux chaines, et pourquoi on s'y trompe

`DIRECT_URL` vise le pooler en mode **session** (port 5432) ; `DATABASE_URL` le mode
**transaction** (6543). Les migrations et tout ce qui ouvre une transaction interactive —
le seed, `test:garde-fous`, `test:rls` — **exigent le mode session**. Le mode transaction
ne porte pas de transaction longue, et s'y tromper ne donne pas une erreur claire : la
migration part puis se bloque ou echoue au milieu, ce qui est le pire moment.

D'ou le `export DATABASE_URL="$DIRECT_URL"` ci-dessus, systematique.

**L'hote du pooler n'est pas devinable.** Il est en `aws-1-eu-west-3` et non `aws-0` — et
`aws-0` existe, repond au TCP, mais ne connait pas ce projet. Le demander plutot que le
supposer :

```bash
curl -s "https://api.supabase.com/v1/projects/$REF/config/database/pooler" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Amorcer les comptes

Aucun compte ne peut se connecter tant qu'il n'a pas d'identite Supabase Auth. Il faut
donc creer le PREMIER en ligne de commande — l'Edge Function, elle, exigera un appelant
`admin` deja connecte.

```bash
npm --prefix backend run comptes-auth                       # qui est relie, qui ne l'est pas
MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- admin
```

L'adresse est une SYNTHESE : `<loginId>@grid.bonyauto-mobile.com`. **Ce domaine ne recoit
rien** — aucun message ne partira jamais vers ces adresses, et c'est pourquoi la
confirmation d'e-mail est desactivee. L'ecran de connexion demande un IDENTIFIANT ; la
composition de l'adresse est enfermee dans `services/api.ts`.

Minimum de 12 caracteres, impose par le reglage du projet.

### La sequence

```bash
# 1. Verifier OU l'on est. Se tromper de base, c'est migrer dans le vide en
#    croyant avoir deploye.
#    `supabase_admin` n'existe que sur Supabase.
npm --prefix backend run comparer -- "<url locale>"   # affiche les deux cibles en tete

# 2. Migrations
npm --prefix backend run migrate:deploy

# 3. Prouver ce qui est REELLEMENT arrive — pas se fier au « successfully applied ».
npm --prefix backend run comparer -- "<url locale>"
#    9 categories : tables, colonnes, CHECK, triggers, fonctions, vues,
#    politiques, index, migrations. Doit finir sur « Aucun ecart. »

# 4. Seed, idempotent
npm --prefix backend run seed

# 5. Les suites, SUR SUPABASE. Une suite verte en local ne dit rien de la production.
npm --prefix backend run test:garde-fous   # 39/39
npm --prefix backend run test:rls          # 89/89
npm --prefix backend run test:invariants   # 10/10
```

### Ce qui a reellement tourne le 31/08/2026

```
17 migrations appliquees  ·  comparaison des deux bases : AUCUN ECART
  17 tables · 144 colonnes · 11 CHECK · 28 triggers · 35 fonctions
  2 vues · 48 politiques · 35 index

seed : 4 plaques · 19 sites · 99 vendeurs · 142 capacites · 2 campagnes
       8 sessions · 8 tables · 48 affectations

Supabase : garde-fous 33/33 · rls 81/81
Local    : garde-fous 33/33 · rls 81/81 · agregats 27/27
           repartition 20/20 · import 19/19
```

### Le controle qui compte le plus

Le front est public : la cle `anon` est lisible par quiconque ouvre les outils de
developpement. **A refaire apres toute modification des politiques.**

```bash
K="<publishable key>"; U="https://ganeczlhcprljuazldpp.supabase.co/rest/v1"
curl -s "$U/vendeur?select=nom&limit=3"    -H "apikey: $K" -H "Accept-Profile: relance"
curl -s "$U/rdv?select=client&limit=3"     -H "apikey: $K" -H "Accept-Profile: relance"
curl -s "$U/rdv_agrege?select=id&limit=3"  -H "apikey: $K" -H "Accept-Profile: relance"
curl -s -X POST "$U/rpc/vendeur_purger" -H "apikey: $K" -H "Content-Profile: relance" \
     -H "Content-Type: application/json" -d '{"p_vendeur_id":1,"p_confirmation":"x"}'
```

Les quatre doivent repondre :

```json
{"code":"42501","message":"permission denied for schema relance"}
```

Un refus **franc** — une erreur de droits — et non un silencieux « zero ligne ». C'est
voulu : `anon` n'a meme pas l'usage du schema. Une fuite se voit, un ecran vide s'explique.

---

## Le front sur Cloudflare

| | |
|---|---|
| Depot | `MarketBony/GRID` |
| Type de projet | **Workers** avec assets statiques — pas Pages |
| Nom du Worker | `grid` (d'ou `grid.bonyauto-mobile.workers.dev`) |
| URL | `https://grid.bonyauto-mobile.workers.dev` |
| Commande de build | `npm run build` |
| Repertoire de sortie | `dist`, declare dans `wrangler.jsonc` |
| Variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, versionnees dans `.env.production` |

HTTPS et nom de domaine sont fournis par Cloudflare — c'est precisement ce qui rend ce
chemin possible sans acces DNS.

### `wrangler.jsonc` est OBLIGATOIRE, et il a manque

**Symptome, le 03/09/2026 :** le build reussit — journal Cloudflare, « Success: Build
command completed » — et l'etape **Deploiement** echoue 12 secondes plus tard, deux fois
de suite. Rien n'est mis en ligne, et **la production reste debout sur la version
precedente** : verifie, l'ancien bundle etait toujours servi.

Cause. Cloudflare Workers Builds n'utilise pas « repertoire de sortie » comme Pages : il
execute une commande de deploiement, qui differe selon la branche.

| Branche | Commande | Effet |
|---|---|---|
| autre que la production | `npx wrangler versions upload` | televerse une version **sans la deployer** |
| production (`master`) | `npx wrangler deploy` | met en ligne |

Les deux exigent une configuration **dans le depot**, et il n'y en avait aucune.
Reproduit a l'identique en local, sans rien deployer :

```bash
npx wrangler versions upload --dry-run
# -> Missing entry-point: ... create a "wrangler.jsonc" file containing ...
```

Wrangler dicte lui-meme le remede : c'est `wrangler.jsonc`, a la racine, et le fichier
porte le detail de chacun de ses quatre reglages.

**A verifier avant de croire un deploiement :** les deux commandes valident en dry-run
sans toucher au reseau.

```bash
npm run build
npx wrangler deploy --dry-run          # doit lire les fichiers de dist
npx wrangler versions upload --dry-run
```

**Le piege du nom.** `name` designe le Worker a mettre a jour. Se tromper ne casse rien —
c'est pire : `wrangler deploy` CREERAIT un second Worker a une autre adresse, laissant
l'ancien en ligne avec l'ancienne version. Deux GRID, et celui que tout le monde consulte
ne bougerait plus.

**Consequence pour le lotissement :** pousser une branche de travail ne met rien en ligne,
meme quand le deploiement reussit — `versions upload` ne deploie pas. Il faut atteindre
`master`.

### Verifier un lot AVANT de le mettre en ligne — l'URL d'apercu de branche

Le journal du deploiement reussi donne deux URL, et la seconde est la plus utile :

```
Uploaded grid (2.94 sec)
Version Preview URL:       https://<id-court>-grid.bonyauto-mobile.workers.dev
Version Preview Alias URL: https://<nom-de-branche>-grid.bonyauto-mobile.workers.dev
```

**C'est ce qui permet d'eprouver le lot REELLEMENT DEPLOYE, sur le vrai Supabase, sans
toucher a la production.** Mesure du 03/09/2026, les deux cotes en meme temps :

| | bundle servi | `overflow-x` de la racine |
|---|---|---|
| `feat-deux-rdv-par-case-grid…` | `index-kKDBZhWj.js` — le lot | `clip` |
| `grid.bonyauto-mobile.workers.dev` | `index-BMYtM9_z.js` — l'ancien | `hidden` |

Le repli SPA se controle sur cette meme URL : `/une/route/inexistante`, `/saisie` et `/`
doivent tous rendre `200 text/html` portant `index.html`.

`Uploaded grid` confirme au passage que le `name` du fichier designe bien le Worker
existant. Si le nom etait faux, cette ligne nommerait un autre Worker — c'est la
verification a lire en premier.

### Mettre une version en ligne

`versions upload` televerse sans deployer ; la production continue de servir la version
precedente. Deux chemins :

- **atteindre `master`** — Workers Builds utilise `wrangler deploy` sur la branche de
  production. **A confirmer une fois** : le tableau de bord n'affiche qu'une commande de
  deploiement, et celle qu'on y lit est celle du build courant ;
- **promouvoir la version deja televersee** : `wrangler versions deploy`, ce que le
  journal indique lui-meme.

### Les variables sont VERSIONNEES — il n'y a rien a regler cote Cloudflare

`.env.production`, a la racine, porte les deux valeurs et **est committe**. Le build est
donc reproductible partout, sans aucun reglage d'hebergeur a refaire.

Ce n'est pas un relachement : ces deux valeurs partent de toute facon dans le bundle,
lisibles par quiconque ouvre les outils de developpement. Les cacher dans un tableau de
bord n'apportait rien en securite — c'est la RLS qui protege — mais ajoutait une facon de
casser le deploiement.

**Ce qui n'a rien a faire dans ce fichier** : la cle `service_role` et le mot de passe de
la base. Ils vivent dans `backend/.env.supabase`, ignore par git, et ne doivent jamais
porter le prefixe `VITE_` — qui les enverrait dans le bundle.

### Si l'on revient un jour aux variables d'hebergeur : BUILD, PAS EXECUTION

C'est le piege qui a fait echouer le premier deploiement, et il ne se voit pas.

Vite fige les variables `VITE_*` **dans le bundle au moment de la compilation**. Une
variable declaree cote Cloudflare pour l'EXECUTION — « Variables and Secrets » d'un
Worker, ou les bindings d'exécution — ne sera **jamais** lue : le fichier JavaScript
servi est deja compile, il ne consulte plus rien.

Elles doivent donc etre declarees comme variables d'ENVIRONNEMENT DE BUILD, la ou l'on
configure la commande `npm run build`. Apres les avoir ajoutees, **relancer un
deploiement** : les modifier ne recompile rien toute seule.

Symptome quand elles manquent : depuis le correctif, un ecran « Configuration
incomplete » qui les nomme. **Avant** ce correctif, c'etait une page blanche avec le
seul fond degrade — l'application levait une exception a l'import, ce qui empeche React
de monter. Voir `BUGS-CONNUS.md`.

### Apres le premier deploiement

Reporter l'URL dans *Authentication > URL Configuration* de Supabase (`site_url`), qui
pointe encore sur `http://localhost:3000`.

`npm run build` lance `tsc --noEmit` avant `vite build` : une erreur de typage arrete le
deploiement.

---

## Exploitation — les trois workflows

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| `keep-alive.yml` | tous les 3 jours | un `SELECT 1`. Le palier gratuit met le projet en **pause apres 7 jours d'inactivite**, et GRID ne sert que quelques jours par mois — sans lui, l'outil serait en panne un matin de session |
| `backup.yml` | chaque lundi | `pg_dump` gzippe, **restaure dans un PostgreSQL 17 jetable**, lignes comptees, puis commite dans le depot. Retention : 8 |
| `invariants.yml` | a chaque push, et sur `master` pour Supabase | `test:invariants` — interdit n.6. Prouve aussi que les 23 migrations se rejouent depuis une base VIDE |

### Le secret unique des workflows

Les trois lisent `SUPABASE_DB_URL` — la chaine du pooler en mode **SESSION** (port 5432),
la meme que pour les migrations. A creer dans *Settings > Secrets and variables >
Actions*.

Sans ce secret, `keep-alive` et `backup` echouent AVEC UN MESSAGE EXPLICITE plutot qu'en
silence : c'est delibere, un keep-alive qui ne fait rien sans le dire est pire que pas de
keep-alive. `invariants` est plus nuance — son emploi « base neuve » n'en a pas besoin et
tourne quand meme ; seul l'emploi « Supabase » est saute, avec un avertissement.

**La chaine porte `?schema=relance`, un parametre PRISMA.** `psql` et `pg_dump` le
REFUSENT (« invalid URI query parameter: "schema" ») : `keep-alive` et `backup` le
retirent eux-memes. `invariants`, qui passe par Prisma, le garde tel quel.

### Les sauvegardes sont a notre charge, et elles sont EPROUVEES

**Le palier gratuit de Supabase n'en garantit aucune.** Le depot **doit rester prive** :
les dumps contiennent les donnees, dont des noms de clients, et un dump purge reste dans
l'historique git.

Le workflow **restaure** le dump qu'il vient de produire et compte les lignes. Un dump
jamais restaure n'est pas une sauvegarde, c'est une intention — exactement comme une
contrainte qu'on n'a jamais vue refuser quelque chose.

**Cette epreuve a justifie son existence au premier passage.** `pg_dump | gzip > fichier`
rend le code de sortie de **gzip**, qui reussit toujours : le workflow produisait une
archive VIDE affichee en vert. Corrige par `set -o pipefail`, plus un second filet
independant — un dump sous 2 Ko est refuse.

**Ce que le dump ne contient PAS :** les identites Supabase Auth (`auth.users`). Elles
appartiennent a Supabase et sont bon marche a refaire —
`MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- --tous`. Apres une
restauration, les `auth_uid` du dump pointent vers des identites disparues : c'est
`comptes-auth` qui les reconstruit.

---

## Ce qui reste a faire

| Sujet | Etat |
|---|---|
| Reecriture des 7 `services/*.ts` sur `supabase-js` | **fait** (01/09) |
| `hooks/useTempsReel.ts` + trigger de diffusion | **fait**, diffusion prouvee dans le navigateur |
| Edge Function `gerer-comptes` | **deployee** (version 3, `verify_jwt`). Refus verifie pour la cle publique, un encadrant et `direction` ; creation, connexion et suppression eprouvees de bout en bout |
| Workflows `keep-alive` et `backup` | **verts en CI**. Secret `SUPABASE_DB_URL` cree ; un dump de 24 Ko produit, restaure et commite |
| Les 1107 RDV de juin en base | **fait** — recoupes au classeur par `importer-juin` |
| Comptes `.test` archives | **fait**, `test:rls` etant devenue autonome |
| Workflow `invariants` | **ecrit** — interdit n.6 sur base neuve et sur Supabase |
| Les 14 comptes relies a Supabase Auth | **fait** — `admin` et les 7 chefs de table compris |
| Reglage `site_url` de Supabase Auth vers l'URL Cloudflare | **fait** |
| Suppression du code serveur mort (phase 8) | **fait** (01/09) |
| Copie de sauvegarde **hors du depot** | a faire, et a ne pas oublier |
| Revocation des secrets exposes en conversation | a faire par l'utilisateur |
