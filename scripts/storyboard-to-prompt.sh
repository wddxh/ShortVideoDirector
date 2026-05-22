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
# - Header (出场人物 / 引用资产) links: ALL replaced inline as [name:{图片N}],
#   including keyframes (which retain their KF-id as name).
# - Body (画面与声音描述) keyframe references in BARE form `[KF-id]` (no
#   markdown link, per storyboarder schema): replaced as [{图片N}], matching
#   the keyframe's {图片N} assigned in the header.
# - Body keyframe references in MARKDOWN-LINK form `[KF-id](path.md)` (rare,
#   legacy): also replaced as [{图片N}].
# - Non-keyframe entity names in body prose ("青锋剑派议事广场") pass through
#   unchanged (storyboarder schema uses bare names in prose).
# - Same path used multiple times reuses the first {图片N} (no duplicate IMAGES entries).
# - Numbering order = source order in header (出场人物 first, then 引用资产).

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

# Split SHOT_BLOCK into header (before "**画面与声音描述：**") and body (after).
# Header contains 出场人物 / 引用资产 fields with [name](path.md) links.
# Body contains prose with bare [KF-id] keyframe refs + bare entity names.
HEADER_PART=$(echo "$SHOT_BLOCK" | awk '
  /^\*\*画面与声音描述/ { exit }
  { print }
')
BODY_PART=$(echo "$SHOT_BLOCK" | awk '
  /^\*\*画面与声音描述/ { in_body=1 }
  in_body { print }
')

# Collect all markdown-link refs in header (in source order — 出场人物 then 引用资产).
ASSET_LINKS=$(printf '%s\n' "$HEADER_PART" | grep -oE '\[[^]]+\]\([^)]+\.md\)')
# Collect markdown-link refs in body (rare; storyboarder schema uses bare [KF-id]).
BODY_LINKS=$(printf '%s\n' "$BODY_PART" | grep -oE '\[[^]]+\]\([^)]+\.md\)' || true)

REPLACED_BLOCK="$SHOT_BLOCK"
IMAGES=""
COUNTER=0
SEEN_MAP=""
# kf_id_map: KF-id<TAB>N — for resolving bare [KF-id] in body to its header N.
KF_ID_MAP=""

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
    # If this is a keyframe header entry, also record KF-id → N for body
    # bare [KF-id] substitution in Pass 3.
    case "$path_md" in
      *assets/keyframes/*)
        KF_ID_MAP="${KF_ID_MAP}${name}	${existing_n}
"
        ;;
    esac
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

# Pass 1: header refs (出场人物 + 引用资产). ALL get [name:{图片N}] format
# including keyframes (which retain "KF-id" as name). KF id → N mapping is
# captured inside process_link for Pass 3 below.
while IFS= read -r link; do
  [ -z "$link" ] && continue
  process_link "$link" "0"
done <<< "$ASSET_LINKS"

# Pass 2: body markdown-link keyframe refs (legacy / rare). Storyboarder
# schema uses bare [KF-id] in prose; this pass exists for backward compat.
while IFS= read -r link; do
  [ -z "$link" ] && continue
  path_md=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')
  case "$path_md" in
    *assets/keyframes/*) process_link "$link" "1" ;;
    *) ;;
  esac
done <<< "$BODY_LINKS"

# Pass 3: body bare [KF-id] refs (storyboarder schema standard form). Look up
# each bare KF-id in KF_ID_MAP and substitute to [{图片N}]. Bare KF-ids that
# don't appear in header KF_ID_MAP are left unchanged (validation handled by
# upstream storyboarder review).
while IFS=$'\t' read -r kf_id n; do
  [ -z "$kf_id" ] && continue
  REPLACED_BLOCK=$(printf '%s' "$REPLACED_BLOCK" | awk -v kf="$kf_id" -v num="$n" '
    {
      old = "[" kf "]"
      new = "[{图片" num "}]"
      out = ""
      rest = $0
      while ((idx = index(rest, old)) > 0) {
        head = substr(rest, 1, idx-1)
        tail = substr(rest, idx+length(old))
        # Skip if next char is "(" — that means this [KF-id]( is a markdown
        # link already handled in Pass 1 or Pass 2.
        next_c = substr(tail, 1, 1)
        if (next_c == "(") {
          out = out head old
          rest = tail
        } else {
          out = out head new
          rest = tail
        }
      }
      print out rest
    }')
done <<< "$KF_ID_MAP"

# Extract duration from "- 时长：<N>s" line (accept full-width or half-width colon).
DURATION=$(echo "$SHOT_BLOCK" | grep -oE '时长[:：][[:space:]]*[0-9]+s' | grep -oE '[0-9]+')

if [ -z "$DURATION" ]; then
  DURATION="5"
fi

# Output
echo "IMAGES:$IMAGES"
echo "DURATION:$DURATION"
echo "---"
echo "$REPLACED_BLOCK"
