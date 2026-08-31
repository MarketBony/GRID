# GRID — outil de pilotage des campagnes de phoning du Groupe Bony

Remplace le classeur Excel `tableau_phoning_reltel_*.xlsx` (25 onglets, 677 références
inter-feuilles codées en dur, plage de classement saturée à 99/99).

Cible : opérationnel pour la campagne de **septembre 2026**.

## Démarrer en local

Prérequis : Node 24, PostgreSQL 17 sur `localhost:5432`.

```bash
# 1. Dépendances
npm install && npm install --prefix backend

# 2. Base
psql -h localhost -U postgres -c "create database relance"
psql -h localhost -U postgres -d relance -c "create schema if not exists relance"

# 3. Configuration — copier .env.example vers backend/.env et générer le secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Schéma et données
npm --prefix backend run migrate:deploy
npm --prefix backend run seed          # affiche le mot de passe généré, à noter

# 5. Deux serveurs, deux terminaux
npm --prefix backend run dev           # API sur 3001
npm run dev                            # front sur 3000
```

Le front n'appelle que des URL relatives : Vite proxifie `/api` et `/socket.io` vers 3001.

## Documents

| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | Contexte, vocabulaire métier, interdits, pipeline, commandes |
| `ETAT-PROJET.md` | **Mémoire de référence** : ce qui est fait, décisions, lotissement |
| `ETAT-BACKEND.md` | API, base, invariants, sources de vérité uniques |
| `BUGS-CONNUS.md` | Défauts identifiés, corrigés ou non |
| `CAHIER-DES-CHARGES.md` | Spécification fonctionnelle, exigences numérotées |
| `MODELE-DONNEES.md` | Modèle relationnel et justification des choix |
| `backend/prisma/schema.prisma` | **Source de vérité du modèle de données** |

Références historiques, ne plus appliquer : `schema.sql`, `seed_referentiels.sql`.
Périmé : `VIABILITE-FREEMIUM.md` (voir son en-tête).

## Vérifications

```bash
npm --prefix backend run test:garde-fous   # 13 invariants de la base
npm --prefix backend run seed              # rejouable : les comptes ne doivent pas bouger
npx tsc --noEmit && cd backend && npx tsc --noEmit
```

## État

**J1 fait** — base, 4 migrations, 9 contraintes CHECK, 13 triggers, seed idempotent
(4 plaques, 19 sites, 99 vendeurs, 8 tables, 48 affectations), authentification et
périmètre par campagne, front minimal. Boucle vérifiée dans le navigateur.

**Deux données bloquantes avant la mise en service**, détaillées dans `BUGS-CONNUS.md` :
les marques autorisées des 99 vendeurs sont un placeholder, et les dates réelles de la
campagne de septembre restent à saisir.
