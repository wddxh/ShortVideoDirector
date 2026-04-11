#!/usr/bin/env bash
# Query and update task status in pending.json / tasks.json files.
# Usage:
#   bash scripts/task-status.sh query  file.json download_dir
#   bash scripts/task-status.sh update file.json submit_id new_status
#   bash scripts/task-status.sh remove file.json submit_id
#   bash scripts/task-status.sh add    file.json '{"shot":1,"submit_id":"xxx","status":"submitted"}'
#   bash scripts/task-status.sh upsert file.json shot_number '{"shot":1,"submit_id":"xxx","status":"submitted"}'
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
    # Output format: shot:submit_id:gen_status[:detail]
    if [ ! -f "$JSON_FILE" ]; then
      echo "FAIL file not found: $JSON_FILE"
      exit 1
    fi
    DOWNLOAD_DIR="${3:-/tmp/dreamina-task-query}"
    mkdir -p "$DOWNLOAD_DIR"

    # Flatten JSON to one object per line, find submitted entries
    FLAT=$(tr -d '\n' < "$JSON_FILE" | sed 's/^\[//' | sed 's/\]$//' | sed 's/},{/}\n{/g')
    while IFS= read -r obj; do
      [ -z "$obj" ] && continue
      # Check if this object has status "submitted"
      echo "$obj" | grep -q '"status"[[:space:]]*:[[:space:]]*"submitted"' || continue

      # Extract shot number
      SHOT=$(echo "$obj" | grep -oE '"shot"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+')
      # Extract submit_id
      SUBMIT_ID=$(echo "$obj" | grep -oE '"submit_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
      [ -z "$SUBMIT_ID" ] && continue
      [ -z "$SHOT" ] && continue

      # Query dreamina
      RESULT=$(dreamina query_result --submit_id="$SUBMIT_ID" --download_dir="$DOWNLOAD_DIR" 2>&1)
      STATUS=$(printf '%s' "$RESULT" | grep -o '"gen_status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"gen_status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

      case "$STATUS" in
        success)
          DL_FILE=$(ls "$DOWNLOAD_DIR"/${SUBMIT_ID}_* 2>/dev/null | head -1)
          echo "${SHOT}:${SUBMIT_ID}:success:${DL_FILE}"
          ;;
        fail)
          REASON=$(printf '%s' "$RESULT" | grep -o '"fail_reason"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"fail_reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
          echo "${SHOT}:${SUBMIT_ID}:fail:${REASON:-unknown}"
          ;;
        *)
          echo "${SHOT}:${SUBMIT_ID}:querying"
          ;;
      esac
    done <<< "$FLAT"
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
    # Validate NEW_STATUS is a simple string (no JSON objects or quotes)
    case "$NEW_STATUS" in
      submitted|done|failed) ;;
      *)
        echo "FAIL: status must be one of: submitted, done, failed. Got: $NEW_STATUS"
        exit 1
        ;;
    esac
    # Flatten, find matching object by submit_id, replace status, rebuild
    FLAT=$(tr -d '\n' < "$JSON_FILE" | sed 's/^\[//' | sed 's/\]$//' | sed 's/},{/}\n{/g')
    {
      echo "["
      FIRST=true
      while IFS= read -r obj; do
        [ -z "$obj" ] && continue
        if echo "$obj" | grep -q "\"$SUBMIT_ID\""; then
          # Replace status in this object
          obj=$(echo "$obj" | sed "s/\"status\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"status\":\"${NEW_STATUS}\"/")
        fi
        if [ "$FIRST" = true ]; then
          echo "$obj"
          FIRST=false
        else
          echo ",$obj"
        fi
      done <<< "$FLAT"
      echo "]"
    } > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"
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
    # Flatten, filter out matching object, rebuild
    FLAT=$(tr -d '\n' < "$JSON_FILE" | sed 's/^\[//' | sed 's/\]$//' | sed 's/},{/}\n{/g')
    {
      echo "["
      FIRST=true
      while IFS= read -r obj; do
        [ -z "$obj" ] && continue
        if echo "$obj" | grep -q "\"$SUBMIT_ID\""; then
          continue
        fi
        if [ "$FIRST" = true ]; then
          echo "$obj"
          FIRST=false
        else
          echo ",$obj"
        fi
      done <<< "$FLAT"
      echo "]"
    } > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"

    # Clean up: if file is just [] or empty, remove it
    CONTENT=$(tr -d '[:space:]' < "$JSON_FILE")
    if [ "$CONTENT" = "[]" ] || [ -z "$CONTENT" ]; then
      rm -f "$JSON_FILE"
    fi
    ;;

  add)
    # Add entry to JSON array (no dedup, use upsert for dedup)
    ENTRY="$3"
    if [ -z "$ENTRY" ]; then
      echo "Usage: bash scripts/task-status.sh add file.json '{\"shot\":1,...}'"
      exit 1
    fi
    # Validate ENTRY is a JSON object
    if ! echo "$ENTRY" | grep -q '^{.*}$'; then
      echo "FAIL: ENTRY must be a JSON object starting with { and ending with }, got: $ENTRY"
      exit 1
    fi
    if [ ! -f "$JSON_FILE" ]; then
      echo "[$ENTRY]" > "$JSON_FILE"
    else
      # Read existing, append new entry, rewrite cleanly
      FLAT=$(tr -d '\n' < "$JSON_FILE" | sed 's/^\[//' | sed 's/\]$//' | sed 's/},{/}\n{/g')
      {
        echo "["
        FIRST=true
        while IFS= read -r obj; do
          [ -z "$obj" ] && continue
          if [ "$FIRST" = true ]; then
            echo "$obj"
            FIRST=false
          else
            echo ",$obj"
          fi
        done <<< "$FLAT"
        if [ "$FIRST" = true ]; then
          echo "$ENTRY"
        else
          echo ",$ENTRY"
        fi
        echo "]"
      } > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"
    fi
    ;;

  upsert)
    # Insert or replace entry by shot number (shot is the primary key)
    SHOT_NUM="$3"
    ENTRY="$4"
    if [ -z "$SHOT_NUM" ] || [ -z "$ENTRY" ]; then
      echo "Usage: bash scripts/task-status.sh upsert file.json shot_number '{\"shot\":1,...}'"
      exit 1
    fi
    # Validate ENTRY is a JSON object
    if ! echo "$ENTRY" | grep -q '^{.*}$'; then
      echo "FAIL: ENTRY must be a JSON object starting with { and ending with }, got: $ENTRY"
      exit 1
    fi
    if [ ! -f "$JSON_FILE" ]; then
      echo "[$ENTRY]" > "$JSON_FILE"
    else
      # Read file, flatten to one line per JSON object, filter out matching shot, rebuild
      # Step 1: Flatten file to extract individual JSON objects
      FLAT=$(tr -d '\n' < "$JSON_FILE" | sed 's/^\[//' | sed 's/\]$//' | sed 's/},{/}\n{/g')
      # Step 2: Filter out entries matching this shot number
      FILTERED=""
      while IFS= read -r obj; do
        [ -z "$obj" ] && continue
        # Check if this object contains "shot": N (exact match)
        if echo "$obj" | grep -qE "\"shot\"[[:space:]]*:[[:space:]]*${SHOT_NUM}[^0-9]|\"shot\"[[:space:]]*:[[:space:]]*${SHOT_NUM}\$|\"shot\":${SHOT_NUM}[^0-9]|\"shot\":${SHOT_NUM}\$"; then
          continue
        fi
        if [ -z "$FILTERED" ]; then
          FILTERED="$obj"
        else
          FILTERED="${FILTERED}
${obj}"
        fi
      done <<< "$FLAT"
      # Step 3: Rebuild JSON array with filtered entries + new entry
      {
        echo "["
        FIRST=true
        while IFS= read -r obj; do
          [ -z "$obj" ] && continue
          if [ "$FIRST" = true ]; then
            echo "$obj"
            FIRST=false
          else
            echo ",$obj"
          fi
        done <<< "$FILTERED"
        if [ "$FIRST" = true ]; then
          echo "$ENTRY"
        else
          echo ",$ENTRY"
        fi
        echo "]"
      } > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"
    fi
    ;;

  *)
    echo "Unknown action: $ACTION"
    echo "Usage: bash scripts/task-status.sh {query|update|remove|add|upsert} file.json [args...]"
    exit 1
    ;;
esac
