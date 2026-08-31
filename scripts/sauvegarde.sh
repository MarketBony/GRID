#!/usr/bin/env bash
# ============================================================================
# SAUVEGARDE DE LA BASE GRID — et vérification qu'elle est restaurable.
#
# Supabase a été écarté le 31/08/2026 : les sauvegardes sont donc à notre
# charge. Ce script existe pour que ce ne soit pas une intention.
#
# CE QU'IL FAIT DE PLUS QU'UN `pg_dump` :
#
#   1. il dumpe ;
#   2. il RESTAURE le dump dans une base jetable et compte les lignes des tables
#      qui portent le métier. Une sauvegarde jamais restaurée n'est pas une
#      sauvegarde, c'est un fichier — exactement comme une contrainte qu'on n'a
#      jamais vue refuser quelque chose n'est pas une contrainte ;
#   3. il ne supprime l'ancienne que si la nouvelle a passé cette épreuve. Une
#      rotation qui tourne pendant que les dumps sont corrompus efface les bons
#      pour garder les mauvais.
#
# Usage :  ./scripts/sauvegarde.sh [repertoire]
# Défaut :  ./sauvegardes
# Cron   :  voir DEPLOIEMENT.md
# ============================================================================

set -euo pipefail

RETENTION_JOURS="${RETENTION_JOURS:-30}"
DEST="${1:-$(cd "$(dirname "$0")/.." && pwd)/sauvegardes}"
PROJET=grid
SERVICE=db
UTILISATEUR=grid
BASE=grid

horodatage="$(date +%Y%m%d-%H%M%S)"
fichier="$DEST/grid-${horodatage}.sql.gz"
BASE_ESSAI="grid_essai_restauration_${horodatage}"

mkdir -p "$DEST"

echo "→ dump de $BASE"
# `--clean --if-exists` : le dump se recharge sur une base non vide sans erreur.
# `--no-owner --no-privileges` : le rôle de la base d'essai n'est pas forcément
# le même, et un dump qui ne se recharge que sur un rôle identique est un dump
# qu'on ne peut pas restaurer ailleurs — donc pas une sauvegarde.
docker compose -p "$PROJET" exec -T "$SERVICE" \
  pg_dump -U "$UTILISATEUR" -d "$BASE" --clean --if-exists --no-owner --no-privileges \
  | gzip -9 > "$fichier"

taille=$(stat -c %s "$fichier")
echo "  $fichier — $((taille / 1024)) Kio"

if [ "$taille" -lt 10240 ]; then
  echo "ECHEC : dump de moins de 10 Kio. La base de GRID en fait bien plus."
  echo "        Le fichier est CONSERVE pour analyse, et rien n'est supprime."
  exit 1
fi

# ---------------------------------------------------------------- restauration
echo "→ epreuve de restauration dans $BASE_ESSAI"
nettoyer() {
  docker compose -p "$PROJET" exec -T "$SERVICE" \
    psql -U "$UTILISATEUR" -d postgres -c "drop database if exists $BASE_ESSAI" >/dev/null 2>&1 || true
}
trap nettoyer EXIT

docker compose -p "$PROJET" exec -T "$SERVICE" \
  psql -U "$UTILISATEUR" -d postgres -c "create database $BASE_ESSAI" >/dev/null

if ! gunzip -c "$fichier" | docker compose -p "$PROJET" exec -T "$SERVICE" \
     psql -U "$UTILISATEUR" -d "$BASE_ESSAI" -v ON_ERROR_STOP=1 >/dev/null 2>"$DEST/.derniere-restauration.log"; then
  echo "ECHEC : le dump ne se restaure pas. Journal : $DEST/.derniere-restauration.log"
  echo "        Le fichier est CONSERVE, et la rotation n'a PAS tourne."
  exit 1
fi

# Les quatre tables sans lesquelles l'outil ne sert a rien. Un dump qui se
# recharge mais rend une base vide passerait le test precedent.
lignes=$(docker compose -p "$PROJET" exec -T "$SERVICE" psql -U "$UTILISATEUR" -d "$BASE_ESSAI" -tAc "
  select coalesce(sum(n), 0) from (
    select count(*) as n from relance.site
    union all select count(*) from relance.vendeur
    union all select count(*) from relance.campagne
    union all select count(*) from relance.utilisateur
  ) t")

echo "  restauration OK — $lignes lignes sur site + vendeur + campagne + utilisateur"

if [ "${lignes:-0}" -lt 100 ]; then
  echo "ECHEC : moins de 100 lignes metier restaurees. Attendu : 19 sites,"
  echo "        ~100 vendeurs, au moins 1 campagne et 1 compte."
  exit 1
fi

# ------------------------------------------------------------------- rotation
# Seulement maintenant : la nouvelle sauvegarde est prouvee restaurable.
echo "→ rotation au-dela de $RETENTION_JOURS jours"
supprimes=$(find "$DEST" -maxdepth 1 -name 'grid-*.sql.gz' -mtime "+$RETENTION_JOURS" -print -delete | wc -l)
echo "  $supprimes fichier(s) supprime(s), $(find "$DEST" -maxdepth 1 -name 'grid-*.sql.gz' | wc -l) conserve(s)"

echo
echo "SAUVEGARDE VERIFIEE : $fichier"
echo
echo "RAPPEL — cette copie vit sur LE MEME disque que la base qu'elle sauvegarde."
echo "Elle protege d'une fausse manoeuvre, PAS de la perte du VPS. Une copie hors"
echo "du serveur reste a mettre en place."
