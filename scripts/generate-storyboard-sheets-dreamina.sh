#!/usr/bin/env bash

set -u

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

[ "$#" -ge 3 ] || fail 'usage: generate-storyboard-sheets-dreamina.sh <resolution> <model> <card...>'

RESOLUTION=$1
MODEL=$2
shift 2

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CONVERTER="$SCRIPT_DIR/storyboard-sheet-to-prompt.sh"
PATH_CONVERTER="$SCRIPT_DIR/asset-to-image-path.sh"
IMAGE_GENERATOR="$SCRIPT_DIR/image-gen-dreamina.sh"

RECORDS=()
for CARD in "$@"; do
  if [[ ! "$CARD" =~ ^assets/storyboard-sheets/ep(0[1-9]|[1-9][0-9]+)/shot(0[1-9]|[1-9][0-9]+)\.md$ ]]; then
    fail "noncanonical card: $CARD"
  fi
  DUPLICATE=false
  for RECORD in "${RECORDS[@]}"; do
    [ "${RECORD#*|}" = "$CARD" ] && DUPLICATE=true
  done
  "$DUPLICATE" && continue
  RECORDS+=("${BASH_REMATCH[2]}|$CARD")
done

SORTED_RECORDS=()
while IFS= read -r RECORD; do
  SORTED_RECORDS+=("$RECORD")
done <<< "$(printf '%s\n' "${RECORDS[@]}" | sort -s -t '|' -k1,1n)"
RECORDS=("${SORTED_RECORDS[@]}")

GENERATED=0
SKIPPED=0

for RECORD in "${RECORDS[@]}"; do
  CARD=${RECORD#*|}
  OUTPUT=$(bash "$PATH_CONVERTER" "$CARD") || fail "cannot derive output: $CARD"
  if [ -f "$OUTPUT" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  CONVERTED=$(bash "$CONVERTER" "$CARD") || exit $?
  IMAGES=${CONVERTED%%$'\n'*}
  IMAGES=${IMAGES#IMAGES:}
  PROMPT=${CONVERTED#*$'\n---\n'}

  IFS=',' read -r -a REFERENCES <<< "$IMAGES"
  for REFERENCE in "${REFERENCES[@]}"; do
    [ -f "$REFERENCE" ] || fail "missing dependency: $REFERENCE"
  done

  RESULT=$(bash "$IMAGE_GENERATOR" "$PROMPT" "$OUTPUT" '16:9' \
    "$RESOLUTION" "$MODEL" "$IMAGES")
  STATUS=$?
  case "$STATUS" in
    0)
      [ -f "$OUTPUT" ] || fail "output not created: $OUTPUT"
      GENERATED=$((GENERATED + 1))
      ;;
    1)
      printf '%s\n' "$RESULT"
      exit 1
      ;;
    2)
      ID=${RESULT#PENDING }
      printf 'PENDING %s %s %s\n' "$ID" "$CARD" "$OUTPUT"
      exit 2
      ;;
    *)
      fail "image generator exited with status $STATUS"
      ;;
  esac
done

printf 'OK generated %s skipped %s\n' "$GENERATED" "$SKIPPED"
