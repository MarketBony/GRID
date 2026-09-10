# Panne du 08/09/2026 — cause, diagnostic, et ce qui se généralise

**À qui s'adresse ce document.** À une session de travail sur un autre projet
partageant l'architecture de GRID — front statique, pas d'API, navigateur qui attaque
Supabase en direct, RLS comme seule barrière, temps réel par diffusion — mais avec
**davantage d'utilisateurs**. Il est écrit pour être lu sans connaître GRID.

**Ce qu'il contient.** Le contexte d'architecture nécessaire pour transposer, le récit
de la panne, la méthode de diagnostic avec les instruments et leurs verdicts, les deux
causes (une de conception, une de base de données), les correctifs, et une section
finale sur ce qu'il faut mesurer et changer pour monter en charge.

**Statut des chiffres.** Tout ce qui est chiffré ici a été mesuré pendant ou après
l'incident, sur la base de production. Les rares inférences sont signalées comme
telles.

---

## 1. L'architecture, en assez de détail pour transposer

### 1.1 Ce que fait le produit

GRID pilote des campagnes de relance téléphonique pour un groupe de concessions
automobiles : ~1 000 salariés, **20 concessions** regroupées en **4 plaques**,
~110 vendeurs. Une campagne dure **5 jours**, avec **11 créneaux horaires** par jour.

L'écran central est une grille de saisie : un vendeur, 5 jours × 11 créneaux, dans
laquelle un chef de table tape des noms de clients au clavier, casque sur les oreilles,
pendant des heures. **C'est cet écran qui est tombé.**

Le rythme réel, mesuré le jour de la panne : **258 RDV créés par heure**, ~25 postes
connectés simultanément, 901 RDV sur la journée.

### 1.2 La pile, et le choix structurant

```
Navigateur (Vite + React, statique, sur Cloudflare Workers)
        │
        │  HTTPS direct — il n'y a PAS d'API applicative
        ▼
Supabase ─┬─ PostgREST      (lectures et écritures simples)
          ├─ GoTrue         (authentification)
          ├─ Realtime       (diffusion)
          └─ PostgreSQL 17  (schéma unique, RLS partout)
```

**Il n'y a pas de serveur applicatif.** Un Express de 10 routes a existé, puis a été
supprimé : le navigateur parle à PostgREST, et tout ce qui doit être transactionnel
passe par des fonctions `security definer` appelées en RPC.

Trois conséquences qui commandent tout le reste :

1. **la RLS est la seule barrière d'autorisation.** Il n'y a rien derrière elle. Une
   politique oubliée n'est pas une régression discrète, c'est une fuite ;
2. **le coût de l'autorisation se paie sur CHAQUE lecture.** Sans API, il n'y a aucun
   endroit où résoudre le périmètre une fois pour toute une requête composite ;
3. **il n'y a aucun endroit pour amortir, mettre en cache ou étrangler.** Le seul
   régulateur possible est dans le navigateur — ce qui est exactement ce qui a manqué.

### 1.3 Le modèle d'autorisation

Une vue, `perimetre_saisie`, transcrit **quatre origines de droit** : administrateur,
chef de plaque, chef de site, encadrant durable d'un site, chef de table. Elle rend les
couples `(campagne, vendeur)` que l'appelant a le droit de saisir.

Les quinze politiques de lecture s'appuient dessus, directement ou par
`peut_saisir(vendeur, campagne)` qui la lit. **Le périmètre ne se recopie nulle part** :
une seule implémentation, lue par la base et par le front.

C'est une bonne propriété de conception. C'est aussi ce qui a fait de cette vue le
**facteur limitant unique** de tout le produit — voir §4.

### 1.4 Le temps réel — et c'est là que la panne était en germe

Un chef de table doit voir les compteurs des autres bouger. Le réflexe serait
`postgres_changes`, mais **il respecte la RLS** : chaque abonné ne reçoit que ce qu'il a
le droit de lire, et comme la politique de `rdv` restreint la lecture au périmètre de
saisie, un chef de table ne recevrait rien des autres tables. Les compteurs cesseraient
de bouger pour lui, **en silence**.

La base diffuse donc elle-même, par un trigger `AFTER INSERT/UPDATE` sur `rdv` qui
appelle `realtime.send()` sur un canal par campagne, avec une charge utile **sans nom de
client** :

```json
{ "id": "…", "vendeurId": "…", "jour": "…", "creneauCode": "…",
  "marqueId": "…", "typeVehicule": "VN", "archive": false, "auteur": "…" }
```

**Un message par RDV, à tous les postes de la campagne.** Retenir cette phrase : c'est
la cause.

---

## 2. La panne — ce qui a été vu

En pleine session, un jeudi matin. Plus personne ne charge la page ni ne pose de RDV.

Le tableau de bord Supabase annonce :

| | |
|---|---|
| Statut du projet | **Unhealthy** |
| POSTGRES | 59 requêtes, **22 erreurs** |
| AUTH | 58 requêtes, 1 erreur |
| API GATEWAY | **65 232 requêtes** sur l'heure, 19 erreurs |
| Compute | **NANO** (`t3a.nano`), RAM 74 %, CPU 15 %, 20/60 connexions |

Lecture spontanée : « Postgres est malade. » **Elle est fausse**, et c'est le premier
enseignement.

---

## 3. Le diagnostic — instruments et verdicts

### 3.1 La séquence qui a tranché

| Instrument | Lecture | Ce qu'elle élimine |
|---|---|---|
| `psql` en connexion directe | réponse en **160 ms** | la base n'est ni lente ni saturée |
| `pg_stat_activity`, comptage par état | 13 `idle`, 7 `idle in transaction`, 3 `active` sur 60 | pas d'épuisement de connexions |
| `pg_locks` / attentes | **aucune attente de verrou** | pas de contention |
| `wait_event` de tout ce qui attendait | **`Client` / `ClientRead`** | ⇒ **Postgres attend le CLIENT** |
| PostgREST par HTTPS, clé `service_role` | **timeout à 15 s** | le goulot est devant la base |
| `GET /auth/v1/health` | **timeout à 15 s** | GoTrue partage l'instance et se fait affamer |
| Écritures en base | 901 RDV le jour même, dernier à 15:35 UTC | le système est **dégradé**, pas mort |

**Le verdict.** `ClientRead` signifie que le backend Postgres a fini et attend la
prochaine commande du client. Quand *tout* attend là et que `psql` répond vite, **ce
n'est pas la base** : c'est le composant devant elle. Ici, le pool de connexions de
PostgREST.

### 3.2 La taille du pool, mesurée

Dans le relevé de `pg_stat_activity` pris pendant la panne, les connexions de
l'utilisateur `authenticator` (celui de PostgREST) étaient au nombre de **dix**, plus une
onzième en `LISTEN "pgrst"` — le canal de rechargement de schéma :

```
 855165 | authenticator | PostgREST 14.5 | idle in transaction | ClientRead
 855160 | authenticator | PostgREST 14.5 | idle in transaction | ClientRead
 855169 | authenticator | PostgREST 14.5 | idle in transaction | ClientRead
 …                                        (dix au total)
   2219 | authenticator | PostgREST 14.5 | idle  | LISTEN "pgrst"
```

**Dix connexions de travail** face à 65 000 requêtes/heure. Les requêtes n'atteignaient
même pas la base : elles attendaient dans PostgREST puis expiraient. D'où une base au
repos et une application morte — la combinaison qui envoie chercher au mauvais endroit.

> **À transposer** : sur un projet à plus d'utilisateurs, la taille du pool PostgREST
> est un plafond dur, indépendant de `max_connections`. C'est la première chose à
> connaître, et elle ne figure sur aucun graphique du tableau de bord.

### 3.3 Pourquoi `pg_stat_statements` a d'abord induit en erreur

Le compteur d'appels semblait modeste (18 500 pour les requêtes de chargement). Il
portait en réalité sur une fenêtre de **7 jours 17 h** — `stats_reset` le dit — pas sur
l'heure écoulée. Et surtout : **les requêtes qui n'obtiennent jamais de connexion
n'apparaissent pas** dans `pg_stat_statements`. La sous-estimation est structurelle.

> **À transposer** : `pg_stat_statements` mesure ce qui s'est exécuté, jamais ce qui a
> été refoulé. Pour une saturation de pool, croiser avec le compteur de requêtes de la
> passerelle.

---

## 4. Cause n° 1 — l'effet de meute

### 4.1 Le mécanisme

Le trigger diffuse **un message par RDV à tous les postes** de la campagne. Chaque poste
y répondait par un rechargement **complet** :

```ts
useTempsReel(campagneId, {
  'rdv:modifie': () => majTout(campagneId),   // ← chargerSaisie + chargerDashboard
});
```

Requêtes par rechargement, comptées dans le code :

| Fonction | Requêtes PostgREST |
|---|---|
| `chargerSaisie` | 9 lectures + 1 RPC `utilisateur_courant` = **10** |
| `chargerDashboard` | **6** lectures, dont 2 paginées |
| **Total par événement, par poste** | **16 au moins** |

### 4.2 L'arithmétique

```
258 RDV/heure  ×  25 postes  ×  16 requêtes  ≈  103 000 requêtes/heure
                                                 pour un pool de 10
```

L'ordre de grandeur colle aux 65 232 requêtes relevées par la passerelle — l'écart
s'explique par les rechargements qui expiraient avant d'être émis en entier.

**Le coût n'est pas la SOMME des saisies et des spectateurs, c'est leur PRODUIT.** Le
comportement est quadratique en taille de salle : doubler les postes double la charge de
*chaque* poste. Une salle de 5 fonctionnait ; une salle de 25 a produit 25 fois plus de
charge par saisie qu'une salle de 1.

### 4.3 Le détail qui aggrave

Les 25 postes répondaient **au même millième de seconde**, puisqu'ils réagissent au même
message. Ce n'est pas une charge, c'est une meute : 400 requêtes simultanées sur 10
connexions, toutes les 14 secondes.

### 4.4 Le gaspillage pur

La RLS empêche le plus souvent un poste de **voir** le RDV qui vient de le réveiller —
il concerne une autre table, une autre plaque. Il rechargeait donc tout son périmètre
**pour le relire à l'identique**. Sur 4 plaques et 20 sites, la grande majorité des
événements étaient sans effet pour la grande majorité des destinataires.

### 4.5 Pourquoi personne ne l'a vu venir

- en développement, on ouvre **deux onglets**. Le produit ×2 est invisible ;
- les six suites de vérification du projet mesurent des **réponses justes**, jamais un
  **coût collectif** ;
- `tsc` et le build ne savent rien du nombre de destinataires ;
- le code portait même un commentaire rassurant — « c'est un appel par événement reçu,
  pas par frappe » — vrai, et hors sujet : le nombre d'événements croît avec le nombre
  de **frappeurs**, et le rechargement se multiplie par le nombre d'**écouteurs**.

---

## 5. Cause n° 2 — la vue d'autorisation évaluée par ligne

Le service rétabli, le produit restait lent : « 10 secondes par onglet ». Deuxième
cause, indépendante de la première, et plus profonde.

### 5.1 La mesure

Serveur au repos, compte réel, périmètre de **trois** vendeurs :

| Lecture | Durée |
|---|---|
| `perimetre_saisie` (3 lignes rendues) | **333 ms** |
| `rdv` sous RLS (49 lignes rendues) | **538 ms** |
| `rdv_agrege` (2 112 lignes) | 57 ms |

333 ms pour rendre trois lignes : **ce n'est pas un problème de volume.**

### 5.2 La cause

La vue croise `campagne` × `vendeur` en `CROSS JOIN`, puis filtre. Et elle appelait
`utilisateur_courant()` **sept fois** et `peut_administrer()` **une fois**, à nu, dans
son `WHERE` :

```sql
WHERE relance.utilisateur_courant() IS NOT NULL
  AND …
  AND ( relance.peut_administrer()
        OR EXISTS (SELECT 1 FROM role_campagne rc
                   WHERE rc.utilisateur_id = relance.utilisateur_courant() AND …)
        OR EXISTS (…)   -- quatre origines, chacune rappelant la fonction
      )
```

Le plan d'exécution le montrait sans ambiguïté : `loops=96`, et
`relance.utilisateur_courant()` **jusque dans un `Index Cond`**.

### 5.3 Pourquoi `STABLE` n'a pas suffi

Les deux fonctions sont déclarées `STABLE` — leur valeur ne change pas pendant la
requête. Elles portent aussi `SET search_path = …`, un durcissement qu'on garde. Or :

> **Une fonction SQL portant `SET` ne peut pas être inlinée par PostgreSQL.**

Chaque évaluation est donc un véritable appel de fonction, avec sauvegarde et
restauration du GUC. Multiplié par le nombre de lignes du produit cartésien, cela
donnait **211 ms de planification** par appel, mesurés séparément de l'exécution.

### 5.4 Le correctif : une sous-requête scalaire

```sql
-- avant :  rc.utilisateur_id = relance.utilisateur_courant()
-- après :  rc.utilisateur_id = (SELECT relance.utilisateur_courant())
```

Le planificateur sort la sous-requête de la boucle et l'évalue **une fois**, en
`InitPlan`.

| Lecture | Avant | Après | Gain |
|---|---|---|---|
| `perimetre_saisie` | 333 ms | **174 ms** | ×1,9 |
| `rdv` sous RLS | 538 ms | **48 ms** | **×11** |
| `rdv_agrege` | 57 ms | 59 ms | — |

**La lecture des RDV — la plus jouée du produit — est onze fois plus rapide.** Et comme
`peut_saisir()` lit cette vue, l'écriture d'un RDV en profite aussi.

### 5.5 Le détail qui rend l'histoire instructive

**Les quinze politiques de lecture écrivaient déjà `(SELECT relance.utilisateur_courant())`.**
La vue était le seul endroit à appeler la fonction à nu. Ce n'était pas une règle
manquante, c'était **une exception à une règle existante** — le défaut le plus difficile
à voir, parce que tout le voisinage est correct.

### 5.6 Ce qui n'était PAS le problème

**Aucun index à ajouter.** Le plan utilisait déjà les bons. Le réflexe « c'est lent,
ajoutons un index » aurait coûté du temps et n'aurait rien donné : le coût était dans le
**nombre d'évaluations**, pas dans l'accès aux données.

---

## 6. Les correctifs appliqués

### 6.1 Côté base — une migration

`(SELECT f())` autour de chaque appel dans la vue. Corps recopié **à l'identique**,
commentaires compris : seuls les appels sont enveloppés. La transformation ne peut pas
changer le résultat — les fonctions sont `STABLE` et **sans argument**, donc une
sous-requête scalaire rend la même valeur.

**Preuve exigée avant de toucher à l'ossature de l'autorisation** : la suite de 89
contrôles RLS rend 89/89 **avant et après, sur les deux bases**, et la comparaison
objet par objet des deux schémas ne rend aucun écart.

### 6.2 Côté navigateur — trois garde-fous

`hooks/useRechargementCoalesce.ts` :

1. **filtrer sur le périmètre.** `vendeurId` est dans la charge utile et la liste des
   vendeurs est déjà en mémoire : un événement qui ne concerne aucun de mes vendeurs ne
   change rien à ma grille. Le relire serait le relire à l'identique. *C'est le garde-fou
   le plus efficace : il supprime la majorité des rechargements, pas seulement leur
   fréquence* ;
2. **regrouper.** Tant qu'un rechargement est programmé, les événements suivants n'en
   programment pas d'autre. N événements dans la fenêtre coûtent un rechargement, et il
   lit forcément l'état final. Fenêtres retenues : **8 s** pour le périmètre de travail,
   **30 s** pour la vue d'ensemble (la plus chère) ;
3. **disperser.** Une gigue aléatoire jusqu'à la moitié de la fenêtre. **Sans elle,
   regrouper ne fait que décaler la meute** au lieu de la disperser.

Ce qui est perdu, et assumé : la saisie d'un collègue apparaît au bout de la fenêtre au
lieu d'apparaître tout de suite. La saisie de l'utilisateur lui-même n'est pas
concernée — elle s'affiche en mémoire, immédiatement.

### 6.3 Le résultat

| | Pendant la panne | Après |
|---|---|---|
| `GET /auth/v1/health` | timeout à 20 s | **73–129 ms** |
| PostgREST, 1 000 RDV | timeout à 20 s | **124–209 ms** |
| Connexions | 20/60, 7 en transaction bloquée | 2 actives, file vide |
| Saisies | à l'arrêt | **61 RDV sur 10 minutes** |

---

## 7. Ce qui se généralise — pour un projet à plus d'utilisateurs

### 7.1 La loi à retenir

> **Diffusion à N destinataires + rechargement chez chacun = coût quadratique.**

Toute réaction à un événement diffusé doit être, dans cet ordre :

1. **filtrée** — le destinataire est-il concerné ? Beaucoup ne le sont pas, et la RLS
   les empêche même de voir le changement ;
2. **appliquée en delta** si la charge utile le permet — zéro requête. C'est le seul
   niveau qui passe vraiment à l'échelle ;
3. **regroupée** si un rechargement est inévitable ;
4. **dispersée** par une gigue, toujours.

GRID s'arrête au niveau 3 pour la grille, parce que la charge utile ne porte pas le nom
du client — volontairement, c'est une donnée personnelle. **Sur un projet plus gros, le
niveau 2 est la vraie réponse** : concevoir la charge utile pour qu'un delta soit
applicable, en acceptant d'y mettre ce qui est nécessaire et en le protégeant par le
canal plutôt que par l'omission.

### 7.2 Le coût de la RLS se paie sur chaque lecture — quatre règles

1. **`(SELECT f())` partout.** Aucune fonction d'autorisation ne s'appelle à nu dans une
   politique ou une vue. Une seule exception suffit à annuler le bénéfice sur les tables
   qui en dépendent. *C'est vrai pour `auth.uid()` de Supabase comme pour vos propres
   fonctions.*
2. **`SET search_path` sur une fonction SQL interdit l'inlining.** Le durcissement se
   garde, mais il faut savoir ce qu'il coûte et compenser par la sous-requête scalaire.
3. **Pas de `CROSS JOIN` dans une vue d'autorisation** si l'on peut l'éviter. Ici il est
   naturel (le périmètre est un produit campagne × vendeur), et c'est ce qui fait de
   chaque appel de fonction un appel par ligne.
4. **Mesurer la planification, pas seulement l'exécution.** `EXPLAIN (ANALYZE, BUFFERS)`
   donne les deux séparément. 211 ms de planification pour 121 ms d'exécution : sans
   cette distinction, on optimise la mauvaise moitié.

### 7.3 Une saturation de pool ressemble à un problème de base — signature à connaître

```
psql direct rapide  +  tout en ClientRead  +  API en timeout
    ⇒  ce n'est pas la base, c'est le composant devant elle
```

Corollaire : un tableau de bord d'hébergeur qui annonce « Postgres unhealthy » agrège
des sondes qui traversent le même goulot. **Il désigne le symptôme, jamais la cause.**

### 7.4 Ce que la vérification automatique ne verra jamais

Sur ce projet : 6 suites, 210 contrôles, CI sur deux bases, typecheck des deux côtés.
**Aucun n'aurait attrapé cette panne.** Ils vérifient que les réponses sont justes, pas
qu'elles sont soutenables à N postes.

Ce qui manque, et qu'il faut ajouter sur un projet plus exposé :

- **un contrôle de fan-out** : pour un événement diffusé, combien de requêtes en
  résultent chez un client ? C'est vérifiable dans un test d'intégration navigateur en
  comptant les appels réseau après une diffusion simulée ;
- **un plafond de requêtes par chargement d'écran**, vérifié en CI. « `chargerSaisie` ne
  doit pas dépasser 10 requêtes » est un invariant testable, et il attrape la dérive
  d'un écran qui grossit ;
- **un test de charge à la vraie taille de salle.** Vingt-cinq navigateurs sans tête
  qui écoutent le même canal, pendant qu'un vingt-sixième saisit à 4 RDV/minute.

### 7.5 Les leviers de dimensionnement, par ordre de rendement

Constaté sur ce cas ; l'ordre devrait tenir sur toute architecture comparable.

| # | Levier | Rendement | Coût |
|---|---|---|---|
| 1 | **Filtrer les événements diffusés** côté client | supprime la majorité des rechargements | quelques lignes |
| 2 | **`(SELECT f())`** dans vues et politiques | ×11 sur la lecture chaude ici | une migration |
| 3 | **Appliquer un delta** au lieu de recharger | supprime le rechargement | refonte de la charge utile |
| 4 | **Regrouper + gigue** | divise par la fenêtre | un hook |
| 5 | **Réduire les requêtes par écran** (une RPC composite plutôt que 10 lectures) | résout le périmètre une fois au lieu de 10 | migration + front |
| 6 | **Agrandir le pool PostgREST** | linéaire, borné par `max_connections` | réglage |
| 7 | **Agrandir le compute** | linéaire | facture |

**Les cinq premiers sont gratuits ou presque, et se cumulent.** Le compute vient en
dernier : sur ce cas, l'augmenter aurait masqué un défaut quadratique sans le corriger,
et la panne serait revenue à la salle suivante, plus grande.

### 7.6 Ce qui reste non résolu sur GRID, et qui reviendra

- **`perimetre_saisie` coûte encore ~174 ms par appel**, dont l'essentiel en
  planification. C'est structurel : `CROSS JOIN` plus quatre `EXISTS`. À la prochaine
  montée en charge, ce sera de nouveau le facteur limitant. Les pistes, non explorées :
  une RPC composite qui résout le périmètre une fois pour tout un chargement d'écran ;
  ou un périmètre matérialisé rafraîchi sur changement d'affectation — **avec une
  extrême prudence, c'est un cache d'autorisation, et un cache d'autorisation périmé est
  une fuite** ;
- **le compute est sous-dimensionné** pour 25 postes simultanés. `t3a.nano` héberge
  PostgreSQL, PostgREST, GoTrue, Realtime et Storage sur la même instance : la
  saturation de l'un affame les autres, ce qui explique l'authentification en timeout ;
- **aucun test de charge** n'existe.

---

## 8. Annexe — les requêtes de diagnostic

À garder sous la main. Toutes en lecture seule.

```sql
-- 1. ETAT DES CONNEXIONS. Le premier réflexe.
select state, count(*), max(now() - state_change) as plus_ancien
from pg_stat_activity where datname = current_database()
group by state order by 2 desc;

-- 2. SUR QUOI ATTEND-ON ? La requête qui a tranché.
--    `Client`/`ClientRead` partout = ce n'est pas la base.
select pid, usename, application_name, state,
       now() - xact_start as xact, wait_event_type, wait_event,
       left(replace(query, chr(10), ' '), 90) as requete
from pg_stat_activity
where datname = current_database() and pid <> pg_backend_pid()
order by coalesce(xact_start, query_start) nulls last limit 25;

-- 3. TAILLE REELLE DU POOL de la couche API (`authenticator` chez Supabase).
select usename, application_name, count(*)
from pg_stat_activity where datname = current_database()
group by 1, 2 order by 3 desc;

-- 4. LES REQUETES QUI COUTENT. Vérifier `stats_reset` AVANT de conclure :
--    la fenêtre n'est presque jamais celle qu'on croit.
select stats_reset, now() - stats_reset as fenetre
from extensions.pg_stat_statements_info;

select calls,
       total_exec_time::numeric(12,0) as ms_total,
       mean_exec_time::numeric(9,1)  as ms_moyen,
       left(replace(query, chr(10), ' '), 100) as requete
from extensions.pg_stat_statements
where dbid = (select oid from pg_database where datname = current_database())
order by total_exec_time desc limit 10;

-- 5. LE COUT REEL D'UNE LECTURE SOUS RLS, en empruntant un rôle.
--    Rollback systématique : on mesure, on n'écrit pas.
begin;
select set_config('request.jwt.claims',
                  json_build_object('sub', <uuid>, 'role', 'authenticated')::text, true);
set local role authenticated;
explain (analyze, buffers, timing) select … ;   -- lire PLANNING et EXECUTION
rollback;

-- 6. LES APPELS DE FONCTION A NU dans les politiques — le défaut du §5.
select tablename, policyname, cmd,
       (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ '<ma_fonction>\(\)'      as appel_direct,
       (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ 'SELECT <ma_fonction>'  as sous_requete
from pg_policies where schemaname = '<mon_schema>'
order by appel_direct desc;

-- 7. VOLATILITE ET INLINING. `provolatile='v'` sur une fonction d'autorisation
--    est un défaut ; `prosecdef` + un `SET` dans `proconfig` interdit l'inlining.
select p.proname,
       case p.provolatile when 'i' then 'IMMUTABLE'
                          when 's' then 'STABLE'
                          when 'v' then 'VOLATILE' end as volatilite,
       p.prosecdef as security_definer, p.proconfig, p.procost
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = '<mon_schema>' order by 1;
```

**Deux relevés côté client, tout aussi importants :**

```js
// Le compte de requêtes déclenché par UN événement diffusé.
// Si ce nombre est > 0 pour un destinataire non concerné, il y a du gaspillage pur.
let n = 0;
const vrai = window.fetch;
window.fetch = (...a) => { n++; return vrai(...a); };
// … simuler une diffusion, puis lire `n`
```

```bash
# La latence de bout en bout, vue de là où sont les utilisateurs.
# Un timeout ici avec une base rapide, c'est la signature du §7.3.
curl -o /dev/null -s -w "%{http_code} %{time_total}s\n" \
  -H "apikey: $CLE" "$URL/rest/v1/<table>?select=id&limit=1"
```

---

## 9. Résumé en dix lignes

1. Front statique sans API, navigateur → PostgREST, RLS comme seule barrière.
2. Un trigger diffuse un message par écriture à **tous** les postes de la campagne.
3. Chaque poste répondait par un rechargement complet : **16 requêtes**.
4. 258 écritures/h × 25 postes × 16 = ~100 000 requêtes/h pour un pool de **10**.
5. Le coût est le **produit** des écrivains par les spectateurs, pas leur somme.
6. La base allait bien : tout attendait en **`ClientRead`**, `psql` répondait en 160 ms.
7. Deuxième cause : la vue d'autorisation appelait ses fonctions **par ligne** —
   `(SELECT f())` a divisé la lecture chaude par **11**.
8. Correctifs client : **filtrer**, **regrouper**, **disperser** — dans cet ordre de
   rendement.
9. Aucune des 210 vérifications automatiques du projet ne pouvait voir cette panne.
10. Le compute vient **en dernier** : l'augmenter d'abord aurait masqué un défaut
    quadratique jusqu'à la salle suivante.
