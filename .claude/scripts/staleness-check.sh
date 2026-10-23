#!/usr/bin/env bash
# Staleness check for CLAUDE.md — run at the start of every session, before the first task.
#   bash .claude/scripts/staleness-check.sh           # full: doc drift + tests/type-check/lint baseline
#   bash .claude/scripts/staleness-check.sh --quick   # doc drift only (no npm runs)
# Prints facts only; deciding what is stale (and updating CLAUDE.md / OPEN-ISSUES.md) is up to the reader.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
DOC=CLAUDE.md
# npm workspace with the React app; the client core is a dependency (@magiden/client-core, its own repo).
PKGS="magid-app"
SRCS="magid-app/src"
# The installed core: names from it (MagidClient, ELEMENT_PARSERS, …) are not reported as missing.
CORE="node_modules/@magiden/client-core/src"
# Sibling server repo; names that live there (protocol classes, MAGID-XML-DSL.md) are not reported as missing.
SERVER="${MAGID_SERVER_REPO:-$(dirname "$PWD")/com.zarterstein}"

last=$(git log -1 --format=%H -- "$DOC")
echo "== $DOC last committed: $(git log -1 --format='%h %cs' -- "$DOC")$(git diff --quiet -- "$DOC" || echo '  (has uncommitted edits)')"

echo "== Commits touching $SRCS since then:"
git log --oneline "${last}..HEAD" -- $SRCS | head -25
echo "== Uncommitted changes in $SRCS:"
git status --short -- $SRCS | head -25

echo "== Paths named in $DOC that do not exist:"
missing=0
for p in $(grep -oE '`[^`]*`' "$DOC" | tr -d '`' | grep -oE '(src|public)/[A-Za-z0-9_./-]+\.[a-z]+' | sort -u); do
  found=0; for pkg in $PKGS; do [ -e "$pkg/$p" ] && found=1; done
  [ $found -eq 1 ] || { echo "   $p"; missing=1; }
done
for d in $(grep -oE '`[A-Za-z0-9_.-]+\.md`' "$DOC" | tr -d '`' | sort -u); do
  [ -n "$(git ls-files -- "$d" "*/$d")" ] && continue
  [ -e "$SERVER/$d" ] && continue
  echo "   $d (referenced document)"; missing=1
done
[ $missing -eq 0 ] && echo "   (none)"

echo "== Identifiers named in $DOC not found in $SRCS:"
missing=0
for id in $(grep -oE '`[A-Za-z_][A-Za-z0-9_]{3,}`' "$DOC" | tr -d '`' | grep -E '[a-z][A-Z]|^[A-Z][A-Z0-9_]+$' | sort -u); do
  grep -rqw -- "$id" $SRCS && continue
  [ -d "$CORE" ] && grep -rqw -- "$id" "$CORE" && continue
  [ -d "$SERVER" ] && grep -rqw --include=*.java -- "$id" "$SERVER/story-server" "$SERVER/core/src/main" 2>/dev/null && continue
  echo "   $id"; missing=1
done
[ $missing -eq 0 ] && echo "   (none)"

[ "${1:-}" = "--quick" ] && exit 0

for pkg in $PKGS; do
  echo "######## $pkg"
  ( cd "$pkg" || exit 1
    echo "== Tests (vitest):"
    out=$(npx vitest run 2>&1)
    echo "$out" | grep -E '^\s*(Test Files|Tests)\s' | sed 's/^/   /'
    echo "$out" | grep -E '^\s+FAIL\s|×' | sed 's/^ */   /' | sort -u | head -20
    echo "== Type-check:"
    if [ -f tsconfig.app.json ]; then tc="npx tsc -b"; else tc="npx tsc --noEmit"; fi
    if out=$($tc 2>&1); then echo "   clean"; else echo "$out" | grep -c 'error TS' | sed 's/^/   errors: /'; fi
    echo "== Lint (eslint):"
    out=$(npx eslint . 2>&1); echo "$out" | grep -E '^✖' | sed 's/^/   /'; [ -z "$out" ] && echo "   clean"
  )
done
echo "== Compare with OPEN-ISSUES.md; anything new or contradicting CLAUDE.md must be reported before starting work."
