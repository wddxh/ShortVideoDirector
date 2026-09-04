#!/usr/bin/env bash

set -u

[ "$#" -eq 1 ] || { printf '%s\n' 'FAIL usage: reconcile-storyboard-sheet-images.sh <ep>' >&2; exit 1; }
EP=$1
case "$EP" in ep[0-9]*) ;; *) printf 'FAIL invalid episode: %s\n' "$EP" >&2; exit 1 ;; esac

CARD_DIR="assets/storyboard-sheets/$EP"
IMAGE_DIR="assets/images/storyboard-sheets/$EP"
REMOVED=''
MISSING=''

for IMAGE in "$IMAGE_DIR"/shot*.png; do
  [ -f "$IMAGE" ] || continue
  STEM=${IMAGE##*/}; STEM=${STEM%.png}
  if [ ! -f "$CARD_DIR/$STEM.md" ]; then
    rm -f -- "$IMAGE"
    REMOVED="${REMOVED}${REMOVED:+ }$STEM"
  fi
done

for CARD in "$CARD_DIR"/shot*.md; do
  [ -f "$CARD" ] || continue
  STEM=${CARD##*/}; STEM=${STEM%.md}
  [ -f "$IMAGE_DIR/$STEM.png" ] || MISSING="${MISSING}${MISSING:+ }$CARD"
done

printf 'removed: %s\n' "${REMOVED:-none}"
printf 'missing cards: %s\n' "${MISSING:-none}"
