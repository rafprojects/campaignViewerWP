#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# compute-version.sh — Auto-compute next SemVer from conventional commits
#
# Usage: ./scripts/compute-version.sh
#
# Scans commits since the last git tag and determines the appropriate version
# bump based on conventional commit types:
#   feat:           → MINOR bump
#   fix:, chore:, etc. → PATCH bump
#   BREAKING CHANGE / !: → MAJOR bump (or MINOR if pre-1.0)
#
# Outputs the computed next version to stdout (e.g., "0.18.0").
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Get the latest tag, or default to v0.0.0 if none exists.
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
CURRENT_VERSION="${LAST_TAG#v}"  # Strip leading "v"

# Parse current version components.
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
MAJOR=${MAJOR:-0}
MINOR=${MINOR:-0}
PATCH=${PATCH:-0}

# Determine if we are pre-1.0.
PRE_V1=false
if [ "$MAJOR" -eq 0 ]; then
  PRE_V1=true
fi

# Collect commit subjects since the last tag.
if [ "$LAST_TAG" = "v0.0.0" ]; then
  COMMITS=$(git log --pretty=format:"%s%n%b" HEAD 2>/dev/null || echo "")
else
  COMMITS=$(git log --pretty=format:"%s%n%b" "${LAST_TAG}..HEAD" 2>/dev/null || echo "")
fi

if [ -z "$COMMITS" ]; then
  echo >&2 "No commits found since $LAST_TAG — defaulting to PATCH bump."
  echo "$MAJOR.$MINOR.$((PATCH + 1))"
  exit 0
fi

# Scan for bump indicators.
HAS_BREAKING=false
HAS_FEAT=false

while IFS= read -r line; do
  # Check for breaking change markers.
  if echo "$line" | grep -qiE '^[a-z]+(\(.+\))?!:'; then
    HAS_BREAKING=true
  fi
  if echo "$line" | grep -qi 'BREAKING CHANGE'; then
    HAS_BREAKING=true
  fi
  # Check for feat: commits.
  if echo "$line" | grep -qE '^feat(\(.+\))?:'; then
    HAS_FEAT=true
  fi
done <<< "$COMMITS"

# Determine bump level.
if $HAS_BREAKING; then
  if $PRE_V1; then
    # Pre-1.0: breaking changes bump MINOR (MAJOR reserved for deliberate 1.0.0).
    NEXT="$MAJOR.$((MINOR + 1)).0"
  else
    NEXT="$((MAJOR + 1)).0.0"
  fi
elif $HAS_FEAT; then
  NEXT="$MAJOR.$((MINOR + 1)).0"
else
  NEXT="$MAJOR.$MINOR.$((PATCH + 1))"
fi

echo "$NEXT"
