#!/usr/bin/env bash
# Extract a shot from storyboard, replace asset links with {图片N} format.
# Usage: bash scripts/storyboard-to-prompt.sh storyboard.md shot_number
# Output:
#   IMAGES:path1.png,path2.png,...
#   DURATION:15
#   ---
#   (replaced shot block)
# Exit codes: 0=success, 1=shot not found or parse error
#
# Behavior:
# - Regular assets in "**引用资产：**" line: replaced inline as [name:{图片N}]
# - Keyframe references (path contains assets/keyframes/) anywhere in the shot:
#   replaced as [{图片N}], and any keyframe references in the 引用资产 line are
#   stripped (keyframes belong in body, not header)
# - Same path used multiple times reuses the first {图片N} (no duplicate IMAGES entries)
# - Numbering order: header regular assets first, then body keyframes by appearance

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/storyboard-to-prompt.sh storyboard_path shot_number"
  exit 1
fi

STORYBOARD="$1"
SHOT_NUM="$2"

if [ ! -f "$STORYBOARD" ]; then
  echo "FAIL file not found: $STORYBOARD"
  exit 1
fi

# Extract shot block: from "### 镜头 N" to next "### 镜头" or end of file
SHOT_BLOCK=$(awk -v n="$SHOT_NUM" '
  /^### 镜头 / {
    if (found) exit
    match($0, /镜头 ([0-9]+)/, arr)
    if (arr[1] == n) found=1
  }
  found { print }
' "$STORYBOARD")

if [ -z "$SHOT_BLOCK" ]; then
  echo "FAIL shot $SHOT_NUM not found"
  exit 1
fi

ASSET_LINE=$(echo "$SHOT_BLOCK" | grep '引用资产')
ASSET_LINKS=$(echo "$ASSET_LINE" | grep -oE '\[[^]]+\]\([^)]+\.md\)')
BODY_LINKS=$(echo "$SHOT_BLOCK" | grep -v '引用资产' | grep -oE '\[[^]]+\]\([^)]+\.md\)')

# Strip keyframe references from the 引用资产 line FIRST (before any replacement),
# so leftover {图片N} from header doesn't pollute the output. Keyframes belong in body.
SHOT_BLOCK=$(printf '%s\n' "$SHOT_BLOCK" | awk '
  /引用资产/ {
    while (match($0, /\[[^]]+\]\([^)]*assets\/keyframes\/[^)]+\.md\)/)) {
      start = RSTART; len = RLENGTH
      head = substr($0, 1, start - 1)
      tail = substr($0, start + len)
      # Consume one adjacent separator (prefer trailing, else leading)
      if (match(tail, /^[ \t]*[、,][ \t]*/)) {
        tail = substr(tail, RLENGTH + 1)
      } else if (match(head, /[、,][ \t]*$/)) {
        head = substr(head, 1, RSTART - 1)
      }
      $0 = head tail
    }
    sub(/[ \t]*[、,][ \t]*$/, "", $0)
    sub(/^([^：]*：)[ \t]*[、,][ \t]*/, "\\1", $0)
  }
  { print }
')

REPLACED_BLOCK="$SHOT_BLOCK"
IMAGES=""
COUNTER=0
SEEN_MAP=""

# Look up an existing {图片N} for a path (returns N or empty)
lookup_n() {
  local path="$1"
  printf '%s\n' "$SEEN_MAP" | awk -F'\t' -v p="$path" '$1 == p { print $2; exit }'
}

process_link() {
  local link="$1"
  local is_keyframe="$2"

  local name path_md img_path replacement existing_n
  name=$(echo "$link" | sed 's/^\[\([^]]*\)\].*/\1/')
  path_md=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')
  img_path=$(echo "$path_md" | sed 's|.*assets/|assets/images/|' | sed 's|\.md$|.png|')

  existing_n=$(lookup_n "$img_path")
  if [ -z "$existing_n" ]; then
    COUNTER=$((COUNTER + 1))
    existing_n="$COUNTER"
    SEEN_MAP="${SEEN_MAP}${img_path}	${existing_n}
"
    if [ -z "$IMAGES" ]; then
      IMAGES="$img_path"
    else
      IMAGES="$IMAGES,$img_path"
    fi
  fi

  if [ "$is_keyframe" = "1" ]; then
    replacement="[{图片${existing_n}}]"
  else
    replacement="[${name}:{图片${existing_n}}]"
  fi

  REPLACED_BLOCK=$(printf '%s' "$REPLACED_BLOCK" | awk -v old="$link" -v new="$replacement" '
    {
      while ((idx = index($0, old)) > 0) {
        $0 = substr($0, 1, idx-1) new substr($0, idx+length(old))
      }
      print
    }')
}

# Pass 1: header regular assets (skip keyframe paths — handled in pass 2)
while IFS= read -r link; do
  [ -z "$link" ] && continue
  path_md=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')
  case "$path_md" in
    *assets/keyframes/*) ;;
    *) process_link "$link" "0" ;;
  esac
done <<< "$ASSET_LINKS"

# Pass 2: body keyframe references (in appearance order)
while IFS= read -r link; do
  [ -z "$link" ] && continue
  path_md=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')
  case "$path_md" in
    *assets/keyframes/*) process_link "$link" "1" ;;
    *) ;;
  esac
done <<< "$BODY_LINKS"

# Extract duration from "**时长：**" line
DURATION=$(echo "$SHOT_BLOCK" | grep -oE '时长：.*[0-9]+s' | grep -oE '[0-9]+')

if [ -z "$DURATION" ]; then
  DURATION="5"
fi

# Output
echo "IMAGES:$IMAGES"
echo "DURATION:$DURATION"
echo "---"
echo "$REPLACED_BLOCK"
