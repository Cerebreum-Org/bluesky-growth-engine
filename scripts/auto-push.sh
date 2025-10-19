#!/usr/bin/env bash
set -euo pipefail
INTERVAL="${INTERVAL:-60}"              # seconds
REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-}"                     # default: current branch
AUTOADD_NEW="${AUTOADD_NEW:-0}"          # 0=only tracked changes, 1=add new files too

cd "$(dirname "$0")/.."

# Ensure identity exists (uses existing global config)
GIT_AUTHOR_NAME=${GIT_AUTHOR_NAME:-$(git config user.name || echo "auto")}
GIT_AUTHOR_EMAIL=${GIT_AUTHOR_EMAIL:-$(git config user.email || echo "auto@example.com")}

while true; do
  # Discover current branch if not provided
  CUR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  TARGET_BRANCH=${BRANCH:-$CUR}

  # Fetch & rebase to avoid diverging
  git fetch "$REMOTE" >/dev/null 2>&1 || true
  git pull --rebase --autostash "$REMOTE" "$TARGET_BRANCH" >/dev/null 2>&1 || true

  # Stage changes
  if [[ "$AUTOADD_NEW" == "1" ]]; then
    git add -A
  else
    git add -u
  fi

  if ! git diff --cached --quiet; then
    msg="chore(autopush): $(hostname) $(date -Iseconds)"
    git commit -m "$msg" >/dev/null 2>&1 || true
    git push "$REMOTE" "$TARGET_BRANCH" >/dev/null 2>&1 || true
  fi

  sleep "$INTERVAL"
done
