#!/usr/bin/env bash
# Concatenate generated shot videos into a single episode video.
# Usage: bash scripts/concat-videos.sh <ep> [output.mp4] [--allow-gaps] [--force]
# Exit codes: 0=OK, 1=error (bad args / missing ffmpeg / missing dir / gaps / output exists / ffmpeg failed)

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/concat-videos.sh <ep> [output.mp4] [--allow-gaps] [--force]

  <ep>            Episode id (e.g. ep01). Locates story/episodes/<ep>/videos/.
  [output.mp4]    Output path. Default: story/episodes/<ep>/<ep>.mp4
  --allow-gaps    Skip missing shot numbers without erroring
  --force         Overwrite existing output file
EOF
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

EP=""
OUTPUT=""
ALLOW_GAPS=0
FORCE=0

# First positional arg is <ep>; the rest may be [output.mp4] and/or flags in any order.
for arg in "$@"; do
  case "$arg" in
    --allow-gaps) ALLOW_GAPS=1 ;;
    --force)      FORCE=1 ;;
    --*)
      echo "Error: unknown flag: $arg" >&2
      usage
      exit 1
      ;;
    *)
      if [ -z "$EP" ]; then
        EP="$arg"
      elif [ -z "$OUTPUT" ]; then
        OUTPUT="$arg"
      else
        echo "Error: unexpected extra argument: $arg" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [ -z "$EP" ]; then
  usage
  exit 1
fi

VIDEOS_DIR="story/episodes/$EP/videos"
if [ -z "$OUTPUT" ]; then
  OUTPUT="story/episodes/$EP/$EP.mp4"
fi

# Preflight: ffmpeg must be in PATH
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg not found in PATH. Install with: winget install Gyan.FFmpeg" >&2
  exit 1
fi

# Preflight: videos dir must exist
if [ ! -d "$VIDEOS_DIR" ]; then
  echo "Error: videos dir not found: $VIDEOS_DIR" >&2
  exit 1
fi

# Preflight: output must not exist unless --force
if [ -e "$OUTPUT" ] && [ "$FORCE" -ne 1 ]; then
  echo "Error: output exists: $OUTPUT (use --force to overwrite)" >&2
  exit 1
fi

# Collect shot files in numeric order. Glob restricts to shot<digit>...mp4 so
# accidental files like shot_concat.mp4 are ignored.
shopt -s nullglob
shot_files=( "$VIDEOS_DIR"/shot[0-9]*.mp4 )
shopt -u nullglob

if [ ${#shot_files[@]} -eq 0 ]; then
  echo "Error: no shot[0-9]*.mp4 found in $VIDEOS_DIR" >&2
  exit 1
fi

# Sort by version (handles shot1.mp4 vs shot10.mp4 numerically)
readarray -t shot_files < <(printf '%s\n' "${shot_files[@]}" | sort -V)

# Extract trailing number from each filename for gap check
nums=()
for f in "${shot_files[@]}"; do
  base="${f##*/}"            # shot07.mp4
  num="${base#shot}"          # 07.mp4
  num="${num%.mp4}"           # 07
  num=$((10#$num))            # 7 (force decimal, strip leading zeros)
  nums+=( "$num" )
done

# Find max
max=0
for n in "${nums[@]}"; do
  if [ "$n" -gt "$max" ]; then max=$n; fi
done

# Compute missing
missing=()
for ((i=1; i<=max; i++)); do
  found=0
  for n in "${nums[@]}"; do
    if [ "$n" -eq "$i" ]; then found=1; break; fi
  done
  if [ "$found" -eq 0 ]; then missing+=( "$i" ); fi
done

if [ ${#missing[@]} -gt 0 ]; then
  if [ "$ALLOW_GAPS" -eq 1 ]; then
    echo "WARN: missing shots: ${missing[*]} (--allow-gaps in effect, continuing)"
  else
    echo "Error: missing shots: ${missing[*]} (use --allow-gaps to skip)" >&2
    exit 1
  fi
fi

# Build concat list (absolute paths, single-quoted, ' escaped as '\'')
LIST="$(mktemp)"
trap 'rm -f "$LIST"' EXIT

videos_abs="$(cd "$VIDEOS_DIR" && pwd -W)"
for f in "${shot_files[@]}"; do
  base="${f##*/}"
  abs="$videos_abs/$base"
  # Escape single quotes for ffmpeg concat demuxer:  ' -> '\''
  esc="${abs//\'/\'\\\'\'}"
  printf "file '%s'\n" "$esc" >> "$LIST"
done

# Ensure output directory exists
out_dir="$(dirname "$OUTPUT")"
if [ -n "$out_dir" ] && [ "$out_dir" != "." ]; then
  mkdir -p "$out_dir"
fi

# Run ffmpeg
FFMPEG_FORCE=()
if [ "$FORCE" -eq 1 ]; then
  FFMPEG_FORCE=(-y)
fi

if ! ffmpeg -hide_banner -loglevel error \
  "${FFMPEG_FORCE[@]}" \
  -f concat -safe 0 -i "$LIST" \
  -c copy \
  "$OUTPUT"; then
  echo "Error: ffmpeg failed. Possible cause: shot files have inconsistent codec/timebase." >&2
  echo "       (No --reencode option in this version; if needed, re-encode shots manually first.)" >&2
  exit 1
fi

# Summary
size_bytes=$(stat -c%s "$OUTPUT" 2>/dev/null || stat -f%z "$OUTPUT" 2>/dev/null || echo "?")
if command -v numfmt >/dev/null 2>&1 && [ "$size_bytes" != "?" ]; then
  size_human=$(numfmt --to=iec --suffix=B "$size_bytes")
else
  size_human="${size_bytes}B"
fi
echo "OK: concatenated ${#shot_files[@]} shots → $OUTPUT ($size_human)"
exit 0
