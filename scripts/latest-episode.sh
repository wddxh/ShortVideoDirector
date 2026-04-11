#!/usr/bin/env bash
# Detect the latest episode number in story/episodes/.
# Usage: bash scripts/latest-episode.sh
# Output: ep03 (or whatever the latest is)
# Exit codes: 0=found, 1=no episodes

if [ ! -d "story/episodes" ]; then
  exit 1
fi

LATEST=$(ls -d story/episodes/ep*/ 2>/dev/null | sed 's|story/episodes/||' | sed 's|/||' | sort -t'p' -k2 -n | tail -1)

if [ -z "$LATEST" ]; then
  exit 1
fi

echo "$LATEST"
exit 0
