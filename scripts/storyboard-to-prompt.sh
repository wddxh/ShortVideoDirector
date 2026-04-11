#!/usr/bin/env bash
# Extract a shot from storyboard, replace asset links with {图片N} format.
# Usage: bash scripts/storyboard-to-prompt.sh storyboard.md shot_number
# Output:
#   IMAGES:path1.png,path2.png,...
#   DURATION:15
#   ---
#   (replaced shot block)
# Exit codes: 0=success, 1=shot not found or parse error

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

# Extract asset links from "**引用资产：**" line
# Format: [名称](../../../assets/category/name.md)
ASSET_LINE=$(echo "$SHOT_BLOCK" | grep '引用资产')

# Extract all [name](path) patterns
LINKS=$(echo "$ASSET_LINE" | grep -oE '\[[^]]+\]\([^)]+\.md\)')

# Build image paths and replacement
IMAGES=""
COUNTER=0
REPLACED_BLOCK="$SHOT_BLOCK"

while IFS= read -r link; do
  [ -z "$link" ] && continue
  COUNTER=$((COUNTER + 1))

  # Extract name and path
  NAME=$(echo "$link" | sed 's/^\[\([^]]*\)\].*/\1/')
  PATH_MD=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')

  # Convert to image path
  IMG_PATH=$(echo "$PATH_MD" | sed 's|.*assets/|assets/images/|' | sed 's|\.md$|.png|')

  # Build comma-separated image list
  if [ -z "$IMAGES" ]; then
    IMAGES="$IMG_PATH"
  else
    IMAGES="$IMAGES,$IMG_PATH"
  fi

  # Replace [name](path.md) with [name:{图片N}] in the block
  REPLACEMENT="[${NAME}:{图片${COUNTER}}]"
  # Use awk index()+substr() for literal string replacement (no regex)
  REPLACED_BLOCK=$(printf '%s' "$REPLACED_BLOCK" | awk -v old="$link" -v new="$REPLACEMENT" '
    {
      while ((idx = index($0, old)) > 0) {
        $0 = substr($0, 1, idx-1) new substr($0, idx+length(old))
      }
      print
    }')
done <<< "$LINKS"

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
