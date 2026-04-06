#!/usr/bin/env bash
# Check speech rate for storyboard dialogue segments.
# Usage: bash scripts/speech-rate.sh "0-3:slow:台词文本" "3-9:normal:台词文本" ...
# Arguments: start_sec-end_sec:speed_type:dialogue_text
# Speed types: slow (<=3 w/s), normal (<=5 w/s), fast (<=8 w/s)
# Auto-detects language: Chinese counts characters, English counts words.

if [ $# -lt 1 ]; then
  echo 'Usage: bash scripts/speech-rate.sh "start-end:speed:text" ...'
  exit 1
fi

for arg in "$@"; do
  ts="${arg%%:*}"
  rest="${arg#*:}"
  spd="${rest%%:*}"
  txt="${rest#*:}"

  s="${ts%-*}"
  e="${ts#*-}"
  dur=$(awk "BEGIN {printf \"%.0f\", $e - $s}")

  # Count CJK characters (UTF-8 CJK = 3 bytes each)
  zh_bytes=$(printf '%s' "$txt" | tr -d '\000-\177' | wc -c | tr -d ' ')
  zh=$((zh_bytes / 3))

  # Count English words
  en=$(printf '%s' "$txt" | grep -oE '[a-zA-Z]+' | wc -l | tr -d ' ')

  if [ "$zh" -gt 0 ]; then
    wc=$((zh + en))
  else
    wc=$en
  fi

  if [ "$dur" -gt 0 ]; then
    rate=$(awk "BEGIN {printf \"%.1f\", $wc / $dur}")
  else
    rate="0.0"
  fi

  case "$spd" in
    slow)   lim=3 ;;
    normal) lim=5 ;;
    fast)   lim=8 ;;
    *)      lim=5 ;;
  esac

  flag=$(awk "BEGIN {print ($rate > $lim) ? \"OVER\" : \"OK\"}")
  echo "[${ts}s] ${dur}s | ${wc} words | ${rate} w/s | limit ${lim} w/s | ${flag}"
done
