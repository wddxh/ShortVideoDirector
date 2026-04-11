#!/usr/bin/env bash
# Tests for video-check-dreamina.sh

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR=$(mktemp -d)
PASS=0
FAIL=0
MOCK_DIR="$TEST_DIR/mock-bin"
mkdir -p "$MOCK_DIR"
export PATH="$MOCK_DIR:$PATH"

cleanup() { rm -rf "$TEST_DIR"; }
trap cleanup EXIT

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"; echo "  expected: $expected"; echo "  actual:   $actual"; FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "PASS: $desc"; PASS=$((PASS + 1))
  else
    echo "FAIL: $desc"; echo "  expected to contain: $needle"; echo "  actual: $haystack"; FAIL=$((FAIL + 1))
  fi
}

# ============================================================
echo "=== Test 1: success — video downloaded ==="
# ============================================================
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
for arg in "$@"; do case "$arg" in --download_dir=*) DL_DIR="${arg#*=}" ;; esac; done
mkdir -p "$DL_DIR"
echo "fake video" > "$DL_DIR/sub_001_video.mp4"
echo '{"submit_id":"sub_001","gen_status":"success"}'
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT_FILE="$TEST_DIR/shot01.mp4"
OUTPUT=$(bash "$SCRIPT_DIR/scripts/video-check-dreamina.sh" sub_001 "$OUTPUT_FILE" 2>&1)
EXIT_CODE=$?
assert_eq "exit code 0" "0" "$EXIT_CODE"
assert_eq "output is success" "success" "$OUTPUT"
assert_eq "file exists" "true" "$([ -f "$OUTPUT_FILE" ] && echo true || echo false)"

# ============================================================
echo ""
echo "=== Test 2: querying — still in progress ==="
# ============================================================
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
echo '{"submit_id":"sub_002","gen_status":"querying"}'
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/video-check-dreamina.sh" sub_002 "$TEST_DIR/shot02.mp4" 2>&1)
EXIT_CODE=$?
assert_eq "exit code 1" "1" "$EXIT_CODE"
assert_eq "output is querying" "querying" "$OUTPUT"

# ============================================================
echo ""
echo "=== Test 3: fail — with reason ==="
# ============================================================
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
echo '{"submit_id":"sub_003","gen_status":"fail","fail_reason":"ExceedConcurrencyLimit"}'
MOCK
chmod +x "$MOCK_DIR/dreamina"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/video-check-dreamina.sh" sub_003 "$TEST_DIR/shot03.mp4" 2>&1)
EXIT_CODE=$?
assert_eq "exit code 0" "0" "$EXIT_CODE"
assert_eq "output is fail:reason" "fail:ExceedConcurrencyLimit" "$OUTPUT"

# ============================================================
echo ""
echo "=== Test 4: mv failure — retries then reports ==="
# ============================================================
cat > "$MOCK_DIR/dreamina" << 'MOCK'
#!/usr/bin/env bash
for arg in "$@"; do case "$arg" in --download_dir=*) DL_DIR="${arg#*=}" ;; esac; done
mkdir -p "$DL_DIR"
echo "video" > "$DL_DIR/sub_004_video.mp4"
echo '{"submit_id":"sub_004","gen_status":"success"}'
MOCK
chmod +x "$MOCK_DIR/dreamina"

# Mock mv to fail for mp4 files
cat > "$MOCK_DIR/mv" << 'MOCK'
#!/usr/bin/env bash
for arg in "$@"; do case "$arg" in *.mp4) exit 1 ;; esac; done
/usr/bin/mv "$@"
MOCK
chmod +x "$MOCK_DIR/mv"

OUTPUT=$(bash "$SCRIPT_DIR/scripts/video-check-dreamina.sh" sub_004 "$TEST_DIR/shot04.mp4" 2>&1)
rm -f "$MOCK_DIR/mv"
EXIT_CODE=$?
assert_eq "exit code 0" "0" "$EXIT_CODE"
assert_eq "output is fail:move_failed" "fail:move_failed" "$OUTPUT"

# ============================================================
echo ""
echo "=== Test 5: missing arguments ==="
# ============================================================
OUTPUT=$(bash "$SCRIPT_DIR/scripts/video-check-dreamina.sh" 2>&1)
EXIT_CODE=$?
assert_eq "exit code 2" "2" "$EXIT_CODE"
assert_contains "usage message" "Usage" "$OUTPUT"

# ============================================================
echo ""
echo "========================================="
echo "Results: $PASS passed, $FAIL failed"
echo "========================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
