#!/usr/bin/env bash
# =============================================================
# status.sh - 現在のデプロイ状況を表示
#
# Usage:
#   ./scripts/status.sh
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_FILE="$PROJECT_DIR/.deploy-state"
IMAGE_NAME="${IMAGE_NAME:-jnavi-app}"

# ----- Helpers -----
info()  { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
ok()    { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m  $*"; }

echo ""
echo "========================================="
echo " Deployment Status"
echo "========================================="

# ----- State file -----
if [[ -f "$STATE_FILE" ]]; then
    source "$STATE_FILE"
    echo " Active env:   $ACTIVE_ENV"
    echo " Active tag:   $ACTIVE_TAG"
    echo " Previous env: ${PREVIOUS_ENV:-none}"
    echo " Previous tag: ${PREVIOUS_TAG:-none}"
    echo " Last deploy:  ${DEPLOY_TIME:-unknown}"
else
    warn "No deploy state file found. No deployments have been made."
fi

echo "========================================="
echo ""

# ----- Container status -----
info "Container status:"
for env in blue green proxy; do
    name="jnavi-$env"
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "$name"; then
        status="$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo 'no-healthcheck')"
        ok "$name: running (health: $status)"
    elif docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "$name"; then
        warn "$name: stopped"
    else
        warn "$name: not found"
    fi
done

echo ""

# ----- Available image tags -----
info "Available image tags for $IMAGE_NAME:"
docker images "$IMAGE_NAME" --format "  {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" 2>/dev/null || echo "  (no images found)"

echo ""

# ----- Git deploy tags -----
info "Git deploy tags (recent 10):"
git -C "$PROJECT_DIR" tag -l 'deploy/*' --sort=-creatordate 2>/dev/null | head -10 | while read -r tag; do
    echo "  $tag"
done || echo "  (no deploy tags found)"

echo ""
