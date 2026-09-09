#!/usr/bin/env bash
# Convert a canonical generation task to the video input protocol.

set -u

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

MODE=()
case "${1:-}" in
  --json) MODE=("$1"); shift ;;
esac
[ "$#" -eq 3 ] || fail 'usage: storyboard-to-prompt.sh [--json] STORYBOARD TASK_ID EP'

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)
STORYBOARD=$1
TASK_ID=$2
EP=$3

case "$STORYBOARD" in
  story/episodes/ep*/storyboard.md) ;;
  *) fail 'noncanonical storyboard path' ;;
esac

command -v node >/dev/null 2>&1 || fail 'Node.js is required for storyboard parsing'
node "$SCRIPT_DIR/storyboard-to-prompt.mjs" "${MODE[@]}" "$STORYBOARD" "$TASK_ID" "$EP"
