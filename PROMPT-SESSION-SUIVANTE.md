# Prompt de reprise — GRID, session suivante

Copier tout ce qui suit la ligne de séparation dans une nouvelle session Claude Code,
depuis `C:\Users\Operateur\Documents\RELTEL`.

Ce fichier est **jetable** : le supprimer une fois la session lancée.

---

Reprise du projet GRID. Lis `CLAUDE.md`, puis `ETAT-PROJET.md` (section **« CE QUI
RESTE »**, vers la fin) et `BUGS-CONNUS.md` (les deux premières sections). Ne relis
pas le reste : tout ce dont tu as besoin y est.

Contexte en trois phrases : GRID est **en ligne et opérationnel** sur
`https://grid.bonyauto-mobile.workers.dev/`, front statique sur Cloudflare, navigateur
attaquant Supabase en direct, **la RLS est la seule barrière d'autorisation**. Les
1107 RDV de juin sont en base et se recoupent à l'unité avec le classeur Excel. Les
six suites sont vertes sur les deux bases (39/39 · 87/87 · 10/10 · 27/27 · 20/20 ·
19/19), `comparer` ne rend aucun écart.

Enchaîne les cinq travaux ci-dessous **dans cet ordre**, en respectant le pipeline de
`CLAUDE.md` : vérification locale réelle, mise à jour des `.md` **avant** de pousser,
commit, **stop avant le push** pour montrer le diff.

---

## 1. Les deux cellules à deux RDV — le seul point qui touche septembre

**C'est un arbitrage produit, pas une tâche technique. Commence par me poser la
question, avec ta recommandation.**

Le tableau de bord de juin affiche **1107** RDV, le module C **1105**. Les deux lisent
la même base : c'est l'affichage qui en perd deux.

`pages/Saisie.tsx` indexe les RDV par `cleRdv(marqueId, creneauCode, jour)` — une
entrée par **case** de la grille. Or deux cases du classeur portent **deux
rendez-vous** :

| Vendeur | Quand | Clients |
|---|---|---|
| JEROME SABIN (CLF) | 15/06, 14h-15h, VO | DEVERNOIS **+** DE SOUSA |
| REDWANE TOULOUSE (ISS) | 11/06, 08h-09h, VO | DAUBARD **+** COSTON |

Un vendeur a pris deux clients dans la même heure, les deux noms ont été tapés dans la
même cellule. **Ce ne sont pas des artefacts** : les deux comptent dans les 1107, qui
se recoupent avec quatre séries de totaux indépendantes du classeur.

Conséquences, par gravité décroissante :

1. **le second client est invisible à l'écran** — SABIN affiche `DE SOUSA`, jamais
   `DEVERNOIS` ;
2. saisir dans cette case écraserait l'un des deux ;
3. le compteur du module C sous-compte de 2 sur juin.

**Ne touche pas à la donnée.** Fusionner les deux noms ferait concorder les compteurs
en détruisant un fait : il y a eu deux rendez-vous. La base a raison, c'est la grille
qui ne sait pas l'exprimer.

Le modèle « une case, un RDV » porte toute l'ergonomie clavier du module C, qui est le
cœur du produit (`CLAUDE.md` : « en cas d'arbitrage, la saisie gagne toujours »). Trois
pistes, sans préférence de ma part :

- un marqueur « 2 » sur la case, ouvrant un détail au clic ;
- empiler les valeurs dans la cellule ;
- accepter la limite et l'écrire dans le mode d'emploi — mais alors **faire concorder
  le compteur**, parce que 1105 contre 1107 sur le même écran est un défaut en soi.

## 2. Migration `REVOKE EXECUTE … FROM PUBLIC`

L'analyseur Supabase lève **10 alertes** « Public Can Execute SECURITY DEFINER
Function » sur `relance.diffuser_rdv()` et les 11 fonctions `relance.verifier_*()`.

**Aucun chemin d'exploitation** — mesuré : les 12 sont `RETURNS trigger`, PostgreSQL
refuse un appel direct, et PostgREST ne les expose même pas (`404 PGRST202`). Mais le
bruit masque les vraies alertes.

Écris une migration (`node scripts/nouvelle-migration.mjs revoquer_execute_public`) qui
révoque `EXECUTE` à `PUBLIC` sur ces 12 fonctions. **Boucle sur `pg_proc` filtré par
`prorettype = 'trigger'::regtype`**, pas une liste de noms écrite à la main : une
treizième fonction de trigger ajoutée demain doit être couverte sans que personne y
pense (interdit n°6, esprit).

Vérifie ensuite : `test:garde-fous` doit rester à 39/39 sur les deux bases — les
triggers doivent continuer à se déclencher. C'est le contrôle qui compte : révoquer
trop large les désarmerait.

## 3. Le mot de passe de `tlabonne`

Compte créé (id 92, palier `admin`), connexion et palier vérifiés en base. Il tourne
avec un mot de passe généré : `Usb6HgnUu4hnbZ7vCC`.

Le mot de passe demandé, `17061969`, est **refusé par le plancher à 12 caractères** de
`supabase/functions/gerer-comptes/index.ts`. Demande-moi lequel des deux je veux :

- `Bony-17061969` — 13 caractères, mon nombre dedans, mémorisable. Tu le poses en une
  commande ;
- descendre le plancher à 8 — mon produit, mon choix, mais redis-moi une fois que 8
  chiffres formant une date de naissance sur un compte administrateur d'une
  application exposée sur Internet est la première chose qu'on essaie.

## 4. Accélérer `test:rls` sur Supabase

2 min 12 sur Supabase contre 5 secondes en local. `poserDecor` reconstruit le décor
complet — ~25 lignes — dans **chacune** des 87 transactions, soit autant d'allers-
retours réseau.

**Ne casse pas l'isolement pour aller plus vite.** L'autonomie vient d'être conquise
(commit `abad81a`) et elle vaut plus que la vitesse : la suite ne doit dépendre
d'aucune donnée de production. Deux pistes qui la préservent :

- construire le décor en **une seule instruction SQL** avec des CTE modifiantes
  (`WITH … INSERT … RETURNING`), ce qui ramène 25 allers-retours à 1 ;
- ou grouper les contrôles par section dans une transaction commune — plus rapide,
  mais un contrôle pourrait alors voir les effets du précédent : à n'envisager que si
  la première piste ne suffit pas.

Critère de sortie : **87/87 sur Supabase ET en local**, comptes `.test` archivés.

## 5. Les gestes qui m'appartiennent

Rappelle-les moi en fin de session, sans les faire toi-même :

- activer **Leaked Password Protection** (Supabase → *Authentication* → *Policies*) ;
- une **copie de sauvegarde hors du dépôt** — le dump hebdomadaire vit dans le dépôt,
  si le dépôt disparaît tout disparaît ;
- **rotation des trois secrets** exposés en conversation : jeton `sbp_` (compte entier,
  gearbox compris), clé `sb_secret_`, mot de passe de la base.

---

## Ce qu'il ne faut PAS « corriger »

Deux écarts sont **assumés et documentés**. Lis le pourquoi avant d'y toucher :

1. **Les vues `perimetre_saisie` et `rdv_agrege` contournent la RLS**
   (`SECURITY DEFINER`), signalées **CRITICAL** par Supabase. C'est délibéré :
   `rdv_agrege` sert les compteurs publics du tableau de bord sans colonne `client`, et
   `perimetre_saisie` calcule **l'autorisation elle-même** — en mode `invoker`, une
   politique restrictive future rétrécirait silencieusement le périmètre de quelqu'un.
   Les deux portent leur propre filtre `utilisateur_courant() IS NOT NULL`, et
   `test:rls` a trois contrôles dédiés à ce scénario. Détail dans `ETAT-BACKEND.md`.

2. **Les ports 5432/6543 sont bloqués par intermittence** depuis le poste du bureau :
   ils répondaient le 31/08, plus le 01/09, puis de nouveau. **Mesure avant de conclure
   à une panne.** Le 443 passe toujours — `importer-rdv-juin.ts` montre comment écrire
   par PostgREST quand Prisma ne peut pas se connecter.

## Trois leçons de la session précédente, à ne pas réapprendre

- **Une lecture paginée porte un ordre stable.** `LIMIT/OFFSET` sans `ORDER BY` rend le
  bon *nombre* de lignes et pas les *bonnes* : le contrôle de volume passe au vert
  pendant que les totaux sont faux. Constaté en vrai sur les 1107 RDV.
- **Un typecheck vert ne prouve rien sur le contrat de l'API.** PostgREST rend un
  tableau pour un embed enfant, jamais `null` — et `[]` est vrai en JavaScript. Une
  déclaration TypeScript fausse est un mensonge que le compilateur valide.
- **Une suite de sécurité ne dépend pas des données de production.** Les fixtures se
  **créent**, elles ne se **choisissent** pas.
