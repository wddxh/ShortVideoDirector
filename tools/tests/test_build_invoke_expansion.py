"""tools/tests/test_build_invoke_expansion.py — TASK-006 invoke 块展开纯函数。

覆盖：
- Claude 端 / opencode 端 × 业务 skill / workflow target
- no-args / with-args
- opencode 端 workflow target 走 fallback 模板（使用 skill 工具加载）
"""

from __future__ import annotations

import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import build  # type: ignore[import-not-found]  # noqa: E402


CONFIG = {
    "agents": {"director": ["foo-skill"]},
    "runtimes": {
        "claude": {
            "invoke_template": "使用 Skill tool 调用 `{skill}` skill{args_phrase}\n",
            "invoke_no_args_phrase": "（无参数）",
            "invoke_with_args_phrase": "，传递参数：`{args}`",
        },
        "opencode": {
            "invoke_template": (
                "调用 task 工具，传入 agent: `{owner}`，"
                'prompt: "执行 {skill} skill 描述的任务{args_phrase}"\n'
            ),
            "invoke_no_args_phrase": "，无额外参数",
            "invoke_with_args_phrase": "，参数：{args}",
        },
    },
}

SKILL_TO_OWNER = {"foo-skill": "director"}
BUSINESS_SET = {"foo-skill"}


# ---------------------------------------------------------------------------
# Claude 端
# ---------------------------------------------------------------------------


def test_claude_business_skill_no_args() -> None:
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "foo-skill", "args": ""},
        runtime="claude",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert out == "使用 Skill tool 调用 `foo-skill` skill（无参数）"


def test_claude_business_skill_with_args() -> None:
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "foo-skill", "args": "ep01"},
        runtime="claude",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert out == "使用 Skill tool 调用 `foo-skill` skill，传递参数：`ep01`"


def test_claude_workflow_target_no_args() -> None:
    """Claude 端 workflow target 也走相同模板（不区分 owner）。"""
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "new-story", "args": ""},
        runtime="claude",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert out == "使用 Skill tool 调用 `new-story` skill（无参数）"


# ---------------------------------------------------------------------------
# opencode 端
# ---------------------------------------------------------------------------


def test_opencode_business_skill_no_args() -> None:
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "foo-skill", "args": ""},
        runtime="opencode",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert out == (
        "调用 task 工具，传入 agent: `director`，"
        'prompt: "执行 foo-skill skill 描述的任务，无额外参数"'
    )


def test_opencode_business_skill_with_args() -> None:
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "foo-skill", "args": "ep01"},
        runtime="opencode",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert out == (
        "调用 task 工具，传入 agent: `director`，"
        'prompt: "执行 foo-skill skill 描述的任务，参数：ep01"'
    )


def test_opencode_workflow_target_uses_fallback_template() -> None:
    """opencode 端：skill 字段指向 workflow（不在 business_skill_set），走 fallback。"""
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "new-story", "args": ""},
        runtime="opencode",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert "skill 工具" in out
    assert "new-story" in out
    assert "无额外参数" in out
    # fallback 不调用 task 工具
    assert "task 工具" not in out


def test_opencode_workflow_target_with_args_uses_fallback() -> None:
    out = build.expand_invoke_block(
        invoke_yaml={"skill": "continue-story", "args": "default ep02"},
        runtime="opencode",
        config=CONFIG,
        skill_to_owner=SKILL_TO_OWNER,
        business_skill_set=BUSINESS_SET,
    )
    assert "continue-story" in out
    assert "default ep02" in out
    assert "task 工具" not in out
