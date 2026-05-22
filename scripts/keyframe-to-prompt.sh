#!/usr/bin/env bash
# Convert a single keyframe .md into Dreamina image2image inputs.
# Usage: bash scripts/keyframe-to-prompt.sh path/to/KF-EPNN-SSS.md
# Output (stdout):
#   IMAGES:path1.png,path2.png,...
#   ---
#   **引用资产：** [name1:{图片1}]、[name2:{图片2}]、...
#
#   <prompt body from "## 图像生成提示" section>
# Exit codes: 0=success, 1=file missing / parse error / no asset references
#
# Behavior:
# - Reads ONLY the "## 引用资产" section to collect asset references.
# - Asset list order = first-appearance order in composition (deduped at
#   creation layer by creator-keyframe-prompts; this script does NOT dedupe).
# - Image path derivation: assets/<category>/<name>.md -> assets/images/<category>/<name>.png
#   (mirrors scripts/asset-to-image-path.sh and scripts/storyboard-to-prompt.sh).
# - Reference paths in the keyframe .md are RELATIVE to the keyframe file's
#   directory; this script normalizes them to repo-root-relative paths first.
# - Prompt body comes verbatim from "## 图像生成提示" section (already plain
#   text with bare asset names per creator-keyframe-prompts rules).
# - Does NOT cap to 10 images; dreamina CLI will fail on >10 and the caller
#   (creator-image-dreamina) records the failure for the fix layer to handle.

# Force UTF-8 locale for consistent CJK handling in awk/sed (matches video-gen-dreamina.sh).
export LC_ALL=C.UTF-8

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/keyframe-to-prompt.sh path/to/keyframe.md"
  exit 1
fi

KF_MD="$1"

if [ ! -f "$KF_MD" ]; then
  echo "FAIL file not found: $KF_MD"
  exit 1
fi

KF_DIR=$(dirname "$KF_MD")

# Extract "## 引用资产" section: lines from "## 引用资产" up to (but not including) the next "## " heading or EOF.
ASSET_SECTION=$(awk '
  /^## 引用资产[[:space:]]*$/ { inside=1; next }
  inside && /^## / { inside=0 }
  inside { print }
' "$KF_MD")

# Collect "- [name](path.md)" lines from the section (in source order).
ASSET_LINKS=$(printf '%s\n' "$ASSET_SECTION" | grep -oE '\[[^]]+\]\([^)]+\.md\)')

if [ -z "$ASSET_LINKS" ]; then
  echo "FAIL no asset references in '## 引用资产' section: $KF_MD"
  exit 1
fi

# Build IMAGES list and **引用资产：** header line.
IMAGES=""
HEADER=""
COUNTER=0

while IFS= read -r link; do
  [ -z "$link" ] && continue
  name=$(echo "$link" | sed 's/^\[\([^]]*\)\].*/\1/')
  rel_path=$(echo "$link" | sed 's/.*(\([^)]*\))/\1/')

  # Normalize to repo-root-relative: prepend KF_DIR, resolve ".." segments,
  # then strip everything before "assets/".
  combined="$KF_DIR/$rel_path"
  # Manual ../. resolution: combined path like
  # "assets/keyframes/ep01/../../characters/X.md" must collapse to
  # "assets/characters/X.md" before the assets/ strip below. A bare
  # sed 's|.*assets/|assets/|' alone would leave the ".." segments embedded.
  resolved=$(printf '%s' "$combined" | awk '
    {
      n = split($0, parts, "/")
      out_n = 0
      for (i = 1; i <= n; i++) {
        p = parts[i]
        if (p == "" || p == ".") continue
        if (p == "..") { if (out_n > 0) out_n-- ; continue }
        out[++out_n] = p
      }
      s = ""
      for (i = 1; i <= out_n; i++) s = (i == 1 ? out[i] : s "/" out[i])
      print s
    }
  ')
  md_path=$(echo "$resolved" | sed 's|.*assets/|assets/|')

  # Derive image path: assets/...md -> assets/images/...png
  img_path=$(echo "$md_path" | sed 's|^assets/|assets/images/|' | sed 's|\.md$|.png|')

  COUNTER=$((COUNTER + 1))

  if [ -z "$IMAGES" ]; then
    IMAGES="$img_path"
    HEADER="[${name}:{图片${COUNTER}}]"
  else
    IMAGES="${IMAGES},${img_path}"
    HEADER="${HEADER}、[${name}:{图片${COUNTER}}]"
  fi
done <<< "$ASSET_LINKS"

# Extract "## 图像生成提示" section: lines from heading up to next "## " or EOF.
PROMPT_BODY=$(awk '
  /^## 图像生成提示[[:space:]]*$/ { inside=1; next }
  inside && /^## / { inside=0 }
  inside { print }
' "$KF_MD")

# Trim leading/trailing blank lines from PROMPT_BODY.
PROMPT_BODY=$(printf '%s\n' "$PROMPT_BODY" | awk '
  { lines[++n] = $0 }
  END {
    # find last non-blank
    last = n
    while (last > 0 && lines[last] ~ /^[[:space:]]*$/) last--
    # find first non-blank
    first = 1
    while (first <= last && lines[first] ~ /^[[:space:]]*$/) first++
    for (i = first; i <= last; i++) print lines[i]
  }
')

# Output.
echo "IMAGES:$IMAGES"
echo "---"
echo "**引用资产：** $HEADER"
echo ""
printf '%s\n' "$PROMPT_BODY"
