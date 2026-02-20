#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
EMIT_SCRIPT="$ROOT_DIR/scripts/emit-stream-proof.sh"

if [[ ! -x "$EMIT_SCRIPT" ]]; then
  echo "emit script missing: $EMIT_SCRIPT" >&2
  exit 0
fi

sha="$(git rev-parse HEAD)"
msg="$(git log -1 --pretty=%s)"
ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

set +e
"$EMIT_SCRIPT" \
  --module "GIT" \
  --level "info" \
  --msg "post-commit proof sha=$sha msg=$msg time=$ts" \
  --terminal "git commit $sha" \
  --commit-increment
code=$?
set -e

if [[ $code -ne 0 ]]; then
  echo "post-commit proof failed (non-blocking): exit=$code" >&2
fi

exit 0