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

repo_relative() {
  case "$1" in
    "$PWD"/*) printf '%s' "${1#"$PWD"/}" ;;
    ./*) printf '%s' "${1#./}" ;;
    *) printf '%s' "$1" ;;
  esac
}

STORYBOARD_EVIDENCE=$(repo_relative "$STORYBOARD")
TASKS_EVIDENCE=$(repo_relative "$TASKS")

[ -e "$MANIFEST" ] && EVIDENCE+=("$MANIFEST")
[ -d assets/keyframes ] && EVIDENCE+=("assets/keyframes/")
[ -d assets/images/keyframes ] && EVIDENCE+=("assets/images/keyframes/")

if [ -f "$STORYBOARD" ]; then
  if grep -Eq '\[KF-[[:alnum:]_-]+\]' "$STORYBOARD"; then
    EVIDENCE+=("$STORYBOARD_EVIDENCE:[KF-...]")
  fi
  if grep -Fq 'assets/keyframes/' "$STORYBOARD"; then
    EVIDENCE+=("$STORYBOARD_EVIDENCE:assets/keyframes/")
  fi
fi

if [ -f "$TASKS" ] && grep -Fq 'assets/images/keyframes/' "$TASKS"; then
  EVIDENCE+=("$TASKS_EVIDENCE:assets/images/keyframes/")
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
