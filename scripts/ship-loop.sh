#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_URL="${APP_URL:-http://localhost:3030}"
MAX_COMMIT_MIN="${MICRO_COMMIT_MAX_MIN:-20}"
REPORT_FILE="${REPORT_FILE:-}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[ship-loop] Not inside a git repo." >&2
  exit 1
fi

if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
  echo "[ship-loop] Branch must be main for this loop." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[ship-loop] git status not clean. Commit/stash first." >&2
  exit 1
fi

last_commit_ts="$(git log -1 --format=%ct)"
now_ts="$(date +%s)"
age_min="$(( (now_ts - last_commit_ts) / 60 ))"
if (( age_min > MAX_COMMIT_MIN )); then
  echo "[ship-loop] Last commit is ${age_min}min old (> ${MAX_COMMIT_MIN}min). Do a micro-commit now." >&2
  exit 1
fi

node --check server.js >/dev/null

status_json="$(curl -fsS "${APP_URL}/api/v2/registry/status")"
replay_json="$(curl -fsS "${APP_URL}/api/stream/replay?limit=3")"

echo "$status_json" | grep -q '"counts"'
echo "$replay_json" | grep -q '"events"\|\['

report=$(cat <<EOF
## ship-loop report
- ts_utc: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- branch: $(git rev-parse --abbrev-ref HEAD)
- head: $(git rev-parse --short HEAD)
- since_last_commit_min: ${age_min}
- checks:
  - git_status_clean: ok
  - node_check_server_js: ok
  - curl_registry_status: ok (${APP_URL}/api/v2/registry/status)
  - curl_stream_replay: ok (${APP_URL}/api/stream/replay?limit=3)
- next_micro_commit_before_min: ${MAX_COMMIT_MIN}
EOF
)

if [[ -n "$REPORT_FILE" ]]; then
  printf "%s\n" "$report" > "$REPORT_FILE"
  echo "[ship-loop] Report written to $REPORT_FILE"
else
  printf "%s\n" "$report"
fi
