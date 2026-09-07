#!/usr/bin/env bash
# Detect the latest episode number in story/episodes/.
# Usage: bash scripts/latest-episode.sh
# Output: ep03 (or whatever the latest is)
# Exit codes: 0=found, 1=absent/empty episode tree, 2=invalid/unreadable tree

for DIR in story story/episodes; do
  if [ ! -e "$DIR" ] && [ ! -L "$DIR" ]; then
    exit 1
  fi
  if [ ! -d "$DIR" ] || [ ! -r "$DIR" ] || [ ! -x "$DIR" ]; then
    printf 'ERROR: Cannot inspect directory: %s\n' "$DIR" >&2
    exit 2
  fi
done

LATEST=''
LATEST_NUMBER=0
for DIR in story/episodes/ep*/; do
  [ -d "$DIR" ] || continue
  EP=${DIR%/}
  EP=${EP##*/}
  if [[ ! "$EP" =~ ^ep(0[1-9]|[1-9][0-9]+)$ ]]; then
    printf 'ERROR: Invalid episode directory: %s\n' "$DIR" >&2
    exit 2
  fi
  NUMBER=$((10#${EP#ep}))
  if [ "$NUMBER" -gt "$LATEST_NUMBER" ]; then
    LATEST=$EP
    LATEST_NUMBER=$NUMBER
  fi
done

if [ -z "$LATEST" ]; then
  exit 1
fi

printf '%s\n' "$LATEST"
exit 0
