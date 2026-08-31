# DEPLOIEMENT — GRID sur Supabase et Cloudflare Pages

Mise a jour : 31/08/2026, **apres** le deploiement du schema. Ce document decrit ce qui a
reellement tourne, pas ce qui etait prevu.

Il remplace integralement le runbook VPS precedent. Le VPS de gearbox a ete remis dans son
etat d'origine : **il ne reste aucune trace de GRID dessus**, et c'est une exigence de
l'utilisateur, pas une preference — « Gearbox reste Gearbox ».

---

## L'architecture, en trois lignes

- **Front statique** sur Cloudflare Pages. Il porte une cle publique et attaque Supabase
  en direct.
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
npm --prefix backend run test:garde-fous   # 33/33
npm --prefix backend run test:rls          # 81/81
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
| URL | `https://grid.bonyauto-mobile.workers.dev` |
| Commande de build | `npm run build` |
| Repertoire de sortie | `dist` |
| Variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Chaque push deploie. HTTPS et nom de domaine sont fournis par Cloudflare — c'est
precisement ce qui rend ce chemin possible sans acces DNS.

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

## Exploitation — deux points qui ne peuvent pas attendre

### Les sauvegardes sont a notre charge

**Le palier gratuit de Supabase n'en garantit aucune.** Motif eprouve sur gearbox : un
workflow GitHub Actions fait un `pg_dump` gzippe et le commite dans le depot prive, avec
rotation. Le depot **doit rester prive** — les dumps contiennent les donnees.

A reprendre de `gearbox/.github/workflows/backup.yml`, **augmente d'une epreuve de
restauration** : un dump jamais restaure n'est pas une sauvegarde, c'est une intention —
exactement comme une contrainte qu'on n'a jamais vue refuser quelque chose.

### Le keep-alive, sinon l'outil sera en panne le jour de la session

Le palier gratuit met un projet en pause apres **7 jours d'inactivite**, et GRID ne sert
que quelques jours par mois. Reprise de `gearbox/.github/workflows/keep-alive.yml` : un
`SELECT 1` tous les trois jours.

Secret requis pour les deux : `SUPABASE_DB_URL` (chaine du pooler **session**), dans
*Settings > Secrets and variables > Actions*.

---

## Ce qui reste a faire

| Sujet | Etat |
|---|---|
| Reecriture des 7 `services/*.ts` sur `supabase-js` | **fait** (01/09) |
| `hooks/useTempsReel.ts` + trigger de diffusion | **fait**, diffusion prouvee dans le navigateur |
| Edge Function `gerer-comptes` | **a faire — bloque trois actions de l'ecran Comptes** : creer un compte, reinitialiser un mot de passe, supprimer une identite. En attendant : `npm --prefix backend run comptes-auth` |
| Workflows sauvegarde et keep-alive | a faire |
| Archiver les comptes `.test` presents sur Supabase | avant mise en service |
| Reglage `site_url` de Supabase Auth vers l'URL Cloudflare | apres branchement |
| Revocation des secrets exposes en conversation | a faire par l'utilisateur |
