# ============================================================================
# API GRID. Même forme que celle de gearbox, y compris ses deux leçons apprises
# à la dure — reprises ici plutôt que redécouvertes.
# ============================================================================

# --------------------------------------------------------------- étape 1 : build
FROM node:22-slim AS build
WORKDIR /app

# openssl est ABSENT de node:*-slim. Sans lui, Prisma ne détecte pas libssl et
# se rabat sur les engines openssl-1.1.x, incompatibles avec Debian bookworm :
# le schema engine plante au `migrate deploy`. Constaté sur gearbox.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ------------------------------------------------------------ étape 2 : exécution
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Même besoin qu'au build, pour deux raisons distinctes : le schema engine du
# `migrate deploy` au démarrage du conteneur, et le query engine à l'exécution.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# `npm ci` réinstalle @prisma/client SANS le client généré : il faut le
# régénérer ici. Le CLI `prisma` est en dependencies et non en devDependencies
# précisément pour ça — `migrate deploy` tourne au démarrage du conteneur.
COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# `tsx` et `prisma` sont en dependencies, donc présents ici : ce sont les deux
# outils dont l'exploitation a besoin sur une base de production.
#
#   docker compose exec grid-api npx tsx prisma/seed.ts          # 1er démarrage
#   docker compose exec grid-api npx tsx prisma/mot-de-passe.ts  # accès perdu
#
# La base de production naît VIDE : sans le seed, aucun compte n'existe et
# personne ne peut se connecter pour en créer. Les suites de vérification, elles,
# ne montent pas dans l'image (`.dockerignore`) — elles écrivent en base et
# tournent en local avant le commit, comme le veut le pipeline.

EXPOSE 3001
CMD ["node", "dist/index.js"]
