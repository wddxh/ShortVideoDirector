#!/usr/bin/env bash
# Query and update task status in pending.json / tasks.json files.
# Usage:
#   bash scripts/task-status.sh query  file.json download_dir
#   bash scripts/task-status.sh update file.json submit_id new_status
#   bash scripts/task-status.sh remove file.json submit_id
#   bash scripts/task-status.sh add    file.json '{"shot":1,"submit_id":"xxx","status":"submitted"}'
# Exit codes: 0=success, 1=error

if [ $# -lt 2 ]; then
  echo "Usage: bash scripts/task-status.sh {query|update|remove|add} file.json [args...]"
  exit 1
fi

ACTION="$1"
JSON_FILE="$2"

case "$ACTION" in
  query)
    # Query all "submitted" tasks via dreamina query_result
    if [ ! -f "$JSON_FILE" ]; then
      echo "FAIL file not found: $JSON_FILE"
      exit 1
    fi
    DOWNLOAD_DIR="${3:-/tmp/dreamina-task-query}"
    mkdir -p "$DOWNLOAD_DIR"

    # Extract submit_ids with "submitted" status
    # Simple grep-based parsing for our fixed JSON format
    grep -oE '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' "$JSON_FILE" | while read -r match; do
      SUBMIT_ID=$(echo "$match" | sed 's/.*"submit_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
      [ -z "$SUBMIT_ID" ] && continue

      # Check if this entry has status "submitted"
      # Look for submit_id followed by status:submitted in the same JSON object
      if ! grep -A5 "\"$SUBMIT_ID\"" "$JSON_FILE" | grep -q '"status"[[:space:]]*:[[:space:]]*"submitted"'; then
        continue
      fi

      # Query dreamina
      RESULT=$(dreamina query_result --submit_id="$SUBMIT_ID" --download_dir="$DOWNLOAD_DIR" 2>&1)
      STATUS=$(printf '%s' "$RESULT" | grep -o '"gen_status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"gen_status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

      case "$STATUS" in
        success)
          # Find downloaded file
          DL_FILE=$(ls "$DOWNLOAD_DIR"/${SUBMIT_ID}_* 2>/dev/null | head -1)
          echo "${SUBMIT_ID}:success:${DL_FILE}"
          ;;
        fail)
          REASON=$(printf '%s' "$RESULT" | grep -o '"fail_reason"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"fail_reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
          echo "${SUBMIT_ID}:fail:${REASON:-unknown}"
          ;;
        *)
          echo "${SUBMIT_ID}:querying"
          ;;
      esac
    done
    ;;

  update)
    # Update status of a specific submit_id
    if [ ! -f "$JSON_FILE" ]; then
      echo "FAIL file not found: $JSON_FILE"
      exit 1
    fi
    SUBMIT_ID="$3"
    NEW_STATUS="$4"
    if [ -z "$SUBMIT_ID" ] || [ -z "$NEW_STATUS" ]; then
      echo "Usage: bash scripts/task-status.sh update file.json submit_id new_status"
      exit 1
    fi
    # Replace status value for the matching submit_id entry
    # Find the line with this submit_id, then find the next "status" line and replace
    sed -i "/${SUBMIT_ID}/,/\"status\"/{s/\"status\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"status\": \"${NEW_STATUS}\"/}" "$JSON_FILE"
    ;;

  remove)
    # Remove entry with specific submit_id
    if [ ! -f "$JSON_FILE" ]; then
      echo "FAIL file not found: $JSON_FILE"
      exit 1
    fi
    SUBMIT_ID="$3"
    if [ -z "$SUBMIT_ID" ]; then
      echo "Usage: bash scripts/task-status.sh remove file.json submit_id"
      exit 1
    fi
    # Remove the JSON object containing this submit_id
    # This handles the simple array-of-objects format we use
    awk -v id="$SUBMIT_ID" '
      BEGIN { skip=0; buf="" }
      /{/ { buf=$0; skip=0 }
      { if (buf != "" && $0 !~ /}/) { buf=buf "\n" $0 } }
      /}/ {
        if (buf != "") { buf=buf "\n" $0 }
        else { buf=$0 }
        if (buf ~ id) { skip=1 }
        if (!skip) { print buf }
        buf=""; skip=0
      }
      buf == "" && !/[{}]/ { print }
    ' "$JSON_FILE" > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"

    # Clean up: if file is just [] or empty, remove it
    CONTENT=$(tr -d '[:space:]' < "$JSON_FILE")
    if [ "$CONTENT" = "[]" ] || [ -z "$CONTENT" ]; then
      rm -f "$JSON_FILE"
    fi
    ;;

  add)
    # Add entry to JSON array
    ENTRY="$3"
    if [ -z "$ENTRY" ]; then
      echo "Usage: bash scripts/task-status.sh add file.json '{\"shot\":1,...}'"
      exit 1
    fi
    if [ ! -f "$JSON_FILE" ]; then
      echo "[$ENTRY]" > "$JSON_FILE"
    else
      # Remove trailing ] , add comma + new entry + ]
      sed -i 's/][[:space:]]*$//' "$JSON_FILE"
      # Check if file has existing entries
      if grep -q '{' "$JSON_FILE"; then
        echo ",$ENTRY]" >> "$JSON_FILE"
      else
        echo "$ENTRY]" >> "$JSON_FILE"
      fi
    fi
    ;;

  *)
    echo "Unknown action: $ACTION"
    echo "Usage: bash scripts/task-status.sh {query|update|remove|add} file.json [args...]"
    exit 1
    ;;
esac
