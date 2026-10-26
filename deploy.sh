#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$ROOT_DIR"
ENV_NAME="${1:-}"
COMMAND="${2:-up}"
ENV_FILE="$ROOT_DIR/.env.uat"
COMPOSE_FILE="$ROOT_DIR/docker-compose.uat.yml"
LOG_DIR="$ROOT_DIR/.deploy-logs"

DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-Yossawat-75/j-document-dms}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_GIT_URL="${DEPLOY_GIT_URL:-git@github.com:${DEPLOY_REPOSITORY}.git}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/j_document_dms_uat_deploy}"
NO_CACHE=false
SKIP_PULL=false

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  RESET=$'\033[0m'; BOLD=$'\033[1m'; RED=$'\033[38;5;203m'
  GREEN=$'\033[38;5;84m'; YELLOW=$'\033[38;5;221m'; BLUE=$'\033[38;5;75m'
  CYAN=$'\033[38;5;80m'; GRAY=$'\033[38;5;245m'
else
  RESET=""; BOLD=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN=""; GRAY=""
fi

ok() { printf "  ${GREEN}✔${RESET}  %s\n" "$1"; }
info() { printf "  ${BLUE}●${RESET}  %s\n" "$1"; }
warn() { printf "  ${YELLOW}▲${RESET}  %s\n" "$1"; }
fail() { printf "  ${RED}✖ %s${RESET}\n" "$1" >&2; }
die() { fail "$1"; exit 1; }

usage() {
  cat <<EOF
${BOLD}J-Document DMS UAT deployment${RESET}

Usage:
  bash deploy.sh uat [command] [--no-cache] [--no-pull]

Commands:
  up           Sync, build, initialize dependencies, and deploy (default)
  build        Sync and build UAT images only
  preflight    Validate UAT configuration without deploying
  restart      Restart API, worker, and web containers
  down         Stop the UAT stack
  logs         Follow UAT logs
  ps           Show UAT service status
  github-key   Create/check the read-only GitHub deploy key

Options:
  --no-cache   Build images without Docker layer cache
  --no-pull    Use the current checkout without GitHub synchronization

Deploy key:
  DEPLOY_SSH_KEY defaults to:
    $HOME/.ssh/j_document_dms_uat_deploy

Examples:
  bash deploy.sh uat github-key
  bash deploy.sh uat preflight
  bash deploy.sh uat up
  bash deploy.sh uat up --no-cache
  bash deploy.sh uat build --no-pull
EOF
}

if [[ "$ENV_NAME" != "uat" ]]; then
  fail "Only the UAT environment is supported."
  usage >&2
  exit 1
fi

case "$COMMAND" in
  up|build|preflight|restart|down|logs|ps|github-key) ;;
  *) fail "Unknown command: $COMMAND"; usage >&2; exit 1 ;;
esac

if [[ "$#" -gt 2 ]]; then
  shift 2
  for option in "$@"; do
    case "$option" in
      --no-cache) NO_CACHE=true ;;
      --no-pull) SKIP_PULL=true ;;
      *) die "Unknown option: $option" ;;
    esac
  done
fi

mkdir -p "$LOG_DIR"

read_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1 | tr -d '\r'
}

require_env() {
  local key="$1" value
  value="$(read_env "$key")"
  [[ -n "$value" ]] || die "$key is required in .env.uat"
  case "$value" in
    replace_*|your_*|change-me|password123|minioadmin) die "$key still contains an insecure placeholder" ;;
  esac
}

require_exact_env() {
  local key="$1" expected="$2" actual
  actual="$(read_env "$key")"
  [[ "$actual" == "$expected" ]] || die "$key must be '$expected' in .env.uat"
}

export ENV_FILE=".env.uat"
export COMPOSE_PROJECT_NAME="j-document-dms-uat"
export IMAGE_TAG="uat-$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo local)"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

ensure_shared_minio_network() {
  local minio_container network attached_networks
  minio_container="$(read_env MINIO_ENDPOINT)"
  network="$(read_env TRAEFIK_NETWORK)"

  docker container inspect "$minio_container" >/dev/null 2>&1 \
    || die "Shared MinIO container '$minio_container' was not found"

  attached_networks="$(docker container inspect \
    --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
    "$minio_container")"

  if printf '%s\n' "$attached_networks" | grep -Fxq "$network"; then
    ok "Shared MinIO is connected to $network"
    return 0
  fi

  info "Connecting shared MinIO '$minio_container' to $network"
  docker network connect --alias "$minio_container" "$network" "$minio_container"
  ok "Shared MinIO connected to $network"
}

preflight() {
  info "Validating UAT configuration"
  command -v docker >/dev/null 2>&1 || die "Docker is unavailable"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is unavailable"
  command -v git >/dev/null 2>&1 || die "Git is unavailable"
  [[ -f "$ENV_FILE" ]] || die "Missing $ENV_FILE"
  [[ -f "$COMPOSE_FILE" ]] || die "Missing $COMPOSE_FILE"

  require_exact_env APP_ENV "uat"
  require_exact_env APP_DOMAIN "uat-intranet.jibcomputer.group"
  require_exact_env API_DOMAIN "api-uat-intranet.jibcomputer.group"
  require_exact_env DMS_BASE_PATH "/j-document-dms"
  require_exact_env PUBLIC_APP_URL "https://uat-intranet.jibcomputer.group/j-document-dms"
  require_exact_env API_PUBLIC_URL "https://api-uat-intranet.jibcomputer.group"
  require_exact_env VITE_API_BASE_URL "https://api-uat-intranet.jibcomputer.group/j-document-dms/api"
  require_exact_env GITHUB_REDIRECT_URI "https://api-uat-intranet.jibcomputer.group/j-document-dms/api/auth/github/callback"
  require_exact_env MINIO_ENDPOINT "minio"
  require_exact_env MINIO_PORT "9000"
  require_exact_env MINIO_USE_SSL "false"
  require_exact_env MINIO_PUBLIC_URL "https://minio-uat-intranet.jibcomputer.group"
  require_exact_env REDIS_URL "redis://redis:6379/2"
  require_exact_env CELERY_BROKER_URL "redis://redis:6379/0"
  require_exact_env CELERY_RESULT_BACKEND "redis://redis:6379/1"

  for key in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL \
    MINIO_ENDPOINT MINIO_PORT MINIO_ACCESS_KEY MINIO_SECRET_KEY MINIO_PUBLIC_URL MINIO_BUCKET_NAME \
    JWT_SECRET DMS_ADMIN_USERNAME DMS_ADMIN_PASSWORD DMS_ADMIN_FULL_NAME DMS_ADMIN_DEPARTMENT_ID \
    GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GITHUB_ALLOWED_EMAILS GITHUB_ADMIN_EMAILS TRAEFIK_NETWORK; do
    require_env "$key"
  done

  [[ "$(read_env JWT_SECRET)" =~ ^[A-Za-z0-9_-]{64,}$ ]] || die "JWT_SECRET must contain at least 64 safe characters"

  if ! docker network inspect "$(read_env TRAEFIK_NETWORK)" >/dev/null 2>&1; then
    info "Creating external Docker network: $(read_env TRAEFIK_NETWORK)"
    docker network create "$(read_env TRAEFIK_NETWORK)" >/dev/null
  fi

  ensure_shared_minio_network
  compose config --quiet
  ok "UAT pre-flight checks passed"
}

github_key() {
  command -v ssh-keygen >/dev/null 2>&1 || die "OpenSSH ssh-keygen is unavailable"
  command -v git >/dev/null 2>&1 || die "Git is unavailable"

  mkdir -p "$(dirname "$DEPLOY_SSH_KEY")"
  chmod 700 "$(dirname "$DEPLOY_SSH_KEY")"

  if [[ ! -f "$DEPLOY_SSH_KEY" ]]; then
    info "Creating a read-only GitHub deploy key pair"
    ssh-keygen -t ed25519 -N "" -C "j-document-dms-uat-deploy" -f "$DEPLOY_SSH_KEY" >/dev/null
    chmod 600 "$DEPLOY_SSH_KEY"
    chmod 644 "${DEPLOY_SSH_KEY}.pub"
  fi

  printf "\nAdd this public key to:\n"
  printf "  https://github.com/%s/settings/keys\n" "$DEPLOY_REPOSITORY"
  printf "Keep 'Allow write access' disabled.\n\n"
  cat "${DEPLOY_SSH_KEY}.pub"
  printf "\n"

  if ! ssh-keygen -F github.com >/dev/null 2>&1; then
    warn "github.com is missing from ~/.ssh/known_hosts"
    warn "Verify GitHub's official SSH host fingerprints, then add them before deploy"
    return 0
  fi

  export GIT_SSH_COMMAND="ssh -i '$DEPLOY_SSH_KEY' -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ForwardAgent=no"
  if git ls-remote "$DEPLOY_GIT_URL" HEAD >/dev/null 2>&1; then
    ok "GitHub deploy-key authentication works"
  else
    warn "The key is not authorized yet. Add the public key in GitHub, then run this command again"
  fi
}

sync_source() {
  if [[ "$SKIP_PULL" == true ]]; then
    warn "Skipping GitHub sync (--no-pull)"
    return 0
  fi

  [[ -d "$ROOT_DIR/.git" ]] || die "$ROOT_DIR is not a Git repository"
  [[ -f "$DEPLOY_SSH_KEY" && -r "$DEPLOY_SSH_KEY" ]] || die "Deploy key is missing: $DEPLOY_SSH_KEY. Run 'bash deploy.sh uat github-key' first"
  [[ -z "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)" ]] || die "Working tree is not clean. Commit or back up changes before deployment"
  [[ "$(git -C "$ROOT_DIR" symbolic-ref --short HEAD)" == "$DEPLOY_BRANCH" ]] || die "Checkout must be on branch $DEPLOY_BRANCH"
  git check-ref-format --branch "$DEPLOY_BRANCH" >/dev/null 2>&1 || die "Invalid DEPLOY_BRANCH"

  export GIT_TERMINAL_PROMPT=0
  export GIT_SSH_COMMAND="ssh -i '$DEPLOY_SSH_KEY' -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ForwardAgent=no"
  info "Fetching $DEPLOY_REPOSITORY/$DEPLOY_BRANCH"
  git -C "$ROOT_DIR" fetch --no-tags "$DEPLOY_GIT_URL" "refs/heads/$DEPLOY_BRANCH"

  local fetched_commit
  fetched_commit="$(git -C "$ROOT_DIR" rev-parse FETCH_HEAD)"
  if [[ -n "${DEPLOY_EXPECTED_COMMIT:-}" ]]; then
    [[ "$DEPLOY_EXPECTED_COMMIT" =~ ^[0-9a-fA-F]{40}$ ]] || die "DEPLOY_EXPECTED_COMMIT must be a full 40-character SHA"
    [[ "${fetched_commit,,}" == "${DEPLOY_EXPECTED_COMMIT,,}" ]] || die "Fetched commit does not match DEPLOY_EXPECTED_COMMIT"
  fi

  git -C "$ROOT_DIR" merge-base --is-ancestor HEAD "$fetched_commit" || die "Local branch diverged or is ahead; refusing to reset"
  git -C "$ROOT_DIR" merge --ff-only "$fetched_commit"
  export IMAGE_TAG="uat-$(git -C "$ROOT_DIR" rev-parse --short HEAD)"
  ok "Source synchronized at $IMAGE_TAG"
}

build_images() {
  local cache_args=()
  [[ "$NO_CACHE" == true ]] && cache_args+=(--no-cache)
  info "Building UAT images: $IMAGE_TAG"
  DOCKER_BUILDKIT=1 compose build "${cache_args[@]}" backend worker frontend
  ok "UAT images built"
}

deploy_stack() {
  info "Starting PostgreSQL and Redis"
  compose up -d --remove-orphans --wait --wait-timeout 120 postgres redis

  info "Creating or updating the application administrator"
  compose run --rm --no-deps backend python -m app.scripts.bootstrap_admin \
    || die "Unable to bootstrap the application administrator"
  ok "Application administrator is ready"

  info "Verifying shared MinIO access and bucket"
  compose run --rm --no-deps backend python -c \
    "from app.core.config import settings; from app.services.storage import get_minio_client; raise SystemExit(0 if get_minio_client().bucket_exists(settings.MINIO_BUCKET_NAME) else 1)" \
    || die "Cannot access shared MinIO bucket: $(read_env MINIO_BUCKET_NAME)"
  ok "Shared MinIO bucket is accessible"

  info "Starting API, OCR worker, and frontend"
  compose up -d --remove-orphans --wait --wait-timeout 240 backend worker frontend
  compose ps

  local app_url api_url base_path
  app_url="$(read_env PUBLIC_APP_URL)"
  api_url="$(read_env API_PUBLIC_URL)"
  base_path="$(read_env DMS_BASE_PATH)"
  ok "UAT deployment completed"
  printf "  Web: %s/\n" "$app_url"
  printf "  API health: %s%s/health/ready\n" "$api_url" "$base_path"
  printf "  Shared MinIO: %s (bucket: %s)\n" "$(read_env MINIO_PUBLIC_URL)" "$(read_env MINIO_BUCKET_NAME)"
}

case "$COMMAND" in
  github-key)
    github_key
    ;;
  preflight)
    preflight
    ;;
  build)
    sync_source
    preflight
    build_images
    ;;
  up)
    sync_source
    preflight
    build_images
    deploy_stack
    ;;
  restart)
    preflight
    compose restart backend worker frontend
    compose ps
    ;;
  down)
    preflight
    compose down --remove-orphans
    ;;
  logs)
    preflight
    compose logs -f --tail=200
    ;;
  ps)
    preflight
    compose ps
    ;;
esac
