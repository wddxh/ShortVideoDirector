#!/bin/bash
# OC 版 auto-video 定时 loop 实现
# 必需环境变量:
#   PORT          - OC server 监听端口
#   SID           - OC session ID
#   INTERVAL      - 检查间隔秒数
#   PID_FILE      - PID 文件路径
#   PROMPT_FILE   - cron prompt 文件路径
#   LOG_FILE      - 日志文件路径

: "${PORT:?需要 PORT}"
: "${SID:?需要 SID}"
: "${INTERVAL:?需要 INTERVAL}"
: "${PID_FILE:?需要 PID_FILE}"
: "${PROMPT_FILE:?需要 PROMPT_FILE}"
: "${LOG_FILE:?需要 LOG_FILE}"

FAIL_COUNT=0
while true; do
  sleep "$INTERVAL"
  if HEALTH=$(curl -fs --max-time 2 "http://127.0.0.1:$PORT/global/health") &&
     grep -q healthy <<< "$HEALTH" &&
     PROMPT=$(cat "$PROMPT_FILE") &&
     PAYLOAD=$(jq -nc --arg t "$PROMPT" '{parts:[{type:"text",text:$t}]}') &&
     STATUS=$(curl -s --max-time 30 -X POST "http://127.0.0.1:$PORT/session/$SID/prompt_async" \
       -H 'Content-Type: application/json' \
       -d "$PAYLOAD" -o /dev/null -w '%{http_code}') &&
     [[ "$STATUS" == 2?? ]]; then
    FAIL_COUNT=0
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    if [ "$FAIL_COUNT" -ge 3 ]; then
      # Stop after three consecutive health or prompt-delivery failures.
      rm -f "$PID_FILE" "$PROMPT_FILE" "$LOG_FILE"
      exit 0
    fi
  fi
done
