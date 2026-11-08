#!/usr/bin/env bash
# Deploys one git SHA to the Swarm stack. Runs on the server as the "deploy" user,
# from the directory that holds docker-stack.yml and .env (/opt/movilidad).
#
#   bash deploy.sh <40-character git sha>
#
# Steps: pull images -> migrate (if the DB already runs) -> stack deploy ->
# migrate (first deploy only) -> wait until both services are healthy.
# If a service does not become healthy, Swarm rolls it back by itself
# (failure_action: rollback) and this script exits with an error.
# Migrations are NOT rolled back: keep them backwards compatible.
set -euo pipefail

TAG="${1:-}"
if [[ ! "$TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: deploy.sh <40-character git sha>" >&2
  exit 2
fi

cd "$(dirname "$(readlink -f "$0")")"
[ -f .env ] || { echo "Missing $(pwd)/.env" >&2; exit 1; }

STACK="${STACK:-movilidad}"
export REGISTRY="${REGISTRY:-ghcr.io/ariasbenraq}"
export TAG
API_IMAGE="$REGISTRY/movilidad-backend:$TAG"
WEB_IMAGE="$REGISTRY/movilidad-frontend:$TAG"

# Values for ${...} in docker-stack.yml. Secrets stay in this process only.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

db_ready() {
  docker network inspect "${STACK}_internal" >/dev/null 2>&1 &&
    [ -n "$(docker ps -q \
      --filter "label=com.docker.swarm.service.name=${STACK}_postgres" \
      --filter "health=healthy")" ]
}

migrate() {
  echo "==> Running migrations ($TAG)"
  docker run --rm --network "${STACK}_internal" --env-file .env "$API_IMAGE" \
    node dist/database/run-migrations.js
}

# Succeeds when a task running the new image is healthy. Fails if Swarm rolled
# the service back (the spec no longer points at the new image) or on timeout.
wait_service() {
  local svc="${STACK}_$1" image state
  for _ in $(seq 1 90); do
    image="$(docker service inspect "$svc" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')"
    if [[ "$image" != *":$TAG"* ]]; then
      echo "FAILED: $svc was rolled back to $image" >&2
      return 1
    fi
    state="$(docker service inspect "$svc" --format '{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}')"
    case "$state" in
      paused | rollback_started | rollback_completed)
        echo "FAILED: update of $svc ended as $state" >&2
        return 1
        ;;
    esac
    if docker service ps "$svc" --filter desired-state=running \
      --format '{{.Image}} {{.CurrentState}}' | grep -q ":$TAG.* Running"; then
      echo "==> $svc is healthy"
      return 0
    fi
    sleep 2
  done
  echo "FAILED: $svc did not become healthy in time" >&2
  return 1
}

fail_report() {
  local failed
  docker service ps --no-trunc "${STACK}_$1" 2>&1 | head -6 >&2 || true
  failed="$(docker service ps "${STACK}_$1" --filter desired-state=shutdown \
    --format '{{.ID}} {{.Image}}' 2>/dev/null | grep ":$TAG" | head -1 | cut -d' ' -f1)"
  if [ -n "$failed" ]; then
    echo "--- last logs of the failed task $failed" >&2
    docker service logs --tail 20 --no-task-ids "$failed" 2>&1 | tail -20 >&2 || true
  fi
}

# After a failed deploy, put back the previous version of every service that
# still runs the new one, so frontend and API never end up on different versions.
rollback_new_version() {
  local svc image
  for svc in mov-api mov-web; do
    image="$(docker service inspect "${STACK}_$svc" \
      --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true)"
    if [[ "$image" == *":$TAG"* ]]; then
      echo "==> Rolling back $svc" >&2
      docker service rollback "${STACK}_$svc" >/dev/null 2>&1 || true
    fi
  done
}

echo "==> Pulling images for $TAG"
docker pull "$API_IMAGE"
docker pull "$WEB_IMAGE"

migrated=0
if db_ready; then
  migrate || { echo "FAILED: migrations; nothing was deployed" >&2; exit 1; }
  migrated=1
fi

echo "==> Deploying stack $STACK"
docker stack deploy --with-registry-auth --resolve-image always --prune \
  -c docker-stack.yml "$STACK"

if [ "$migrated" = 0 ]; then
  echo "==> First deploy: waiting for Postgres"
  for _ in $(seq 1 60); do
    db_ready && break
    sleep 2
  done
  db_ready || { echo "FAILED: Postgres did not become healthy" >&2; fail_report postgres; exit 1; }
  migrate || { echo "FAILED: migrations; the stack is running without a schema" >&2; exit 1; }
fi

for svc in mov-api mov-web; do
  if ! wait_service "$svc"; then
    fail_report "$svc"
    rollback_new_version
    echo "Deploy of $TAG failed. Still running: $(cat .current_tag 2>/dev/null || echo 'nothing')" >&2
    exit 1
  fi
done

[ -f .current_tag ] && cp .current_tag .previous_tag
echo "$TAG" > .current_tag

# Keep the 4 newest images of each repository for quick rollbacks; remove the rest.
# Images still in use are never removed (docker rmi refuses).
for repo in movilidad-backend movilidad-frontend; do
  docker images "$REGISTRY/$repo" --format '{{.Repository}}:{{.Tag}}' |
    tail -n +5 | xargs -r docker rmi >/dev/null 2>&1 || true
done

echo "==> Deployed $TAG"
