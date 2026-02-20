#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
HOOK_PATH="$ROOT_DIR/.git/hooks/post-commit"

cat > "$HOOK_PATH" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(git rev-parse --show-toplevel)"
"$ROOT_DIR/scripts/git-post-commit-proof.sh" >/dev/null 2>&1 || true
HOOK

chmod +x "$HOOK_PATH"
echo "Installed git post-commit hook: $HOOK_PATH"
echo "Every commit will now auto-send proof (sha+message+time) to /api/stream."