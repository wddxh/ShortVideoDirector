#!/bin/bash
# Count words in a file based on language
# Usage: count-words.sh <file_path> <language>
# language: zh (count CJK characters), en (count words), auto (detect)
# Output: a single number

FILE="$1"
LANG_MODE="$2"

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "0"
  exit 1
fi

if [ -z "$LANG_MODE" ]; then
  LANG_MODE="auto"
fi

count_cjk() {
  grep -oP '[\x{4e00}-\x{9fff}\x{3400}-\x{4dbf}\x{f900}-\x{faff}]' "$1" | wc -l | tr -d ' '
}

count_words() {
  wc -w < "$1" | tr -d ' '
}

if [ "$LANG_MODE" = "zh" ]; then
  count_cjk "$FILE"
elif [ "$LANG_MODE" = "en" ]; then
  count_words "$FILE"
else
  # auto: detect based on CJK character ratio
  total_chars=$(wc -m < "$FILE" | tr -d ' ')
  if [ "$total_chars" -eq 0 ]; then
    echo "0"
    exit 0
  fi
  cjk_count=$(count_cjk "$FILE")
  ratio=$((cjk_count * 100 / total_chars))
  if [ "$ratio" -gt 50 ]; then
    echo "$cjk_count"
  else
    count_words "$FILE"
  fi
fi
