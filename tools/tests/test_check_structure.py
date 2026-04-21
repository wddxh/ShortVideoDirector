"""tools/tests/test_check_structure.py — TASK-008 结构校验测试。

覆盖 5 类违规场景（每类至少 1 个测试用例）：
1. 文件数错误：claude/opencode 产物目录文件计数与期望不符
2. frontmatter schema 错误：opencode 业务 skill 含 'context: fork' 等禁字段
3. runtime-config 一致性错误：手动加 src/skills/foo-bar/ 但 mapping 未注册
4. 业务 skill 正文含调度关键字（如 '使用 Skill tool'）
5. invoke 块 skill 字段无效（指向不存在的 skill 名）

每个 check 函数在「干净」fixture 下应返回空列表，在「注入违规」后应返回非空列表。
另外补充 main() 的 smoke 测试：clean=0、有违规=非零。
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

# tools/check-structure.py 使用连字符文件名（CLI 入口约定），需用 importlib 加载。
_CHECK_STRUCTURE_PATH = TOOLS_DIR / "check-structure.py"
_spec = importlib.util.spec_from_file_location("check_structure", _CHECK_STRUCTURE_PATH)
assert _spec is not None and _spec.loader is not None
check_structure = importlib.util.module_from_spec(_spec)
sys.modules["check_structure"] = check_structure
_spec.loader.exec_module(check_structure)


# ---------------------------------------------------------------------------
# Fixture 构造工具
# ---------------------------------------------------------------------------

# 最小可校验的 runtime-config，覆盖：
#   - 2 个业务 skill（director-arc、writer-novel）分属不同 owner
#   - 1 个 user_invocable workflow（short-video）
#   - 1 个 internal workflow（new-story）
#   - 2 个 agent（director、writer）
MIN_CONFIG: dict = {
    "agents": {
        "director": ["director-arc"],
        "writer": ["writer-novel"],
    },
    "workflows": {
        "user_invocable": ["short-video"],
        "internal": ["new-story"],
        "opencode_degrade": [],
    },
    "runtimes": {
        "claude": {
            "business_skill_inject": {
                "user-invocable": False,
                "context": "fork",
            },
            "workflow_user_invocable_inject": {
                "user-invocable": True,
                "allowed-tools": "Read, Write, Edit, Glob, Bash, Skill, Agent",
            },
            "workflow_internal_inject": {
                "user-invocable": False,
                "allowed-tools": "Read, Write, Edit, Glob, Bash, Skill",
            },
            "agent_inject": {
                "tools": "Read, Write, Edit, Glob, Grep, Bash, Skill",
                "model": "inherit",
            },
            "invoke_template": "使用 Skill tool 调用 `{skill}` skill{args_phrase}",
            "invoke_no_args_phrase": "（无参数）",
            "invoke_with_args_phrase": "，传递参数：`{args}`",
        },
        "opencode": {
            "business_skill_inject": {},
            "workflow_user_invocable_inject": {
                "agent": "build",
                "subtask": True,
            },
            "workflow_internal_inject": {
                "agent": "build",
                "subtask": True,
            },
            "agent_inject": {
                "mode": "subagent",
            },
            "invoke_template": '调用 task 工具，传入 agent: `{owner}`，prompt: "执行 {skill} skill 描述的任务{args_phrase}"',
            "invoke_no_args_phrase": "，无额外参数",
            "invoke_with_args_phrase": "，参数：{args}",
            "arguments_index_offset": 1,
        },
    },
}


def _write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _build_clean_fixture(tmp_path: Path) -> tuple[Path, Path, Path]:
    """构造干净源 + 跑 build.py 生成产物，返回 (src_root, claude_root, opencode_root)。

    使用 MIN_CONFIG：2 业务 skill + 1 user_invocable workflow + 1 internal workflow + 2 agent。
    期望产物计数：
      - claude/skills/ = 2 + 2 = 4
      - opencode/skills/ = 2 + 1 = 3
      - opencode/commands/ = 1
      - claude/agents/ = opencode/agents/ = 2
    """
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    # 业务 skill
    _write_text(
        src_root / "skills" / "director-arc" / "SKILL.md",
        "---\nname: director-arc\ndescription: 测试导演弧线\n---\n# director-arc\n正文示例。\n",
    )
    _write_text(
        src_root / "skills" / "writer-novel" / "SKILL.md",
        "---\nname: writer-novel\ndescription: 测试小说\n---\n# writer-novel\n正文示例。\n",
    )

    # workflow（user_invocable）
    _write_text(
        src_root / "workflows" / "short-video.md",
        "---\nname: short-video\ndescription: 测试 user invocable 流程\n"
        "user-invocable: true\nargument-hint: '[材料]'\n---\n"
        "# short-video\n\n```invoke\nskill: director-arc\nargs: \"\"\n```\n",
    )
    # workflow（internal）
    _write_text(
        src_root / "workflows" / "new-story.md",
        "---\nname: new-story\ndescription: 测试 internal 流程\n"
        "user-invocable: false\n---\n# new-story\n\n```invoke\nskill: writer-novel\nargs: \"\"\n```\n",
    )

    # agent
    _write_text(
        src_root / "agents" / "director.md",
        "---\nname: director\ndescription: 测试导演\n---\n# Director\n",
    )
    _write_text(
        src_root / "agents" / "writer.md",
        "---\nname: writer\ndescription: 测试 writer\n---\n# Writer\n",
    )

    # 跑 build 链生成产物
    sys.path.insert(0, str(TOOLS_DIR))
    import build  # noqa: F401

    build.build_business_skills(src_root, claude_root, opencode_root, MIN_CONFIG)
    build.build_workflows(src_root, claude_root, opencode_root, MIN_CONFIG)
    build.build_agents(src_root, claude_root, opencode_root, MIN_CONFIG)

    return src_root, claude_root, opencode_root


# ---------------------------------------------------------------------------
# 校验①：file_counts
# ---------------------------------------------------------------------------


def test_file_counts_passes_on_clean_build(tmp_path: Path) -> None:
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    violations = check_structure.check_file_counts(
        claude_skills=claude_root / "skills",
        opencode_skills=opencode_root / "skills",
        opencode_commands=opencode_root / "commands",
        claude_agents=claude_root / "agents",
        opencode_agents=opencode_root / "agents",
        expected_claude_skills=4,
        expected_opencode_skills=3,
        expected_opencode_commands=1,
        expected_agents=2,
    )
    assert violations == [], f"clean fixture 应无违规，得到：{violations}"


def test_file_counts_detects_missing_claude_skill(tmp_path: Path) -> None:
    """AC2：故意删除一个 .claude/skills/<name>/SKILL.md → 报告缺失。"""
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    missing = claude_root / "skills" / "director-arc" / "SKILL.md"
    missing.unlink()

    violations = check_structure.check_file_counts(
        claude_skills=claude_root / "skills",
        opencode_skills=opencode_root / "skills",
        opencode_commands=opencode_root / "commands",
        claude_agents=claude_root / "agents",
        opencode_agents=opencode_root / "agents",
        expected_claude_skills=4,
        expected_opencode_skills=3,
        expected_opencode_commands=1,
        expected_agents=2,
    )
    assert violations, "删除 SKILL.md 后应报告违规"
    joined = " | ".join(violations)
    assert "claude" in joined.lower()
    # 错误信息应包含期望/实际数量或缺失文件路径
    assert any(("director-arc" in v) or ("3" in v and "4" in v) for v in violations), violations


def test_file_counts_detects_extra_command(tmp_path: Path) -> None:
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    _write_text(opencode_root / "commands" / "extra.md", "---\ndescription: extra\n---\nbody\n")

    violations = check_structure.check_file_counts(
        claude_skills=claude_root / "skills",
        opencode_skills=opencode_root / "skills",
        opencode_commands=opencode_root / "commands",
        claude_agents=claude_root / "agents",
        opencode_agents=opencode_root / "agents",
        expected_claude_skills=4,
        expected_opencode_skills=3,
        expected_opencode_commands=1,
        expected_agents=2,
    )
    assert violations, "添加多余 command 后应报告违规"
    assert any("commands" in v for v in violations), violations


# ---------------------------------------------------------------------------
# 校验②：frontmatter_schema
# ---------------------------------------------------------------------------


def test_frontmatter_schema_passes_on_clean_build(tmp_path: Path) -> None:
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    violations = check_structure.check_frontmatter_schema(
        claude_root=claude_root,
        opencode_root=opencode_root,
        src_root=src_root,
        config=MIN_CONFIG,
    )
    assert violations == [], f"clean fixture 应无违规，得到：{violations}"


def test_frontmatter_schema_rejects_context_field_in_opencode_skill(tmp_path: Path) -> None:
    """AC3：opencode 业务 skill frontmatter 含 'context: fork' → 报错。"""
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    target = opencode_root / "skills" / "director-arc" / "SKILL.md"
    text = target.read_text(encoding="utf-8")
    text = text.replace(
        "---\nname: director-arc",
        "---\ncontext: fork\nname: director-arc",
        1,
    )
    target.write_text(text, encoding="utf-8")

    violations = check_structure.check_frontmatter_schema(
        claude_root=claude_root,
        opencode_root=opencode_root,
        src_root=src_root,
        config=MIN_CONFIG,
    )
    assert violations, "opencode 业务 skill 含 context 字段应报告违规"
    joined = " | ".join(violations)
    assert "context" in joined
    assert "director-arc" in joined or "opencode" in joined


def test_frontmatter_schema_rejects_missing_required_field_in_claude_skill(
    tmp_path: Path,
) -> None:
    """Claude 业务 skill 缺少 'agent' 字段 → 报错。"""
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    target = claude_root / "skills" / "director-arc" / "SKILL.md"
    text = target.read_text(encoding="utf-8")
    # 删除 agent: director 行
    text = "\n".join(
        line for line in text.splitlines() if not line.startswith("agent:")
    ) + "\n"
    target.write_text(text, encoding="utf-8")

    violations = check_structure.check_frontmatter_schema(
        claude_root=claude_root,
        opencode_root=opencode_root,
        src_root=src_root,
        config=MIN_CONFIG,
    )
    assert violations, "Claude 业务 skill 缺 agent 字段应报告违规"
    assert any("agent" in v for v in violations), violations


def test_frontmatter_schema_rejects_name_in_opencode_command(tmp_path: Path) -> None:
    """opencode commands 不应含 name 字段（以文件名为准）。"""
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)
    target = opencode_root / "commands" / "short-video.md"
    text = target.read_text(encoding="utf-8")
    text = text.replace("---\ndescription:", "---\nname: short-video\ndescription:", 1)
    target.write_text(text, encoding="utf-8")

    violations = check_structure.check_frontmatter_schema(
        claude_root=claude_root,
        opencode_root=opencode_root,
        src_root=src_root,
        config=MIN_CONFIG,
    )
    assert violations, "opencode commands 含 name 字段应报告违规"
    assert any("name" in v for v in violations), violations


# ---------------------------------------------------------------------------
# 校验③：runtime_config_consistency
# ---------------------------------------------------------------------------


def test_runtime_config_consistency_passes_on_clean_build(tmp_path: Path) -> None:
    src_root, _, _ = _build_clean_fixture(tmp_path)
    violations = check_structure.check_runtime_config_consistency(
        config=MIN_CONFIG,
        src_root=src_root,
    )
    assert violations == [], f"clean fixture 应无违规，得到：{violations}"


def test_runtime_config_consistency_detects_unregistered_src_skill(tmp_path: Path) -> None:
    """加 src/skills/foo-bar/ 但 mapping 未注册 → 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    _write_text(
        src_root / "skills" / "foo-bar" / "SKILL.md",
        "---\nname: foo-bar\ndescription: x\n---\nbody\n",
    )
    violations = check_structure.check_runtime_config_consistency(
        config=MIN_CONFIG,
        src_root=src_root,
    )
    assert violations, "未注册的 src skill 应报告违规"
    assert any("foo-bar" in v for v in violations), violations


def test_runtime_config_consistency_detects_missing_workflow_file(tmp_path: Path) -> None:
    """config 声明 short-video user_invocable，但 src/workflows/ 缺该文件 → 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    (src_root / "workflows" / "short-video.md").unlink()

    violations = check_structure.check_runtime_config_consistency(
        config=MIN_CONFIG,
        src_root=src_root,
    )
    assert violations, "缺失 workflow 文件应报告违规"
    assert any("short-video" in v for v in violations), violations


def test_runtime_config_consistency_detects_missing_agent_file(tmp_path: Path) -> None:
    """config 的 agents key 'director' 必须对应 src/agents/director.md。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    (src_root / "agents" / "director.md").unlink()

    violations = check_structure.check_runtime_config_consistency(
        config=MIN_CONFIG,
        src_root=src_root,
    )
    assert violations, "缺失 agent 文件应报告违规"
    assert any("director" in v for v in violations), violations


# ---------------------------------------------------------------------------
# 校验④：business_skill_body
# ---------------------------------------------------------------------------


def test_business_skill_body_passes_on_clean_build(tmp_path: Path) -> None:
    src_root, _, _ = _build_clean_fixture(tmp_path)
    violations = check_structure.check_business_skill_body(src_root / "skills")
    assert violations == [], f"clean fixture 应无违规，得到：{violations}"


def test_business_skill_body_detects_skill_tool_keyword(tmp_path: Path) -> None:
    """AC4：业务 skill 正文含 '使用 Skill tool' → 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    target = src_root / "skills" / "director-arc" / "SKILL.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(
        text + "\n使用 Skill tool 调用 director-outline\n",
        encoding="utf-8",
    )

    violations = check_structure.check_business_skill_body(src_root / "skills")
    assert violations, "业务 skill 正文含 '使用 Skill tool' 应报告违规"
    joined = " | ".join(violations)
    assert "Skill tool" in joined or "director-arc" in joined


def test_business_skill_body_detects_arguments_keyword(tmp_path: Path) -> None:
    """业务 skill 正文含 '$ARGUMENTS[' 调度记法 → 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    target = src_root / "skills" / "writer-novel" / "SKILL.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(text + "\n参数：$ARGUMENTS[0]\n", encoding="utf-8")

    violations = check_structure.check_business_skill_body(src_root / "skills")
    assert violations, "业务 skill 正文含 '$ARGUMENTS[' 应报告违规"


def test_business_skill_body_detects_context_fork_keyword(tmp_path: Path) -> None:
    """业务 skill 正文含 'context: fork' 文本（非 frontmatter）→ 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    target = src_root / "skills" / "director-arc" / "SKILL.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(text + "\n配置 context: fork 模式。\n", encoding="utf-8")

    violations = check_structure.check_business_skill_body(src_root / "skills")
    assert violations, "业务 skill 正文含 'context: fork' 应报告违规"


# ---------------------------------------------------------------------------
# 校验⑤：invoke_blocks
# ---------------------------------------------------------------------------


def test_invoke_blocks_passes_on_clean_build(tmp_path: Path) -> None:
    src_root, _, _ = _build_clean_fixture(tmp_path)
    violations = check_structure.check_invoke_blocks(
        src_workflows=src_root / "workflows",
        src_skills=src_root / "skills",
    )
    assert violations == [], f"clean fixture 应无违规，得到：{violations}"


def test_invoke_blocks_detects_unregistered_skill(tmp_path: Path) -> None:
    """AC5：invoke 块 skill 字段指向不存在的 skill → 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    target = src_root / "workflows" / "new-story.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(
        text + '\n\n```invoke\nskill: nonexistent-skill\nargs: ""\n```\n',
        encoding="utf-8",
    )

    violations = check_structure.check_invoke_blocks(
        src_workflows=src_root / "workflows",
        src_skills=src_root / "skills",
    )
    assert violations, "invoke 块 skill 不存在应报告违规"
    assert any("nonexistent-skill" in v for v in violations), violations


def test_invoke_blocks_detects_missing_skill_field(tmp_path: Path) -> None:
    """invoke 块缺少 skill 字段 → 报错。"""
    src_root, _, _ = _build_clean_fixture(tmp_path)
    target = src_root / "workflows" / "new-story.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(
        text + '\n\n```invoke\nargs: "x"\n```\n',
        encoding="utf-8",
    )

    violations = check_structure.check_invoke_blocks(
        src_workflows=src_root / "workflows",
        src_skills=src_root / "skills",
    )
    assert violations, "invoke 块缺 skill 字段应报告违规"
    assert any("skill" in v for v in violations), violations


def test_invoke_blocks_detects_yaml_parse_error(tmp_path: Path) -> None:
    src_root, _, _ = _build_clean_fixture(tmp_path)
    target = src_root / "workflows" / "new-story.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(
        text + "\n\n```invoke\nskill: foo\n  bad: indent: here\n```\n",
        encoding="utf-8",
    )

    violations = check_structure.check_invoke_blocks(
        src_workflows=src_root / "workflows",
        src_skills=src_root / "skills",
    )
    assert violations, "invoke 块 yaml 解析失败应报告违规"


# ---------------------------------------------------------------------------
# main() smoke 测试
# ---------------------------------------------------------------------------


def test_main_runs_without_crashing_on_real_repo(
    capsys: pytest.CaptureFixture[str],
) -> None:
    """smoke: main() 在真实仓库下应能跑完且不崩溃；
    任意非零退出码必须配套 stderr 上的清晰违规清单。"""
    rc = check_structure.main([])
    captured = capsys.readouterr()
    assert rc in (0, 1), f"main() 应返回 0 或 1，得到 {rc}"
    if rc == 0:
        assert "OK" in captured.out
    else:
        assert "[check-structure]" in captured.err, (
            f"非零退出必须有 stderr 违规说明，得到：{captured.err!r}"
        )


def test_main_returns_nonzero_when_invoke_block_invalid(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """注入违规后 main() 返回非零，stderr 含错误信息。"""
    src_root, claude_root, opencode_root = _build_clean_fixture(tmp_path)

    # 注入一个无效 invoke
    target = src_root / "workflows" / "new-story.md"
    text = target.read_text(encoding="utf-8")
    target.write_text(
        text + '\n\n```invoke\nskill: nonexistent-skill\nargs: ""\n```\n',
        encoding="utf-8",
    )

    monkeypatch.setattr(check_structure, "DEFAULT_SRC_ROOT", src_root)
    monkeypatch.setattr(check_structure, "DEFAULT_CLAUDE_ROOT", claude_root)
    monkeypatch.setattr(check_structure, "DEFAULT_OPENCODE_ROOT", opencode_root)

    # 用 fixture 自己的 config 替代真实 runtime-config.yml
    monkeypatch.setattr(
        check_structure, "load_runtime_config", lambda _path: MIN_CONFIG
    )

    rc = check_structure.main([])
    captured = capsys.readouterr()
    assert rc != 0
    assert "nonexistent-skill" in captured.err
