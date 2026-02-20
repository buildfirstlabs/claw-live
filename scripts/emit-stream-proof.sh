#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${CLAW_LIVE_URL:-http://localhost:3030}"
LEVEL="info"
MODULE="PROOF"
MSG=""
TERMINAL=""
STATUS=""
BUILD_STATUS=""
FILE_UPDATE=""
COMMIT_INCREMENT="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url) BASE_URL="$2"; shift 2 ;;
    --level) LEVEL="$2"; shift 2 ;;
    --module) MODULE="$2"; shift 2 ;;
    --msg) MSG="$2"; shift 2 ;;
    --terminal) TERMINAL="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --build-status) BUILD_STATUS="$2"; shift 2 ;;
    --file-update) FILE_UPDATE="$2"; shift 2 ;;
    --commit-increment) COMMIT_INCREMENT="true"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$MSG" && -z "$TERMINAL" && -z "$STATUS" && -z "$BUILD_STATUS" && -z "$FILE_UPDATE" && "$COMMIT_INCREMENT" != "true" ]]; then
  echo "Nothing to send. Provide at least one field (e.g. --msg)." >&2
  exit 2
fi

payload="$(python3 - "$LEVEL" "$MODULE" "$MSG" "$TERMINAL" "$STATUS" "$BUILD_STATUS" "$FILE_UPDATE" "$COMMIT_INCREMENT" <<'PY'
import json, sys
level, module, msg, terminal, status, build_status, file_update, commit_increment = sys.argv[1:]
out = {}
if msg:
    out["log"] = {"level": level, "module": module, "msg": msg}
if terminal:
    out["terminal"] = terminal
if status:
    out["status"] = status.lower() in ("1", "true", "yes", "on")
if build_status:
    out["buildStatus"] = build_status
if file_update:
    out["fileUpdate"] = file_update
if commit_increment == "true":
    out["commitIncrement"] = True
print(json.dumps(out, ensure_ascii=False))
PY
)"

curl -fsS -X POST "$BASE_URL/api/stream" \
  -H 'Content-Type: application/json' \
  --data "$payload" >/dev/null

echo "proof sent -> $BASE_URL/api/stream"