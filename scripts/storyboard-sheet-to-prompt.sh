#!/usr/bin/env bash
# Validate one sheet card, run the central legacy gate, then parse it.

set -u

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

[ "$#" -eq 1 ] || fail 'usage: storyboard-sheet-to-prompt.sh <card>'

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)
PARSER="$SCRIPT_DIR/storyboard-sheet-to-prompt.mjs"
CARD=$1

case "$CARD" in
  assets/storyboard-sheets/*/*) ;;
  *) fail 'noncanonical card: invalid path' ;;
esac
REST=${CARD#assets/storyboard-sheets/}
EP=${REST%%/*}
EP_DIGITS=${EP#ep}
case "$EP" in
  ep*) ;;
  *) fail 'noncanonical card: invalid path' ;;
esac
case "$EP_DIGITS" in
  ''|*[!0-9]*) fail 'noncanonical card: invalid path' ;;
esac
case "$EP_DIGITS" in
  0[1-9]|[1-9][0-9]|[1-9][0-9][0-9]*) ;;
  *) fail 'noncanonical card: invalid path' ;;
esac
command -v node >/dev/null 2>&1 || fail 'Node.js is required for storyboard sheet parsing'

STORYBOARD="story/episodes/$EP/storyboard.md"
TASKS="story/episodes/$EP/videos/tasks.json"
"$SCRIPT_DIR/detect-legacy-kf.sh" "$EP" "$STORYBOARD" "$TASKS"
STATUS=$?
[ "$STATUS" -eq 0 ] || exit "$STATUS"

node "$PARSER" "$CARD" "$EP"
