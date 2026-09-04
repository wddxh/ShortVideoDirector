#!/usr/bin/env bash
# Convert one canonical storyboard sheet card into image-generation inputs.

set -u

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)
ESCAPER="$SCRIPT_DIR/json-field-contains.mjs"

display_path() {
  DISPLAY_PATH=$(node "$ESCAPER" --escape "$1" 2>/dev/null) || \
    DISPLAY_PATH='<unprintable path>'
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

[ "$#" -eq 1 ] || fail 'usage: storyboard-sheet-to-prompt.sh <card>'
CARD=$1
display_path "$CARD"
CARD_DISPLAY=$DISPLAY_PATH

case "$CARD" in
  assets/storyboard-sheets/*/*) ;;
  *) fail "noncanonical card: $CARD_DISPLAY" ;;
esac
REST=${CARD#assets/storyboard-sheets/}
EP=${REST%%/*}
FILE=${REST#*/}
case "$EP" in
  ep[0-9]*) ;;
  *) fail "noncanonical card: $CARD_DISPLAY" ;;
esac
case "${EP#ep}" in
  ''|*[!0-9]*) fail "noncanonical card: $CARD_DISPLAY" ;;
esac
case "$FILE" in
  */*|shot*.md) ;;
  *) fail "noncanonical card: $CARD_DISPLAY" ;;
esac
[ "${FILE#*/}" = "$FILE" ] || fail "noncanonical card: $CARD_DISPLAY"
DIGITS=${FILE#shot}
DIGITS=${DIGITS%.md}
case "$DIGITS" in
  ''|*[!0-9]*) fail "noncanonical card: $CARD_DISPLAY" ;;
esac
SHOT_NUM=$((10#$DIGITS))
[ "$SHOT_NUM" -gt 0 ] || fail "noncanonical card: $CARD_DISPLAY"
printf -v EXPECTED_FILE 'shot%02d.md' "$SHOT_NUM"
[ "$FILE" = "$EXPECTED_FILE" ] || fail "noncanonical card: $CARD_DISPLAY"

STORYBOARD="story/episodes/$EP/storyboard.md"
TASKS="story/episodes/$EP/videos/tasks.json"
bash "$SCRIPT_DIR/detect-legacy-kf.sh" "$EP" "$STORYBOARD" "$TASKS"
DETECT_STATUS=$?
[ "$DETECT_STATUS" -eq 0 ] || exit "$DETECT_STATUS"

[ -f "$CARD" ] && [ -r "$CARD" ] || fail "file not found: $CARD_DISPLAY"

section_count() {
  awk -v title="$1" '
    $0 ~ "^## " title "[[:space:]]*$" { count++ }
    END { print count + 0 }
  ' "$CARD" 2>/dev/null
}

extract_section() {
  awk -v title="$1" '
    $0 ~ "^## " title "[[:space:]]*$" { inside=1; next }
    inside && /^## / { exit }
    inside { print }
  ' "$CARD" 2>/dev/null
}

for TITLE in '引用资产' '连续性参考' '图像生成提示'; do
  COUNT=$(section_count "$TITLE") || fail "cannot read card: $CARD_DISPLAY"
  [ "$COUNT" -eq 1 ] || fail "section must appear once: $TITLE"
done

ASSET_SECTION=$(extract_section '引用资产') || fail "cannot read card: $CARD_DISPLAY"
CONTINUITY_SECTION=$(extract_section '连续性参考') || fail "cannot read card: $CARD_DISPLAY"
PROMPT_BODY=$(extract_section '图像生成提示') || fail "cannot read card: $CARD_DISPLAY"
PROMPT_BODY=$(printf '%s\n' "$PROMPT_BODY" | awk '
  { line[++count] = $0 }
  END {
    first=1
    while (first <= count && line[first] ~ /^[[:space:]]*$/) first++
    last=count
    while (last >= first && line[last] ~ /^[[:space:]]*$/) last--
    for (i=first; i<=last; i++) print line[i]
  }
')
[[ "$PROMPT_BODY" =~ [^[:space:]] ]] || fail 'prompt section is empty'

normalize_asset() {
  RAW_PATH=$1
  [[ "$RAW_PATH" =~ [[:cntrl:]] ]] && return 1
  case "$RAW_PATH" in
    /*|*\\*|*://*) return 1 ;;
  esac
  NORMALIZED=$(awk -v base="${CARD%/*}" -v rel="$RAW_PATH" 'BEGIN {
    count=split(base "/" rel, part, "/")
    top=0
    for (i=1; i<=count; i++) {
      if (part[i] == "" || part[i] == ".") continue
      if (part[i] == "..") {
        if (top == 0) exit 1
        top--
      } else stack[++top]=part[i]
    }
    for (i=1; i<=top; i++) printf "%s%s", (i == 1 ? "" : "/"), stack[i]
    print ""
  }') || return 1
  case "$NORMALIZED" in
    assets/characters/?*.md) CATEGORY=character ;;
    assets/locations/?*.md|assets/items/?*.md|assets/buildings/?*.md) CATEGORY=other ;;
    *) return 1 ;;
  esac
  IMAGE_PATH="assets/images/${NORMALIZED#assets/}"
  IMAGE_PATH=${IMAGE_PATH%.md}.png
}

SEEN_IMAGES=()
CHAR_IMAGES=()
CHAR_NAMES=()
OTHER_IMAGES=()
OTHER_NAMES=()

add_asset() {
  NAME=$1
  RAW_PATH=$2
  if ! normalize_asset "$RAW_PATH"; then
    display_path "$RAW_PATH"
    fail "invalid asset link: $DISPLAY_PATH"
  fi
  for EXISTING in "${SEEN_IMAGES[@]}"; do
    [ "$EXISTING" = "$IMAGE_PATH" ] && return
  done
  SEEN_IMAGES+=("$IMAGE_PATH")
  if [ "$CATEGORY" = character ]; then
    CHAR_IMAGES+=("$IMAGE_PATH")
    CHAR_NAMES+=("$NAME")
  else
    OTHER_IMAGES+=("$IMAGE_PATH")
    OTHER_NAMES+=("$NAME")
  fi
}

while IFS= read -r LINE; do
  REST_LINE=$LINE
  while [[ "$REST_LINE" =~ \[([^][]+)\]\(([^()]*)\) ]]; do
    MATCH=${BASH_REMATCH[0]}
    LINK_NAME=${BASH_REMATCH[1]}
    LINK_PATH=${BASH_REMATCH[2]}
    add_asset "$LINK_NAME" "$LINK_PATH"
    REST_LINE=${REST_LINE#*"$MATCH"}
  done
done <<< "$ASSET_SECTION"

[ "${#SEEN_IMAGES[@]}" -gt 0 ] || fail 'no base asset references'

CONTINUITY_TRIMMED=$(printf '%s\n' "$CONTINUITY_SECTION" | awk '
  { line[++count]=$0 }
  END {
    first=1; while (first <= count && line[first] ~ /^[[:space:]]*$/) first++
    last=count; while (last >= first && line[last] ~ /^[[:space:]]*$/) last--
    for (i=first; i<=last; i++) print line[i]
  }
')
PREVIOUS_COUNT=0
PREVIOUS_PATH=''
while IFS= read -r LINE; do
  REST_LINE=$LINE
  while [[ "$REST_LINE" =~ \[([^][]+)\]\(([^()]*)\) ]]; do
    PREVIOUS_COUNT=$((PREVIOUS_COUNT + 1))
    PREVIOUS_NAME=${BASH_REMATCH[1]}
    PREVIOUS_LINK=${BASH_REMATCH[2]}
    MATCH=${BASH_REMATCH[0]}
    REST_LINE=${REST_LINE#*"$MATCH"}
  done
done <<< "$CONTINUITY_SECTION"

if [ "$PREVIOUS_COUNT" -eq 0 ]; then
  [ "$CONTINUITY_TRIMMED" = '无' ] || fail 'continuity without dependency must be 无'
elif [ "$PREVIOUS_COUNT" -gt 1 ]; then
  fail 'multiple previous sheet references'
else
  [ "$SHOT_NUM" -gt 1 ] || fail 'shot01 cannot reference a previous sheet'
  PREVIOUS_NUM=$((SHOT_NUM - 1))
  printf -v PREVIOUS_FILE 'shot%02d' "$PREVIOUS_NUM"
  [ "$PREVIOUS_NAME" = "$PREVIOUS_FILE" ] && \
    [ "$PREVIOUS_LINK" = "./$PREVIOUS_FILE.md" ] && \
    printf '%s\n' "$CONTINUITY_SECTION" | awk -v expected="- [$PREVIOUS_FILE](./$PREVIOUS_FILE.md)" '
      $0 == expected { count++ }
      END { exit(count == 1 ? 0 : 1) }
    ' || \
    fail 'continuity must reference adjacent previous sheet'
  PREVIOUS_PATH="assets/images/storyboard-sheets/$EP/$PREVIOUS_FILE.png"
fi

FINAL_IMAGES=("${CHAR_IMAGES[@]}" "${OTHER_IMAGES[@]}")
FINAL_NAMES=("${CHAR_NAMES[@]}" "${OTHER_NAMES[@]}")
[ -z "$PREVIOUS_PATH" ] || FINAL_IMAGES+=("$PREVIOUS_PATH")

IMAGE_CSV=''
HEADER=''
for INDEX in "${!FINAL_IMAGES[@]}"; do
  SLOT=$((INDEX + 1))
  if [ -z "$IMAGE_CSV" ]; then
    IMAGE_CSV=${FINAL_IMAGES[$INDEX]}
  else
    IMAGE_CSV="$IMAGE_CSV,${FINAL_IMAGES[$INDEX]}"
  fi
  if [ "$INDEX" -lt "${#FINAL_NAMES[@]}" ]; then
    BINDING="[${FINAL_NAMES[$INDEX]}:{图片$SLOT}]"
  else
    BINDING="[PREVIOUS_SHOT_SHEET:{图片$SLOT}]"
    PREVIOUS_SLOT=$SLOT
  fi
  if [ -z "$HEADER" ]; then
    HEADER=$BINDING
  else
    HEADER="$HEADER、$BINDING"
  fi
done

printf 'IMAGES:%s\n' "$IMAGE_CSV"
printf '%s\n' '---'
printf '**参考资产：** %s\n' "$HEADER"
if [ -n "$PREVIOUS_PATH" ]; then
  printf '**连续性约束：** [PREVIOUS_SHOT_SHEET:{图片%s}] 只继承本卡声明元素，不复制前板网格、panel、构图、机位。\n' "$PREVIOUS_SLOT"
fi
printf '\n%s\n' "$PROMPT_BODY"
