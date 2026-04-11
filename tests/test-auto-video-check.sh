#!/usr/bin/env bash
# Tests for auto-video-check.sh
# Mocks dreamina CLI to test without real API calls

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR=$(mktemp -d)
PASS=0
FAIL=0
MOCK_DIR="$TEST_DIR/mock-bin"

# Setup mock dreamina in PATH
mkdir -p "$MOCK_DIR"
export PATH="$MOCK_DIR:$PATH"

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  expected to contain: $needle"
    echo "  actual: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if ! echo "$haystack" | grep -qF "$needle"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"
    echo "  expected NOT to contain: $needle"
    echo "  actual: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_exists() {
  local desc="$1" file="$2"
  if [ -f "$file" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (file not found: $file)"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_not_exists() {
  local desc="$1" file="$2"
  if [ ! -f "$file" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (file exists but shouldn't: $file)"
    FAIL=$((FAIL + 1))
  fi
}

# Helper: create a test project structure with scripts symlinked
setup_project() {
  local proj="$TEST_DIR/proj-$1"
  mkdir -p "$proj/story/episodes/ep01/videos"
  # Symlink scripts dir so relative paths work
  ln -sf "$SCRIPT_DIR/scripts" "$proj/scripts"
  echo "$proj"
}

# ============================================================
echo "=== Test 1: mv success marks task as done ==="
# ============================================================
PROJ=$(setup_project t1)
cd "$PROJ"

# Create tasks.json with one submitted task
cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_001","status":"submitted","prompt":"test","images":"","duration":15,"fail_reason":""}]
EOF

# Mock dreamina: query_result returns success and creates a download file
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  # Extract download_dir
  for arg in "$@"; do
    case "$arg" in --download_dir=*) DL_DIR="${arg#*=}" ;; esac
  done
  if [ -n "$DL_DIR" ]; then
    mkdir -p "$DL_DIR"
    echo "fake video content" > "$DL_DIR/sub_001_video.mp4"
  fi
  echo '{"submit_id":"sub_001","gen_status":"success","result_json":{"videos":[{"video_url":"http://example.com/v.mp4"}]}}'
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
assert_contains "output has DONE:shot1" "DONE:shot1" "$OUTPUT"
assert_file_exists "shot01.mp4 exists" "story/episodes/ep01/videos/shot01.mp4"

# Check tasks.json status is done
STATUS=$(grep -o '"status":"[^"]*"' story/episodes/ep01/videos/tasks.json | head -1)
assert_eq "status is done" '"status":"done"' "$STATUS"

# ============================================================
echo ""
echo "=== Test 2: mv failure does NOT mark as done (retry 3 times) ==="
# ============================================================
PROJ=$(setup_project t2)
cd "$PROJ"

cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_002","status":"submitted","prompt":"test","images":"","duration":15,"fail_reason":""}]
EOF

# Mock dreamina: returns success with download file
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  for arg in "$@"; do
    case "$arg" in --download_dir=*) DL_DIR="${arg#*=}" ;; esac
  done
  if [ -n "$DL_DIR" ]; then
    mkdir -p "$DL_DIR"
    echo "video" > "$DL_DIR/sub_002_video.mp4"
  fi
  echo '{"submit_id":"sub_002","gen_status":"success","result_json":{"videos":[{"video_url":"http://example.com/v.mp4"}]}}'
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

# Mock mv: fail only for shot*.mp4 destinations, pass through for .tmp (task-status.sh)
cat > "$MOCK_DIR/mv" << 'MOCK'
#!/usr/bin/env bash
for arg in "$@"; do
  case "$arg" in */shot*.mp4) exit 1 ;; esac
done
/usr/bin/mv "$@"
MOCK
chmod +x "$MOCK_DIR/mv"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
# Remove mock mv so it doesn't affect other tests
rm -f "$MOCK_DIR/mv"

assert_contains "output has MOVE_FAILED" "MOVE_FAILED:shot1" "$OUTPUT"
assert_not_contains "output should NOT have DONE" "DONE:shot1" "$OUTPUT"

# Status should still be submitted (not done)
STATUS=$(grep -o '"status":"[^"]*"' story/episodes/ep01/videos/tasks.json | head -1)
assert_eq "status still submitted" '"status":"submitted"' "$STATUS"

# ============================================================
echo ""
echo "=== Test 3: fail with special chars in fail_reason ==="
# ============================================================
PROJ=$(setup_project t3)
cd "$PROJ"

cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_003","status":"submitted","prompt":"test","images":"","duration":15,"fail_reason":""}]
EOF

# Mock dreamina: returns fail with special chars in reason (/, &, \)
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  echo '{"submit_id":"sub_003","gen_status":"fail","fail_reason":"error/with&special\\chars"}'
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
assert_contains "output has FAILED" "FAILED:shot1" "$OUTPUT"

# Check fail_reason was written correctly
REASON=$(grep -o '"fail_reason":"[^"]*"' story/episodes/ep01/videos/tasks.json)
assert_eq "fail_reason preserved special chars" '"fail_reason":"error/with&special\\chars"' "$REASON"

# Check status is failed
STATUS=$(grep -o '"status":"[^"]*"' story/episodes/ep01/videos/tasks.json | head -1)
assert_eq "status is failed" '"status":"failed"' "$STATUS"

# ============================================================
echo ""
echo "=== Test 4: querying status passes through ==="
# ============================================================
PROJ=$(setup_project t4)
cd "$PROJ"

cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_004","status":"submitted","prompt":"test","images":"","duration":15,"fail_reason":""}]
EOF

# Mock dreamina: returns querying
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  echo '{"submit_id":"sub_004","gen_status":"querying","queue_info":{"queue_status":"Generating"}}'
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
assert_contains "output has QUERYING" "QUERYING:shot1" "$OUTPUT"

# Status should still be submitted
STATUS=$(grep -o '"status":"[^"]*"' story/episodes/ep01/videos/tasks.json | head -1)
assert_eq "status still submitted" '"status":"submitted"' "$STATUS"

# ============================================================
echo ""
echo "=== Test 5: sync existing video files ==="
# ============================================================
PROJ=$(setup_project t5)
cd "$PROJ"

# tasks.json has shot 1 only, but shot02.mp4 exists on disk
cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_005","status":"done","prompt":"test","images":"","duration":15,"fail_reason":""}]
EOF
echo "video content" > story/episodes/ep01/videos/shot02.mp4

# Mock dreamina: no submitted tasks to query
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
echo '{}'
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
assert_contains "output has SYNCED:shot2" "SYNCED:shot2:done" "$OUTPUT"

# Check shot 2 was added to tasks.json
SHOT2=$(grep -c '"shot":2' story/episodes/ep01/videos/tasks.json)
assert_eq "shot 2 added to tasks.json" "1" "$SHOT2"

# ============================================================
echo ""
echo "=== Test 6: prompt backfill with special chars ==="
# ============================================================
PROJ=$(setup_project t6)
cd "$PROJ"

# Task with submit_id but empty prompt
cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_006","status":"done","prompt":"","images":"","duration":15,"fail_reason":""}]
EOF

# Mock dreamina: query_result returns prompt with special chars
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  echo '{"submit_id":"sub_006","gen_status":"success","prompt":"test/prompt&with\\special"}'
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
assert_contains "output has BACKFILL" "BACKFILL:shot1:prompt" "$OUTPUT"

# Check prompt was written with special chars intact
PROMPT=$(grep -o '"prompt":"[^"]*"' story/episodes/ep01/videos/tasks.json | head -1)
assert_eq "prompt preserved special chars" '"prompt":"test/prompt&with\\special"' "$PROMPT"

# ============================================================
echo ""
echo "=== Test 7: multiple tasks mixed statuses ==="
# ============================================================
PROJ=$(setup_project t7)
cd "$PROJ"

cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_101","status":"done","prompt":"done prompt","images":"","duration":15,"fail_reason":""}
,{"shot":2,"submit_id":"sub_102","status":"submitted","prompt":"","images":"","duration":15,"fail_reason":""}
,{"shot":3,"submit_id":"","status":"pending_retry","prompt":"","images":"","duration":15,"fail_reason":"ExceedConcurrencyLimit"}]
EOF

# Mock dreamina: shot 2 returns success with download
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  for arg in "$@"; do
    case "$arg" in --submit_id=*) SID="${arg#*=}" ;; esac
    case "$arg" in --download_dir=*) DL_DIR="${arg#*=}" ;; esac
  done
  if [ "$SID" = "sub_102" ] && [ -n "$DL_DIR" ]; then
    mkdir -p "$DL_DIR"
    echo "video" > "$DL_DIR/sub_102_video.mp4"
    echo '{"submit_id":"sub_102","gen_status":"success","prompt":"shot 2 prompt"}'
  elif [ "$SID" = "sub_101" ]; then
    echo '{"submit_id":"sub_101","gen_status":"success","prompt":"done prompt"}'
  fi
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
assert_contains "shot 2 done" "DONE:shot2" "$OUTPUT"
assert_contains "summary has DONE:2" "DONE:2" "$OUTPUT"
assert_contains "summary has PENDING_RETRY:1" "PENDING_RETRY:1" "$OUTPUT"
assert_file_exists "shot02.mp4 downloaded" "story/episodes/ep01/videos/shot02.mp4"

# shot 1 should still be done, not re-queried (it's not submitted)
SHOT1_STATUS=$(tr -d '\n' < story/episodes/ep01/videos/tasks.json | grep -oE '"shot":1[^}]*' | grep -o '"status":"[^"]*"')
assert_eq "shot 1 still done" '"status":"done"' "$SHOT1_STATUS"

# ============================================================
echo ""
echo "=== Test 8: summary counts and exit code ==="
# ============================================================
PROJ=$(setup_project t8)
cd "$PROJ"

cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_201","status":"done","prompt":"p","images":"","duration":15,"fail_reason":""}
,{"shot":2,"submit_id":"sub_202","status":"done","prompt":"p","images":"","duration":15,"fail_reason":""}
,{"shot":3,"submit_id":"sub_203","status":"failed","prompt":"p","images":"","duration":15,"fail_reason":"err"}]
EOF

cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
echo '{}'
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
EXIT_CODE=$?
assert_eq "exit code 0 (all done/failed)" "0" "$EXIT_CODE"
assert_contains "summary DONE:2" "DONE:2" "$OUTPUT"
assert_contains "summary FAILED:1" "FAILED:1" "$OUTPUT"

# ============================================================
echo ""
echo "=== Test 9: exit code 1 when tasks still in progress ==="
# ============================================================
PROJ=$(setup_project t9)
cd "$PROJ"

cat > story/episodes/ep01/videos/tasks.json << 'EOF'
[{"shot":1,"submit_id":"sub_301","status":"submitted","prompt":"p","images":"","duration":15,"fail_reason":""}]
EOF

# Mock dreamina: still querying
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
if [ "$1" = "query_result" ]; then
  echo '{"submit_id":"sub_301","gen_status":"querying"}'
fi
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
EXIT_CODE=$?
assert_eq "exit code 1 (still in progress)" "1" "$EXIT_CODE"
assert_contains "SUBMITTED:1" "SUBMITTED:1" "$OUTPUT"

# ============================================================
echo ""
echo "=== Test 10: no tasks file ==="
# ============================================================
PROJ=$(setup_project t10)
cd "$PROJ"
# Don't create tasks.json

OUTPUT=$(bash "$SCRIPT_DIR/scripts/auto-video-check.sh" ep01 2>&1)
EXIT_CODE=$?
# Script should handle gracefully — no crash, just skip
assert_eq "exit code 0 (no tasks)" "0" "$EXIT_CODE"

# ============================================================
echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "========================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
