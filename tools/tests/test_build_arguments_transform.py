"""tools/tests/test_build_arguments_transform.py — TASK-006 $ARGUMENTS 索引转换。

覆盖：
- offset=1 时 $ARGUMENTS[0] → $1, $ARGUMENTS[10] → $11
- 不应误伤 'ARGUMENTS[3]'（不带 $）
- 不应误伤 '$ARGUMENTS123'（不带方括号）
- 多处出现都被替换
- 空字符串 / 无 $ARGUMENTS 文本保持原样
"""

from __future__ import annotations

import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import build  # type: ignore[import-not-found]  # noqa: E402


def test_transform_zero_index_offset_one() -> None:
    assert build.transform_arguments_indices("$ARGUMENTS[0]", 1) == "$1"


def test_transform_double_digit_index_offset_one() -> None:
    assert build.transform_arguments_indices("$ARGUMENTS[10]", 1) == "$11"


def test_transform_does_not_touch_arguments_without_dollar() -> None:
    """'ARGUMENTS[3]' 不带 $ 前缀，保持原样。"""
    src = "ARGUMENTS[3] 这种写法不应被替换"
    assert build.transform_arguments_indices(src, 1) == src


def test_transform_does_not_touch_dollar_arguments_without_brackets() -> None:
    """'$ARGUMENTS123' 不带方括号，保持原样。"""
    src = "look at $ARGUMENTS123 here"
    assert build.transform_arguments_indices(src, 1) == src


def test_transform_replaces_multiple_occurrences() -> None:
    src = "args: '$ARGUMENTS[0] $ARGUMENTS[1] $ARGUMENTS[2]'"
    expected = "args: '$1 $2 $3'"
    assert build.transform_arguments_indices(src, 1) == expected


def test_transform_empty_string_unchanged() -> None:
    assert build.transform_arguments_indices("", 1) == ""


def test_transform_no_arguments_token_unchanged() -> None:
    src = "完全没有占位符的普通文本。"
    assert build.transform_arguments_indices(src, 1) == src


def test_transform_inside_quoted_string() -> None:
    src = '调用 task 工具，prompt: "执行 X，参数：$ARGUMENTS[2]"'
    expected = '调用 task 工具，prompt: "执行 X，参数：$3"'
    assert build.transform_arguments_indices(src, 1) == expected


def test_transform_offset_zero_is_identity_on_index() -> None:
    """offset=0 → $ARGUMENTS[N] 变成 $N（极端但合法的偏移值）。"""
    assert build.transform_arguments_indices("$ARGUMENTS[5]", 0) == "$5"


def test_transform_slice_notation_offset_one() -> None:
    """`$ARGUMENTS[N..]` 切片记法 → `$<N+offset>...`（保留"从 N 开始的所有参数"语义）。

    实际源 src/workflows/generate-video.md 含 `$ARGUMENTS[1..]` 用于"剩余参数"。
    必须转换以满足 AC3「opencode 端无 $ARGUMENTS[ 残留」。
    """
    assert build.transform_arguments_indices("$ARGUMENTS[1..]", 1) == "$2..."


def test_transform_slice_notation_inside_text() -> None:
    src = "从 `$ARGUMENTS[1..]` 获取镜头列表"
    expected = "从 `$2...` 获取镜头列表"
    assert build.transform_arguments_indices(src, 1) == expected
