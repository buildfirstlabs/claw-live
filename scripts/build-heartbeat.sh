#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
EMIT_SCRIPT="$ROOT_DIR/scripts/emit-stream-proof.sh"
PID_FILE="$ROOT_DIR/.git/.build-heartbeat.pid"
LOG_FILE="$ROOT_DIR/.git/.build-heartbeat.log"
BASE_URL="${CLAW_LIVE_URL:-http://localhost:3030}"
INTERVAL="${HEARTBEAT_INTERVAL_SEC:-20}"

usage() {
  echo "Usage: $0 {start|stop|status} [--interval SEC] [--base-url URL]"
}

cmd="${1:-}"
[[ -n "$cmd" ]] || { usage; exit 2; }
shift || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interval) INTERVAL="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

is_running() {
  [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

case "$cmd" in
  start)
    if is_running; then
      echo "build heartbeat already running (pid=$(cat "$PID_FILE"))"
      exit 0
    fi

    nohup bash -c '
      set -euo pipefail
      while true; do
        ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        "'$EMIT_SCRIPT'" --base-url "'$BASE_URL'" --module BUILD --level info --msg "build heartbeat tick time=$ts" --build-status building || true
        sleep "'$INTERVAL'"
      done
    ' >>"$LOG_FILE" 2>&1 &

    echo $! > "$PID_FILE"
    "$EMIT_SCRIPT" --base-url "$BASE_URL" --module BUILD --level info --msg "build heartbeat started interval=${INTERVAL}s" --build-status building || true
    echo "build heartbeat started (pid=$(cat "$PID_FILE"), interval=${INTERVAL}s)"
    ;;

  stop)
    if ! is_running; then
      rm -f "$PID_FILE"
      "$EMIT_SCRIPT" --base-url "$BASE_URL" --module BUILD --level info --msg "build heartbeat already stopped" --build-status idle || true
      echo "build heartbeat is not running"
      exit 0
    fi
    pid="$(cat "$PID_FILE")"
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_FILE"
    "$EMIT_SCRIPT" --base-url "$BASE_URL" --module BUILD --level info --msg "build heartbeat stopped" --build-status idle || true
    echo "build heartbeat stopped"
    ;;

  status)
    if is_running; then
      echo "running (pid=$(cat "$PID_FILE"))"
    else
      echo "stopped"
    fi
    ;;

  *)
    usage
    exit 2
    ;;
esac