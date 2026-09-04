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
    "$PWD"/*) REPO_PATH=${1#"$PWD"/} ;;
    ./*) REPO_PATH=${1#./} ;;
    *) REPO_PATH=$1 ;;
  esac
}

escape_control() {
  ESCAPED_PATH=${1//\\/\\\\}
  ESCAPED_PATH=${ESCAPED_PATH//$'\n'/\\n}
  ESCAPED_PATH=${ESCAPED_PATH//$'\r'/\\r}
  ESCAPED_PATH=${ESCAPED_PATH//$'\t'/\\t}
}

evidence_path() {
  repo_relative "$1"
  escape_control "$REPO_PATH"
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
  # Validate one complete JSON value and inspect only string-valued `images` keys.
  TASKS_SCAN=$(awk '
function ws( c) {
  while (P <= N && index(" \t\r\n", substr(J, P, 1))) P++
}
function hex(c) {
  if (c >= "0" && c <= "9") return c + 0
  c = tolower(c)
  if (c >= "a" && c <= "f") return index("abcdef", c) + 9
  return -1
}
function string( i,c,e,h,v) {
  if (substr(J, P, 1) != "\"") { BAD=1; return "" }
  P++; S=""
  while (P <= N) {
    c=substr(J,P++,1)
    if (c == "\"") return S
    if (c == "\\") {
      if (P > N) { BAD=1; return "" }
      e=substr(J,P++,1)
      if (e == "\"" || e == "\\" || e == "/") S=S e
      else if (index("bfnrt", e)) S=S "\\" e
      else if (e == "u") {
        if (P + 3 > N) { BAD=1; return "" }
        h=substr(J,P,4); v=0
        for (i=1;i<=4;i++) {
          c=hex(substr(h,i,1)); if (c < 0) { BAD=1; return "" }; v=v*16+c
        }
        P+=4; if (v < 128) S=S sprintf("%c",v); else S=S "\\u" h
      } else { BAD=1; return "" }
    } else if (c ~ /[[:cntrl:]]/) { BAD=1; return "" }
    else S=S c
  }
  BAD=1; return ""
}
function value( c) {
  ws(); c=substr(J,P,1)
  if (c == "{") return object()
  if (c == "[") return array()
  if (c == "\"") { string(); return !BAD }
  if (substr(J,P,4) == "true" || substr(J,P,4) == "null") { P+=4; return 1 }
  if (substr(J,P,5) == "false") { P+=5; return 1 }
  if (match(substr(J,P), /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/)) {
    P+=RLENGTH; return 1
  }
  BAD=1; return 0
}
function object( key,val) {
  P++; ws(); if (substr(J,P,1) == "}") { P++; return 1 }
  while (!BAD) {
    key=string(); if (BAD) return 0
    ws(); if (substr(J,P++,1) != ":") { BAD=1; return 0 }; ws()
    if (key == "images" && substr(J,P,1) == "\"") {
      val=string(); if (index(val,"assets/images/keyframes/")) FOUND=1
    } else value()
    ws(); if (substr(J,P,1) == "}") { P++; return 1 }
    if (substr(J,P++,1) != ",") { BAD=1; return 0 }; ws()
  }
}
function array( c) {
  P++; ws(); if (substr(J,P,1) == "]") { P++; return 1 }
  while (!BAD) {
    value(); ws(); c=substr(J,P,1)
    if (c == "]") { P++; return 1 }
    if (c != ",") { BAD=1; return 0 }; P++
  }
}
{ J=J $0 "\n" }
END {
  N=length(J); P=1; value(); ws()
  if (BAD || P <= N) exit 3
  if (FOUND) print "legacy"
}
' "$TASKS_INPUT" 2>/dev/null)
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
  if [ "$TASKS_STATUS" -ne 0 ] && [ "$TASKS_STATUS" -ne 3 ]; then
    fail_read "$TASKS"
  fi
  if [ "$TASKS_STATUS" -eq 3 ]; then
    printf 'FAIL invalid tasks JSON: %s\n' "$TASKS_EVIDENCE" >&2
    exit 1
  fi
  if [ "$TASKS_SCAN" = legacy ]; then
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
