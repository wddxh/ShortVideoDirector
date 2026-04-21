"""tools/tests/test_build_workflow.py — TASK-006 workflow 双端构建端到端测试。

覆盖：
- 典型 user-invocable workflow：Claude → .claude/skills/<name>/SKILL.md，
  opencode → .opencode/commands/<name>.md，frontmatter 与正文均符合预期
- 典型 internal workflow：opencode → .opencode/skills/<name>/SKILL.md（不进 commands/）
- invoke 块在两端都被展开（不残留 ```invoke）
- opencode 端 $ARGUMENTS[N] → $<N+1>
- fail-fast：invoke 块的 skill 字段不存在时立即报错
- 附属文件（子目录）复制到 Claude 端 + opencode commands 子目录
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import build  # type: ignore[import-not-found]  # noqa: E402


CONFIG = {
    "agents": {"director": ["foo-skill"]},
    "runtimes": {
        "claude": {
            "business_skill_inject": {"user-invocable": False, "context": "fork"},
            "workflow_user_invocable_inject": {
                "user-invocable": True,
                "allowed-tools": "Read, Write, Edit, Glob, Bash, Skill, Agent",
            },
            "workflow_internal_inject": {
                "user-invocable": False,
                "allowed-tools": "Read, Write, Edit, Glob, Bash, Skill",
            },
            "invoke_template": "使用 Skill tool 调用 `{skill}` skill{args_phrase}\n",
            "invoke_no_args_phrase": "（无参数）",
            "invoke_with_args_phrase": "，传递参数：`{args}`",
        },
        "opencode": {
            "business_skill_inject": {},
            "workflow_user_invocable_inject": {"agent": "build", "subtask": True},
            "workflow_internal_inject": {"agent": "build", "subtask": True},
            "invoke_template": (
                "调用 task 工具，传入 agent: `{owner}`，"
                'prompt: "执行 {skill} skill 描述的任务{args_phrase}"\n'
            ),
            "invoke_no_args_phrase": "，无额外参数",
            "invoke_with_args_phrase": "，参数：{args}",
            "arguments_index_offset": 1,
        },
    },
    "workflows": {
        "user_invocable": ["my-flow"],
        "internal": ["nested-flow"],
        "opencode_degrade": [],
    },
}


def _strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", text, count=1, flags=re.DOTALL)


def _parse_frontmatter(text: str) -> dict:
    import yaml

    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    assert m is not None
    return yaml.safe_load(m.group(1))


def _write_workflow(src_root: Path, name: str, frontmatter: str, body: str) -> None:
    wf_dir = src_root / "workflows"
    wf_dir.mkdir(parents=True, exist_ok=True)
    (wf_dir / f"{name}.md").write_text(
        f"---\n{frontmatter}---\n{body}", encoding="utf-8"
    )


def _write_skill(src_root: Path, name: str) -> None:
    skill_dir = src_root / "skills" / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: stub\n---\nbody\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# 测试 1：user-invocable workflow 端到端
# ---------------------------------------------------------------------------


def test_user_invocable_workflow_e2e(tmp_path: Path) -> None:
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    _write_skill(src_root, "foo-skill")
    body = (
        "## 阶段 1\n\n"
        "1. 调用 foo：\n\n"
        "```invoke\nskill: foo-skill\nargs: $ARGUMENTS[2]\n```\n\n"
        "继续。\n"
    )
    _write_workflow(
        src_root,
        "my-flow",
        "name: my-flow\ndescription: 测试 workflow\nuser-invocable: true\nargument-hint: \"[arg1] [arg2]\"\n",
        body,
    )

    build.build_workflows(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=CONFIG,
    )

    # Claude side
    claude_out = claude_root / "skills" / "my-flow" / "SKILL.md"
    assert claude_out.exists()
    claude_text = claude_out.read_text(encoding="utf-8")
    claude_fm = _parse_frontmatter(claude_text)
    assert claude_fm["name"] == "my-flow"
    assert claude_fm["description"] == "测试 workflow"
    assert claude_fm["user-invocable"] is True
    assert claude_fm["argument-hint"] == "[arg1] [arg2]"
    assert "Agent" in claude_fm["allowed-tools"]
    claude_body = _strip_frontmatter(claude_text)
    assert "```invoke" not in claude_body
    assert "使用 Skill tool 调用 `foo-skill` skill，传递参数：`$ARGUMENTS[2]`" in claude_body
    # Claude 端不做 $ARGUMENTS 转换
    assert "$ARGUMENTS[2]" in claude_body
    assert "$3" not in claude_body

    # opencode side: command at .opencode/commands/my-flow.md
    op_out = opencode_root / "commands" / "my-flow.md"
    assert op_out.exists()
    op_text = op_out.read_text(encoding="utf-8")
    op_fm = _parse_frontmatter(op_text)
    assert op_fm.get("agent") == "build"
    assert op_fm.get("subtask") is True
    assert op_fm.get("description") == "测试 workflow"
    assert op_fm.get("argument-hint") == "[arg1] [arg2]"
    assert "name" not in op_fm
    op_body = _strip_frontmatter(op_text)
    assert "```invoke" not in op_body
    assert "task 工具" in op_body
    # opencode 端 $ARGUMENTS[2] → $3
    assert "$ARGUMENTS[2]" not in op_body
    assert "$3" in op_body

# ---------------------------------------------------------------------------
# 测试 2：internal workflow 端到端
# ---------------------------------------------------------------------------


def test_internal_workflow_routes_to_opencode_skills(tmp_path: Path) -> None:
    """internal workflow 在 opencode 端走 .opencode/skills/<name>/SKILL.md。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    _write_skill(src_root, "foo-skill")
    body = "正文\n\n```invoke\nskill: foo-skill\nargs: \"\"\n```\n"
    _write_workflow(
        src_root,
        "nested-flow",
        "name: nested-flow\ndescription: 内部工作流\nuser-invocable: false\n",
        body,
    )

    build.build_workflows(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=CONFIG,
    )

    # Claude 端：skills/<name>/SKILL.md
    claude_out = claude_root / "skills" / "nested-flow" / "SKILL.md"
    assert claude_out.exists()
    claude_fm = _parse_frontmatter(claude_out.read_text(encoding="utf-8"))
    assert claude_fm["user-invocable"] is False
    assert "allowed-tools" in claude_fm

    # opencode 端：skills/<name>/SKILL.md（不在 commands/ 下）
    op_skill_out = opencode_root / "skills" / "nested-flow" / "SKILL.md"
    op_cmd_out = opencode_root / "commands" / "nested-flow.md"
    assert op_skill_out.exists(), f"internal workflow 应输出到 {op_skill_out}"
    assert not op_cmd_out.exists(), f"internal workflow 不应输出到 {op_cmd_out}"

    op_fm = _parse_frontmatter(op_skill_out.read_text(encoding="utf-8"))
    assert op_fm.get("name") == "nested-flow"
    assert op_fm.get("description") == "内部工作流"
    # opencode internal workflow 像业务 skill 一样：仅 name + description
    assert "agent" not in op_fm
    assert "subtask" not in op_fm


# ---------------------------------------------------------------------------
# 测试 3：fail-fast — invoke 引用不存在的 skill
# ---------------------------------------------------------------------------


def test_invoke_fails_fast_on_unknown_skill(tmp_path: Path) -> None:
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    _write_skill(src_root, "foo-skill")
    body = "```invoke\nskill: directar-arc\nargs: \"\"\n```\n"  # 拼错
    _write_workflow(
        src_root,
        "my-flow",
        "name: my-flow\ndescription: 测试\nuser-invocable: true\n",
        body,
    )

    with pytest.raises(Exception) as excinfo:
        build.build_workflows(
            src_root=src_root,
            claude_root=claude_root,
            opencode_root=opencode_root,
            config=CONFIG,
        )
    msg = str(excinfo.value)
    assert "directar-arc" in msg, f"错误信息缺少出问题的 skill 名: {msg}"
    assert "my-flow" in msg, f"错误信息应含 workflow 名: {msg}"


# ---------------------------------------------------------------------------
# 测试 4：附属子目录复制
# ---------------------------------------------------------------------------


def test_copies_workflow_subdirectory_attachments(tmp_path: Path) -> None:
    """src/workflows/<name>/<file> 复制到 .claude/skills/<name>/<file> 与
    .opencode/commands/<name>/<file>（user_invocable 时）。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    _write_skill(src_root, "foo-skill")
    _write_workflow(
        src_root,
        "my-flow",
        "name: my-flow\ndescription: 测试\nuser-invocable: true\n",
        "正文\n",
    )
    # 子目录附属文件
    (src_root / "workflows" / "my-flow").mkdir(parents=True, exist_ok=True)
    (src_root / "workflows" / "my-flow" / "config-template.md").write_text(
        "# template\n", encoding="utf-8"
    )

    build.build_workflows(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=CONFIG,
    )

    claude_attach = claude_root / "skills" / "my-flow" / "config-template.md"
    op_attach = opencode_root / "commands" / "my-flow" / "config-template.md"
    assert claude_attach.exists(), f"附属未复制到 {claude_attach}"
    assert op_attach.exists(), f"附属未复制到 {op_attach}"
    assert claude_attach.read_text(encoding="utf-8") == "# template\n"
    assert op_attach.read_text(encoding="utf-8") == "# template\n"
