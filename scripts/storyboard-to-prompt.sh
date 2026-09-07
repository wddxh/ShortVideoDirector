#!/usr/bin/env bash
# Convert one canonical storyboard shot to the video input protocol.

set -u

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

MODE=()
case "${1:-}" in
  --json) MODE=("$1"); shift ;;
esac
[ "$#" -eq 2 ] || fail 'usage: storyboard-to-prompt.sh [--json] <storyboard> <shot>'

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

command -v node >/dev/null 2>&1 || fail 'Node.js is required for storyboard parsing'
node "$SCRIPT_DIR/storyboard-to-prompt.mjs" "${MODE[@]}" "$STORYBOARD" "$SHOT" "$EP"
