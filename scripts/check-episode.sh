#!/usr/bin/env bash
# Check file completeness for a given episode.
# Usage: bash scripts/check-episode.sh ep01 [config_path]
# Output: one line per check item in format "item:status[:detail]"
# Exit codes: 0=all ok, 1=has issues

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/check-episode.sh ep01 [config_path]"
  exit 1
fi

EP="$1"
CONFIG="${2:-config.md}"
EP_DIR="story/episodes/$EP"
HAS_ISSUE=0

# Helper: read config value
read_config() {
  bash scripts/read-config.sh "$1" "$CONFIG" 2>/dev/null
}

# 1. Check outline
OUTLINE="$EP_DIR/outline.md"
if [ ! -f "$OUTLINE" ]; then
  echo "outline:missing"
  HAS_ISSUE=1
elif grep -q '## 集尾钩子\|## 结局设计' "$OUTLINE"; then
  echo "outline:ok"
else
  echo "outline:incomplete"
  HAS_ISSUE=1
fi

# 2. Check novel
NOVEL="$EP_DIR/novel.md"
SCRIPT_FILE="$EP_DIR/script.md"
WORD_RANGE=$(read_config "每集小说字数")

if [ -f "$NOVEL" ]; then
  if [ -n "$WORD_RANGE" ]; then
    # Extract lower bound: "4000-5000" -> 4000, single number -> 80% of it
    LOWER=$(echo "$WORD_RANGE" | grep -oE '^[0-9]+')
    if echo "$WORD_RANGE" | grep -q '-'; then
      LOWER=$(echo "$WORD_RANGE" | sed 's/-.*//')
    else
      LOWER=$((LOWER * 80 / 100))
    fi
    THRESHOLD=$((LOWER / 2))
    ACTUAL=$(bash scripts/word-count.sh "$NOVEL" 2>/dev/null)
    if [ -n "$ACTUAL" ] && [ "$ACTUAL" -lt "$THRESHOLD" ]; then
      echo "novel:incomplete:${ACTUAL}/${LOWER}"
      HAS_ISSUE=1
    else
      echo "novel:ok"
    fi
  else
    echo "novel:ok"
  fi
elif [ -f "$SCRIPT_FILE" ]; then
  # Short video uses script.md instead of novel.md
  if grep -q '## 场景' "$SCRIPT_FILE"; then
    echo "script:ok"
  else
    echo "script:incomplete"
    HAS_ISSUE=1
  fi
else
  echo "novel:missing"
  echo "script:missing"
  HAS_ISSUE=1
fi

# 3. Check asset list
if [ -f "$OUTLINE" ] && grep -q '## 本集资产清单' "$OUTLINE"; then
  echo "asset-list:ok"
else
  echo "asset-list:missing"
  HAS_ISSUE=1
fi

# 4. Check asset files
if [ -f "$OUTLINE" ] && grep -q '## 本集资产清单' "$OUTLINE"; then
  # Extract new asset names from "新增资产" section
  IN_NEW=0
  MISSING_ASSETS=""
  while IFS= read -r line; do
    if echo "$line" | grep -q '新增资产'; then
      IN_NEW=1
      continue
    fi
    if [ "$IN_NEW" -eq 1 ]; then
      # Stop at next section header or "已有资产"
      if echo "$line" | grep -qE '^##|^已有资产|^- \*\*已有'; then
        break
      fi
      # Extract asset name from "- 角色名（类型）" or "- **角色名**" patterns
      ASSET_NAME=$(echo "$line" | sed 's/^- //' | sed 's/[（(].*//' | sed 's/\*//g' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
      if [ -n "$ASSET_NAME" ]; then
        # Check if file exists in any assets subdirectory
        FOUND=$(ls assets/characters/"$ASSET_NAME".md assets/items/"$ASSET_NAME".md assets/locations/"$ASSET_NAME".md assets/buildings/"$ASSET_NAME".md 2>/dev/null | head -1)
        if [ -z "$FOUND" ]; then
          if [ -z "$MISSING_ASSETS" ]; then
            MISSING_ASSETS="$ASSET_NAME"
          else
            MISSING_ASSETS="$MISSING_ASSETS,$ASSET_NAME"
          fi
        fi
      fi
    fi
  done < "$OUTLINE"

  if [ -n "$MISSING_ASSETS" ]; then
    echo "assets:missing:$MISSING_ASSETS"
    HAS_ISSUE=1
  else
    echo "assets:ok"
  fi
else
  echo "assets:skipped"
fi

# 5. Check images
IMAGE_MODEL=$(read_config "图像模型")
if [ "$IMAGE_MODEL" = "none" ] || [ -z "$IMAGE_MODEL" ]; then
  echo "images:skipped"
else
  MISSING_IMAGES=""
  for md_file in assets/characters/*.md assets/items/*.md assets/locations/*.md assets/buildings/*.md; do
    [ ! -f "$md_file" ] && continue
    IMG_PATH=$(bash scripts/asset-to-image-path.sh "$md_file")
    if [ ! -f "$IMG_PATH" ]; then
      NAME=$(basename "$md_file" .md)
      if [ -z "$MISSING_IMAGES" ]; then
        MISSING_IMAGES="$NAME"
      else
        MISSING_IMAGES="$MISSING_IMAGES,$NAME"
      fi
    fi
  done

  if [ -n "$MISSING_IMAGES" ]; then
    echo "images:missing:$MISSING_IMAGES"
    HAS_ISSUE=1
  else
    echo "images:ok"
  fi
fi

# 6. Check storyboard
STORYBOARD="$EP_DIR/storyboard.md"
TARGET_SHOTS=$(read_config "每集分镜数")
if [ ! -f "$STORYBOARD" ]; then
  echo "storyboard:missing"
  HAS_ISSUE=1
else
  ACTUAL_SHOTS=$(grep -c '### 镜头' "$STORYBOARD")
  if [ -n "$TARGET_SHOTS" ]; then
    THRESHOLD=$((TARGET_SHOTS / 2))
    if [ "$ACTUAL_SHOTS" -lt "$THRESHOLD" ]; then
      echo "storyboard:incomplete:${ACTUAL_SHOTS}/${TARGET_SHOTS}"
      HAS_ISSUE=1
    else
      echo "storyboard:ok"
    fi
  else
    echo "storyboard:ok"
  fi
fi

exit $HAS_ISSUE
