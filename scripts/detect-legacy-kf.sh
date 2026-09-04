#!/usr/bin/env bash
# Detect artifacts from the legacy keyframe contract without modifying them.

set -u

fail_usage() {
  printf '%s\n' 'FAIL usage: detect-legacy-kf.sh <ep> [storyboard-path] [tasks-path]' >&2
  exit 1
}

[ "$#" -ge 1 ] && [ "$#" -le 3 ] || fail_usage

EP=$1
case "$EP" in
  ep[0-9]*) ;;
  *) printf 'FAIL invalid episode: %s\n' "$EP" >&2; exit 1 ;;
esac

case "${EP#ep}" in
  ''|*[!0-9]*) printf 'FAIL invalid episode: %s\n' "$EP" >&2; exit 1 ;;
esac

STORYBOARD=${2:-"story/episodes/$EP/storyboard.md"}
TASKS=${3:-"story/episodes/$EP/videos/tasks.json"}
MANIFEST="story/episodes/$EP/keyframes.json"
EVIDENCE=()
command -v node >/dev/null 2>&1 || {
  printf '%s\n' 'FAIL Node.js is required for legacy project detection' >&2
  exit 1
}

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)
JSON_HELPER="$SCRIPT_DIR/json-field-contains.mjs"

repo_relative() {
  case "$1" in
    "$PWD"/*) REPO_PATH=${1#"$PWD"/} ;;
    ./*) REPO_PATH=${1#./} ;;
    *) REPO_PATH=$1 ;;
  esac
}

evidence_path() {
  repo_relative "$1"
  ESCAPED_PATH=$(node "$JSON_HELPER" --escape "$REPO_PATH" 2>/dev/null)
  [ "$?" -eq 0 ] || ESCAPED_PATH='<unprintable path>'
}

fail_read() {
  evidence_path "$1"
  printf 'FAIL cannot read %s\n' "$ESCAPED_PATH" >&2
  exit 1
}

scan_tasks_json() {
  case "$TASKS" in
    -*) TASKS_INPUT=./$TASKS ;;
    *) TASKS_INPUT=$TASKS ;;
  esac
  TASKS_ERROR=$(node "$JSON_HELPER" "$TASKS_INPUT" images \
    'assets/images/keyframes/' 2>&1 >/dev/null)
  TASKS_STATUS=$?
}

evidence_path "$STORYBOARD"
STORYBOARD_EVIDENCE=$ESCAPED_PATH
evidence_path "$TASKS"
TASKS_EVIDENCE=$ESCAPED_PATH

[ -e "$MANIFEST" ] && EVIDENCE+=("$MANIFEST")
[ -d assets/keyframes ] && EVIDENCE+=("assets/keyframes/")
[ -d assets/images/keyframes ] && EVIDENCE+=("assets/images/keyframes/")

if [ -e "$STORYBOARD" ]; then
  [ -f "$STORYBOARD" ] && [ -r "$STORYBOARD" ] || fail_read "$STORYBOARD"
  grep -Eq '\[KF-[[:alnum:]_-]+\]' -- "$STORYBOARD" 2>/dev/null
  STATUS=$?
  [ "$STATUS" -le 1 ] || fail_read "$STORYBOARD"
  if [ "$STATUS" -eq 0 ]; then
    EVIDENCE+=("$STORYBOARD_EVIDENCE:[KF-...]")
  fi
  grep -Fq 'assets/keyframes/' -- "$STORYBOARD" 2>/dev/null
  STATUS=$?
  [ "$STATUS" -le 1 ] || fail_read "$STORYBOARD"
  if [ "$STATUS" -eq 0 ]; then
    EVIDENCE+=("$STORYBOARD_EVIDENCE:assets/keyframes/")
  fi
fi

if [ -e "$TASKS" ]; then
  [ -f "$TASKS" ] && [ -r "$TASKS" ] || fail_read "$TASKS"
  scan_tasks_json
  if [ "$TASKS_STATUS" -ne 0 ] && [ "$TASKS_STATUS" -ne 2 ]; then
    if [ "$TASKS_ERROR" = 'FAIL cannot read JSON file' ]; then
      fail_read "$TASKS"
    fi
    printf 'FAIL invalid tasks JSON: %s\n' "$TASKS_EVIDENCE" >&2
    exit 1
  fi
  if [ "$TASKS_STATUS" -eq 2 ]; then
    EVIDENCE+=("$TASKS_EVIDENCE:assets/images/keyframes/")
  fi
fi

if [ "${#EVIDENCE[@]}" -eq 0 ]; then
  exit 0
fi

LIST=${EVIDENCE[0]}
for ITEM in "${EVIDENCE[@]:1}"; do
  LIST="$LIST, $ITEM"
done

printf 'FAIL legacy KF contract detected: %s; 当前版本不兼容，请使用旧 release 或进行人工迁移。\n' "$LIST" >&2
exit 2
