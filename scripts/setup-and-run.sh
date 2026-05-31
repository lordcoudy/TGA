#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE="$ROOT_DIR/.env.example"
MODE=""
DRY_RUN=0
SKIP_INSTALL=0
SKIP_MIGRATE=0

usage() {
  cat <<'EOF'
Usage: ./scripts/setup-and-run.sh [options]

Interactive setup and launcher for Telegram Chat Analytics.

Options:
  --mode configure|dev|docker  Skip the menu and choose an action.
  --dry-run                    Print launch steps without changing files or starting services.
  --skip-install               Do not run npm install.
  --skip-migrate               Do not apply database migrations.
  -h, --help                   Show this help.

Modes:
  configure  Create or update .env only.
  dev        Configure, start Postgres/Redis, migrate, then run the local dev server.
  docker     Configure, migrate, build, and start the complete Docker stack.
EOF
}

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

run() {
  printf '+'
  printf ' %q' "$@"
  printf '\n'
  if [[ "$DRY_RUN" -eq 0 ]]; then
    "$@"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

env_value() {
  local key="$1"
  local value
  [[ -f "$ENV_FILE" ]] || return 0
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  if [[ "$value" == \"*\" ]]; then
    value="${value:1:${#value}-2}"
    value="$(printf '%s' "$value" | sed 's/\\"/"/g; s/\\\\/\\/g')"
  fi
  printf '%s' "$value"
}

prompt_value() {
  local key="$1"
  local label="$2"
  local default_value="${3:-}"
  local secret="${4:-0}"
  local current
  local answer
  current="$(env_value "$key")"
  if [[ -z "$current" ]]; then
    current="$default_value"
  fi

  if [[ "$secret" -eq 1 ]]; then
    if [[ -n "$current" ]]; then
      printf '%s [configured, press Enter to keep]: ' "$label"
    else
      printf '%s: ' "$label"
    fi
    IFS= read -rs answer
    printf '\n'
  else
    printf '%s [%s]: ' "$label" "$current"
    IFS= read -r answer
  fi
  printf -v "$key" '%s' "${answer:-$current}"
}

dotenv_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '"%s"' "$value"
}

write_env() {
  local tmp
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "Dry run: would write $ENV_FILE with configured values and chmod 600"
    return
  fi
  tmp="$(mktemp "${TMPDIR:-/tmp}/tga-env.XXXXXX")"
  {
    printf 'TELEGRAM_API_ID=%s\n' "$(dotenv_escape "$TELEGRAM_API_ID")"
    printf 'TELEGRAM_API_HASH=%s\n' "$(dotenv_escape "$TELEGRAM_API_HASH")"
    printf 'TELEGRAM_SESSION_ENCRYPTION_KEY=%s\n' "$(dotenv_escape "$TELEGRAM_SESSION_ENCRYPTION_KEY")"
    printf 'TELEGRAM_OIDC_CLIENT_ID=%s\n' "$(dotenv_escape "$TELEGRAM_OIDC_CLIENT_ID")"
    printf 'TELEGRAM_OIDC_CLIENT_SECRET=%s\n' "$(dotenv_escape "$TELEGRAM_OIDC_CLIENT_SECRET")"
    printf 'TELEGRAM_OIDC_REDIRECT_URI=%s\n' "$(dotenv_escape "$TELEGRAM_OIDC_REDIRECT_URI")"
    printf 'DATABASE_URL=%s\n' "$(dotenv_escape "$DATABASE_URL")"
    printf 'REDIS_URL=%s\n' "$(dotenv_escape "$REDIS_URL")"
  } > "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
  log "Saved $ENV_FILE with permissions 600"
}

configure_env() {
  [[ -f "$ENV_EXAMPLE" ]] || die "Missing $ENV_EXAMPLE"
  log "Configure environment"
  printf 'Telegram credentials may be left blank for browser-only JSON analysis.\n'
  prompt_value TELEGRAM_API_ID "Telegram API ID"
  prompt_value TELEGRAM_API_HASH "Telegram API hash" "" 1
  prompt_value TELEGRAM_OIDC_CLIENT_ID "Telegram OIDC client ID"
  prompt_value TELEGRAM_OIDC_CLIENT_SECRET "Telegram OIDC client secret" "" 1
  prompt_value TELEGRAM_OIDC_REDIRECT_URI "Telegram OIDC callback URL" "http://localhost:3000/api/auth/telegram/callback"
  prompt_value DATABASE_URL "Local Postgres URL" "postgres://tga:tga@localhost:5432/tga"
  prompt_value REDIS_URL "Local Redis URL" "redis://localhost:6379"

  TELEGRAM_SESSION_ENCRYPTION_KEY="$(env_value TELEGRAM_SESSION_ENCRYPTION_KEY)"
  if [[ -z "$TELEGRAM_SESSION_ENCRYPTION_KEY" ]]; then
    require_command openssl
    TELEGRAM_SESSION_ENCRYPTION_KEY="$(openssl rand -base64 32 | tr -d '\n')"
    log "Generated TELEGRAM_SESSION_ENCRYPTION_KEY"
  fi
  write_env
}

install_dependencies() {
  if [[ "$SKIP_INSTALL" -eq 1 ]]; then
    log "Skipping npm install"
    return
  fi
  require_command npm
  log "Install Node.js dependencies"
  run npm install
}

start_data_services() {
  require_command docker
  log "Start Postgres and Redis"
  run docker compose up -d db redis
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return
  fi
  log "Wait for Postgres"
  local attempt
  for attempt in {1..30}; do
    if docker compose exec -T db pg_isready -U tga -d tga >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  die "Postgres did not become ready within 30 seconds."
}

migrate_database() {
  if [[ "$SKIP_MIGRATE" -eq 1 ]]; then
    log "Skipping database migrations"
    return
  fi
  log "Apply database migrations"
  run npm run db:migrate
}

run_dev() {
  configure_env
  install_dependencies
  start_data_services
  migrate_database
  log "Start local development server at http://localhost:3000"
  run npm run dev
}

run_docker() {
  configure_env
  install_dependencies
  start_data_services
  migrate_database
  log "Build and start application container at http://localhost:3000"
  run docker compose up -d --build app
  if [[ "$DRY_RUN" -eq 0 ]]; then
    docker compose ps
  fi
}

choose_mode() {
  cat <<'EOF'

Telegram Chat Analytics setup
  1) Configure .env only
  2) Configure and run local development server
  3) Configure and run complete Docker stack
  4) Exit
EOF
  printf 'Choose an option [2]: '
  local choice
  IFS= read -r choice
  case "${choice:-2}" in
    1) MODE="configure" ;;
    2) MODE="dev" ;;
    3) MODE="docker" ;;
    4) exit 0 ;;
    *) die "Unknown menu option: $choice" ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      [[ $# -ge 2 ]] || die "--mode requires a value"
      MODE="$2"
      shift 2
      ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

cd "$ROOT_DIR"
if [[ -z "$MODE" ]]; then
  choose_mode
fi

case "$MODE" in
  configure) configure_env ;;
  dev) run_dev ;;
  docker) run_docker ;;
  *) die "Unknown mode: $MODE" ;;
esac
