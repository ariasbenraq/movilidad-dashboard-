#!/usr/bin/env bash
# Copies this repository's deployment kit into a NEW project and renames it, so
# a new app does not start from hand-edited names.
#
#   bash deploy/scaffold.sh <target-dir> <app> <prefix> <domain>
#
#   target-dir  root of the new project (must exist)
#   app         project slug: image names, stack, server folder. e.g. gastos
#   prefix      short unique prefix of the names exposed on the shared "edge"
#               network (<prefix>-api, <prefix>-web). e.g. gas
#   domain      public hostname. e.g. gastos.hamstitors.trade
#
# Writes: deploy/{docker-stack.yml,deploy.sh,production.env.example},
#         .github/workflows/{ci,deploy}.yml and .github/dependabot.yml.
# It never overwrites: if any of them already exists, it stops without copying.
set -euo pipefail

usage() {
  echo "Usage: bash deploy/scaffold.sh <target-dir> <app> <prefix> <domain>" >&2
  echo "Example: bash deploy/scaffold.sh ~/gastos gastos gas gastos.hamstitors.trade" >&2
  exit 2
}
fail() {
  echo "Error: $*" >&2
  exit 1
}

[ "$#" -eq 4 ] || usage
TARGET="$1"
APP="$2"
PREFIX="$3"
DOMAIN="$4"

[[ "$APP" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || fail "app must be lowercase letters, digits or '-' (2-31 chars, starts with a letter)"
[[ "$PREFIX" =~ ^[a-z][a-z0-9]{1,8}$ ]] || fail "prefix must be lowercase letters or digits (2-9 chars, starts with a letter)"
[[ "$DOMAIN" =~ ^([a-z0-9-]+\.)+[a-z]{2,}$ ]] || fail "domain is not a valid hostname"
[ -d "$TARGET" ] || fail "target directory '$TARGET' does not exist"

SRC="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
TARGET="$(cd "$TARGET" && pwd)"
[ "$SRC" != "$TARGET" ] || fail "target is this same repository"

# Postgres role and database names: no hyphens.
DBNAME="${APP//-/_}"

FILES=(
  deploy/docker-stack.yml
  deploy/deploy.sh
  deploy/production.env.example
  .github/workflows/ci.yml
  .github/workflows/deploy.yml
  .github/dependabot.yml
)

for f in "${FILES[@]}"; do
  [ -e "$SRC/$f" ] || fail "source file missing: $f"
  [ ! -e "$TARGET/$f" ] || fail "$TARGET/$f already exists; nothing was copied"
done

for f in "${FILES[@]}"; do
  mkdir -p "$TARGET/$(dirname "$f")"
  # Order matters: the domain contains "movilidad", so it goes first.
  sed \
    -e "s/movilidades\.hamstitors\.trade/${DOMAIN}/g" \
    -e "s/^DB_USER=movilidad\$/DB_USER=${DBNAME}/" \
    -e "s/^DB_NAME=movilidad\$/DB_NAME=${DBNAME}/" \
    -e "s/mov-api/${PREFIX}-api/g" \
    -e "s/mov-web/${PREFIX}-web/g" \
    -e "s/movilidad/${APP}/g" \
    "$SRC/$f" >"$TARGET/$f"
done
chmod +x "$TARGET/deploy/deploy.sh"

cat <<EOF
Deployment kit created in $TARGET

  app=$APP  prefix=$PREFIX  domain=$DOMAIN
  images:  ghcr.io/ariasbenraq/${APP}-backend, ${APP}-frontend
  server:  /opt/${APP}
  edge:    ${PREFIX}-api:3000, ${PREFIX}-web:8080

Next: follow docs/guia-nuevo-proyecto.md (section "Por proyecto"). Review before
committing: ci.yml assumes backend/ and frontend/ folders, and docker-stack.yml
assumes API + web + Postgres + Redis. Delete what the new project does not use.
EOF
