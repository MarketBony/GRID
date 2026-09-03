# GRID — outil de pilotage des campagnes de phoning du Groupe Bony

Remplace le classeur Excel `tableau_phoning_reltel_*.xlsx` (25 onglets, 677 références
inter-feuilles codées en dur, plage de classement saturée à 99/99).

Cible : opérationnel pour la campagne de **septembre 2026**. En ligne sur
`https://grid.bonyauto-mobile.workers.dev/`.

## Architecture, en trois lignes

**Il n'y a pas de serveur applicatif.** Le front est statique (Cloudflare) et le
navigateur attaque Supabase en direct — PostgREST pour les lectures et les écritures
simples, 13 fonctions `security definer` pour ce qui doit être transactionnel.
L'autorisation est portée par la **RLS**, et elle n'a aucun filet derrière elle : d'où
`test:rls`, 87 contrôles dans les deux sens.

Seule exception : une Edge Function `gerer-comptes`, parce que créer une identité exige
la clé `service_role`, qui ne doit jamais se trouver dans le navigateur.

## Démarrer en local

Prérequis : Node 24, PostgreSQL 17 sur `localhost:5432`.

```bash
# 1. Dépendances
npm install && npm install --prefix backend

# 2. Base — locale, pour les migrations et les suites
psql -h localhost -U postgres -c "create database relance"
psql -h localhost -U postgres -d relance -c "create schema if not exists relance"

# 3. Configuration : backend/.env pour DATABASE_URL et DIRECT_URL (base locale).
#    Le front, lui, lit VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY — les deux
#    sont versionnées dans .env.production, elles sont publiques par construction.

# 4. Schéma et données
npm --prefix backend run migrate:deploy
npm --prefix backend run seed          # affiche le mot de passe généré, à noter

# 5. Le front. UN SEUL serveur : il n'y a plus rien à lancer à côté.
npm run dev                            # front sur 3000
```

Sans configuration Supabase, l'application affiche un écran **« Configuration
incomplète »** qui nomme les variables manquantes — pas une page blanche.

## Documents

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | Contexte, vocabulaire métier, interdits, pipeline, commandes |
| `ETAT-PROJET.md` | **Mémoire de référence** : ce qui est fait, décisions, lotissement |
| `ETAT-BACKEND.md` | Base, RLS, RPC, invariants, sources de vérité uniques |
| `DEPLOIEMENT.md` | Runbook : Supabase + Cloudflare, workflows, sauvegardes |
| `BUGS-CONNUS.md` | Défauts identifiés, corrigés ou non |
| `CAHIER-DES-CHARGES.md` | Spécification fonctionnelle, exigences numérotées |
| `MODELE-DONNEES.md` | Modèle relationnel et justification des choix |
| `backend/prisma/schema.prisma` | **Source de vérité du modèle de données** |

Références historiques, ne plus appliquer : `schema.sql`, `seed_referentiels.sql`.
Périmé : `VIABILITE-FREEMIUM.md` (voir son en-tête).

## Vérifications

Six suites. Aucune ne doit passer au rouge, et **toutes se jouent sur les deux bases** :
une suite verte en local ne dit rien de la production.

```bash
npm --prefix backend run test:garde-fous   # 33 invariants de la base, chacun doit REFUSER
npm --prefix backend run test:rls          # 87 contrôles des politiques ET des RPC
npm --prefix backend run test:invariants   # 10 contrôles code <-> base (interdit n°6)
npm --prefix backend run test:agregats     # 27 tests des totaux, contre les 1107 RDV de juin
npm --prefix backend run test:repartition  # 20 tests de la répartition graine 42
npm --prefix backend run test:import       # 19 tests du parseur, fonctions pures

npm --prefix backend run comparer -- "<url>"   # diff des deux bases, objet par objet
npx tsc --noEmit && cd backend && npx tsc --noEmit
```

## État

**En ligne et vérifié de bout en bout** (01/09/2026) : 22 migrations, 16 tables,
11 contraintes CHECK, 19 triggers, 48 politiques RLS, 13 RPC, diffusion temps réel
prouvée dans deux onglets. Sauvegardes hebdomadaires **avec épreuve de restauration**,
keep-alive tous les 3 jours (le palier gratuit met le projet en pause après 7 jours).

**Deux données bloquantes avant la mise en service**, détaillées dans `BUGS-CONNUS.md` :
les marques autorisées des 99 vendeurs sont un placeholder, et les dates réelles de la
campagne de septembre restent à saisir.
