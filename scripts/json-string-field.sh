#!/usr/bin/env sh
# Extract one JSON string field from a single-line response.

if [ "$#" -ne 1 ]; then
  echo "Usage: json-string-field.sh field" >&2
  exit 2
fi

awk -v field="$1" '
function emit_value(text, start,    i, c, escaped, value) {
  value = ""
  escaped = 0
  for (i = start; i <= length(text); i++) {
    c = substr(text, i, 1)
    if (escaped) {
      if (c == "\"" || c == "\\" || c == "/") value = value c
      else value = value "\\" c
      escaped = 0
    } else if (c == "\\") {
      escaped = 1
    } else if (c == "\"") {
      printf "%s", value
      found = 1
      exit 0
    } else {
      value = value c
    }
  }
}
{
  needle = "\"" field "\""
  offset = 1
  while ((at = index(substr($0, offset), needle)) != 0) {
    at += offset - 1
    rest = substr($0, at + length(needle))
    sub(/^[[:space:]]*:[[:space:]]*/, "", rest)
    if (substr(rest, 1, 1) == "\"") emit_value(rest, 2)
    offset = at + length(needle)
  }
}
END { if (!found) exit 1 }
'
