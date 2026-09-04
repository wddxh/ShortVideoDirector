#!/usr/bin/env bash
# Convert one canonical storyboard shot to the video input protocol.

set -u

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

[ "$#" -eq 2 ] || fail 'usage: storyboard-to-prompt.sh <storyboard> <shot>'

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)
STORYBOARD=$1
SHOT=$2

case "$STORYBOARD" in
  story/episodes/ep*/storyboard.md) ;;
  *) fail 'noncanonical storyboard path' ;;
esac
EP=${STORYBOARD#story/episodes/}
EP=${EP%%/*}
case "$SHOT" in
  ''|*[!0-9]*|0) fail 'invalid shot number' ;;
esac

"$SCRIPT_DIR/detect-legacy-kf.sh" "$EP" "$STORYBOARD" \
  "story/episodes/$EP/videos/tasks.json"
STATUS=$?
[ "$STATUS" -eq 0 ] || exit "$STATUS"

command -v node >/dev/null 2>&1 || fail 'Node.js is required for storyboard parsing'
node "$SCRIPT_DIR/storyboard-to-prompt.mjs" "$STORYBOARD" "$SHOT" "$EP"
