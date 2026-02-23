#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

required_files=("tasks.md" "context.md" "loop_state.json" "LOOP_AGENT.md")

echo "[loop-check] root: $ROOT_DIR"
for f in "${required_files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "[loop-check] ERROR: missing $f"
    exit 1
  fi
  if [[ ! -s "$f" ]]; then
    echo "[loop-check] ERROR: empty $f"
    exit 1
  fi
  echo "[loop-check] ok: $f"
done

if command -v jq >/dev/null 2>&1; then
  jq -e '.run.total_cycles != null and .retry.max_consecutive_failures_before_escalation != null and .last_result.proof != null' loop_state.json >/dev/null || {
    echo "[loop-check] ERROR: loop_state.json missing required keys"
    exit 1
  }
else
  grep -q '"total_cycles"' loop_state.json || { echo "[loop-check] ERROR: missing total_cycles"; exit 1; }
  grep -q '"max_consecutive_failures_before_escalation"' loop_state.json || { echo "[loop-check] ERROR: missing escalation threshold"; exit 1; }
  grep -q '"proof"' loop_state.json || { echo "[loop-check] ERROR: missing proof field"; exit 1; }
fi

next_task="$(grep -nE '^([0-9]+\.) \[todo\] ' tasks.md | head -n1 || true)"

if [[ -z "$next_task" ]]; then
  echo "[loop-check] NEXT: no actionable todo task found"
  exit 0
fi

echo "[loop-check] NEXT: $next_task"
