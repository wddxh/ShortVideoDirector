#!/usr/bin/env bash
# Count words in a text file. Auto-detects language: Chinese counts characters, English counts words.
# Usage: bash scripts/word-count.sh <file_path>

if [ $# -ne 1 ]; then
  echo "Usage: bash scripts/word-count.sh <file_path>"
  exit 1
fi

# Count CJK characters (UTF-8 CJK = 3 bytes each): remove ASCII, count bytes / 3
zh_bytes=$(tr -d '\000-\177' < "$1" | wc -c | tr -d ' ')
zh=$((zh_bytes / 3))

# Count English words
en=$(grep -oE '[a-zA-Z]+' "$1" | wc -l | tr -d ' ')

if [ "$zh" -gt 0 ]; then
  echo $((zh + en))
else
  echo "$en"
fi
