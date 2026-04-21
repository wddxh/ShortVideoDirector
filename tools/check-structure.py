#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "python-frontmatter>=1.1",
#   "PyYAML>=6.0",
# ]
# ///
"""tools/check-structure.py — 源结构与产物一致性校验器（CI 第 2 层）。

按 ADR-008 / 技术设计 §3.4，本脚本在干净 build 之后 / PR 阶段运行，对源结构
（src/）与双端产物（.claude/、.opencode/）做 5 类校验：

  ① 文件数：两端 5 个产物目录的文件计数与期望一致
  ② frontmatter schema：各类产物 frontmatter 字段集与 §4.4 双端对照表一致
  ③ runtime-config 一致性：agents mapping、workflows 列表与 src/ 实际文件对齐
  ④ 业务 skill 正文 R5：src/skills/<n>/SKILL.md 正文不得残留 Claude 调度关键字
  ⑤ invoke 块：src/workflows/*.md 中所有 ```invoke 块解析正常且 skill 字段有效

退出码：
  0 → 全部通过；stdout 输出 OK + 各类统计
  非 0 → 任一校验失败；stderr 输出违规清单，stdout 不输 OK
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any

import frontmatter
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RUNTIME_CONFIG = REPO_ROOT / "tools" / "runtime-config.yml"
DEFAULT_SRC_ROOT = REPO_ROOT / "src"
DEFAULT_CLAUDE_ROOT = REPO_ROOT / ".claude"
DEFAULT_OPENCODE_ROOT = REPO_ROOT / ".opencode"

# 业务 skill 正文中禁止出现的 Claude 专有调度关键字（R5 风险）。
# 命中即视为业务 skill 正文残留了平台专属措辞，应改写为平台中立表述。
_FORBIDDEN_BODY_KEYWORDS: tuple[str, ...] = (
    "使用 Skill tool",
    "使用 Skill 工具",
    "使用 Agent 工具",
    "$ARGUMENTS[",
    "context: fork",
    "plugin:",
)

# 双端产物 frontmatter 字段 schema（required = 必须出现，optional = 可选）。
_CLAUDE_BUSINESS_SKILL_REQUIRED = frozenset(
    {"name", "description", "user-invocable", "context", "agent"}
)
_CLAUDE_BUSINESS_SKILL_OPTIONAL: frozenset[str] = frozenset()

_OPENCODE_BUSINESS_SKILL_REQUIRED = frozenset({"name", "description"})
_OPENCODE_BUSINESS_SKILL_OPTIONAL: frozenset[str] = frozenset()

_CLAUDE_WORKFLOW_REQUIRED = frozenset(
    {"name", "description", "user-invocable", "allowed-tools"}
)
_CLAUDE_WORKFLOW_OPTIONAL = frozenset({"argument-hint"})

_OPENCODE_COMMAND_REQUIRED = frozenset({"description", "agent", "subtask"})
_OPENCODE_COMMAND_OPTIONAL = frozenset({"argument-hint"})

_OPENCODE_INTERNAL_WORKFLOW_REQUIRED = frozenset({"name", "description"})
_OPENCODE_INTERNAL_WORKFLOW_OPTIONAL: frozenset[str] = frozenset()

_CLAUDE_AGENT_REQUIRED = frozenset({"name", "description", "tools", "model"})
_CLAUDE_AGENT_OPTIONAL: frozenset[str] = frozenset()

_OPENCODE_AGENT_REQUIRED = frozenset({"description", "mode"})
_OPENCODE_AGENT_OPTIONAL: frozenset[str] = frozenset()

_INVOKE_BLOCK_RE = re.compile(r"```invoke\n(.*?)\n```", re.DOTALL)
_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------


def load_runtime_config(path: Path) -> dict[str, Any]:
    """读取 runtime-config.yml。"""
    if not path.exists():
        raise FileNotFoundError(f"runtime config 不存在: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"runtime config 顶层不是 mapping: {path}")
    return data


def _read_frontmatter(path: Path) -> dict[str, Any]:
    """读取 markdown 文件 frontmatter；无 frontmatter 时返回空 dict。"""
    text = path.read_text(encoding="utf-8")
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    data = yaml.safe_load(m.group(1))
    return data if isinstance(data, dict) else {}


def _extract_body(path: Path) -> str:
    """读取 markdown 文件正文（剥离 frontmatter 头）；无 frontmatter 时返回整文。"""
    text = path.read_text(encoding="utf-8")
    return _FRONTMATTER_RE.sub("", text, count=1)


def _src_skill_names(src_root: Path) -> set[str]:
    skills_dir = src_root / "skills"
    if not skills_dir.exists():
        return set()
    return {p.name for p in skills_dir.iterdir() if p.is_dir()}


def _src_workflow_names(src_root: Path) -> set[str]:
    wf_dir = src_root / "workflows"
    if not wf_dir.exists():
        return set()
    return {p.stem for p in wf_dir.iterdir() if p.is_file() and p.suffix == ".md"}


def _src_agent_names(src_root: Path) -> set[str]:
    agents_dir = src_root / "agents"
    if not agents_dir.exists():
        return set()
    return {p.stem for p in agents_dir.iterdir() if p.is_file() and p.suffix == ".md"}


def _check_field_set(
    fm: dict[str, Any],
    required: frozenset[str],
    optional: frozenset[str],
    label: str,
) -> list[str]:
    """对照 required + optional 字段集，返回 (missing / unexpected) 违规清单。"""
    out: list[str] = []
    actual = set(fm.keys())
    missing = required - actual
    extra = actual - required - optional
    if missing:
        out.append(
            f"{label}: 缺少必须字段 {sorted(missing)}（schema 要求 {sorted(required)}）"
        )
    if extra:
        out.append(
            f"{label}: 含禁止字段 {sorted(extra)}"
            f"（仅允许 {sorted(required | optional)}）"
        )
    return out


# ---------------------------------------------------------------------------
# 校验①：file_counts
# ---------------------------------------------------------------------------


def check_file_counts(
    claude_skills: Path,
    opencode_skills: Path,
    opencode_commands: Path,
    claude_agents: Path,
    opencode_agents: Path,
    *,
    expected_claude_skills: int,
    expected_opencode_skills: int,
    expected_opencode_commands: int,
    expected_agents: int,
) -> list[str]:
    """校验两端 5 个产物目录的文件计数。

    判定规则：
      - claude/skills、opencode/skills：count(*/SKILL.md) 应等于期望
      - opencode/commands：count(顶层 *.md) 应等于期望（不数子目录）
      - claude/agents、opencode/agents：count(顶层 *.md) 应等于期望
    """
    violations: list[str] = []

    def _count_skill_md(root: Path) -> int:
        if not root.exists():
            return 0
        return sum(1 for p in root.glob("*/SKILL.md") if p.is_file())

    def _count_top_md(root: Path) -> int:
        if not root.exists():
            return 0
        return sum(1 for p in root.iterdir() if p.is_file() and p.suffix == ".md")

    actual_claude_skills = _count_skill_md(claude_skills)
    if actual_claude_skills != expected_claude_skills:
        violations.append(
            f"file_counts: .claude/skills/ 含 {actual_claude_skills} 个 SKILL.md，"
            f"期望 {expected_claude_skills}（路径: {claude_skills}）"
        )
    actual_opencode_skills = _count_skill_md(opencode_skills)
    if actual_opencode_skills != expected_opencode_skills:
        violations.append(
            f"file_counts: .opencode/skills/ 含 {actual_opencode_skills} 个 SKILL.md，"
            f"期望 {expected_opencode_skills}（路径: {opencode_skills}）"
        )
    actual_opencode_commands = _count_top_md(opencode_commands)
    if actual_opencode_commands != expected_opencode_commands:
        violations.append(
            f"file_counts: .opencode/commands/ 含 {actual_opencode_commands} 个 .md，"
            f"期望 {expected_opencode_commands}（路径: {opencode_commands}）"
        )
    actual_claude_agents = _count_top_md(claude_agents)
    if actual_claude_agents != expected_agents:
        violations.append(
            f"file_counts: .claude/agents/ 含 {actual_claude_agents} 个 .md，"
            f"期望 {expected_agents}（路径: {claude_agents}）"
        )
    actual_opencode_agents = _count_top_md(opencode_agents)
    if actual_opencode_agents != expected_agents:
        violations.append(
            f"file_counts: .opencode/agents/ 含 {actual_opencode_agents} 个 .md，"
            f"期望 {expected_agents}（路径: {opencode_agents}）"
        )
    return violations


# ---------------------------------------------------------------------------
# 校验②：frontmatter_schema
# ---------------------------------------------------------------------------


def check_frontmatter_schema(
    claude_root: Path,
    opencode_root: Path,
    src_root: Path,
    config: dict[str, Any],
) -> list[str]:
    """按 §4.4 双端对照表校验所有产物 frontmatter 字段集。

    分类策略：
      - Claude /.claude/skills/<n>/SKILL.md：根据 src/ 区分业务 skill 与 workflow
      - Claude /.claude/agents/<n>.md：agent
      - opencode /.opencode/skills/<n>/SKILL.md：根据 workflows.internal 区分
      - opencode /.opencode/commands/<n>.md：user_invocable workflow
      - opencode /.opencode/agents/<n>.md：agent
    """
    violations: list[str] = []
    business_skills = _src_skill_names(src_root)
    workflows_cfg = config.get("workflows", {}) or {}
    internal_workflows = set(workflows_cfg.get("internal", []) or [])

    # ---- Claude skills/ 目录（业务 skill + 全部 workflow）----
    claude_skills_dir = claude_root / "skills"
    if claude_skills_dir.exists():
        for skill_dir in sorted(claude_skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            name = skill_dir.name
            fm = _read_frontmatter(skill_md)
            label = f"{skill_md} [claude:{'business_skill' if name in business_skills else 'workflow'}]"
            if name in business_skills:
                violations.extend(
                    _check_field_set(
                        fm,
                        _CLAUDE_BUSINESS_SKILL_REQUIRED,
                        _CLAUDE_BUSINESS_SKILL_OPTIONAL,
                        label,
                    )
                )
            else:
                violations.extend(
                    _check_field_set(
                        fm,
                        _CLAUDE_WORKFLOW_REQUIRED,
                        _CLAUDE_WORKFLOW_OPTIONAL,
                        label,
                    )
                )

    # ---- Claude agents/ ----
    claude_agents_dir = claude_root / "agents"
    if claude_agents_dir.exists():
        for agent_md in sorted(claude_agents_dir.iterdir()):
            if not agent_md.is_file() or agent_md.suffix != ".md":
                continue
            fm = _read_frontmatter(agent_md)
            label = f"{agent_md} [claude:agent]"
            violations.extend(
                _check_field_set(
                    fm, _CLAUDE_AGENT_REQUIRED, _CLAUDE_AGENT_OPTIONAL, label
                )
            )

    # ---- opencode skills/（业务 skill + internal workflow）----
    opencode_skills_dir = opencode_root / "skills"
    if opencode_skills_dir.exists():
        for skill_dir in sorted(opencode_skills_dir.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            name = skill_dir.name
            fm = _read_frontmatter(skill_md)
            if name in business_skills:
                label = f"{skill_md} [opencode:business_skill]"
                violations.extend(
                    _check_field_set(
                        fm,
                        _OPENCODE_BUSINESS_SKILL_REQUIRED,
                        _OPENCODE_BUSINESS_SKILL_OPTIONAL,
                        label,
                    )
                )
            elif name in internal_workflows:
                label = f"{skill_md} [opencode:internal_workflow]"
                violations.extend(
                    _check_field_set(
                        fm,
                        _OPENCODE_INTERNAL_WORKFLOW_REQUIRED,
                        _OPENCODE_INTERNAL_WORKFLOW_OPTIONAL,
                        label,
                    )
                )
            else:
                violations.append(
                    f"frontmatter_schema: opencode skills/ 出现未识别条目 '{name}'"
                    f"（既非业务 skill 也非 internal workflow）；路径: {skill_md}"
                )

    # ---- opencode commands/（user_invocable workflow）----
    opencode_commands_dir = opencode_root / "commands"
    if opencode_commands_dir.exists():
        for cmd_md in sorted(opencode_commands_dir.iterdir()):
            if not cmd_md.is_file() or cmd_md.suffix != ".md":
                continue
            fm = _read_frontmatter(cmd_md)
            label = f"{cmd_md} [opencode:command]"
            violations.extend(
                _check_field_set(
                    fm,
                    _OPENCODE_COMMAND_REQUIRED,
                    _OPENCODE_COMMAND_OPTIONAL,
                    label,
                )
            )

    # ---- opencode agents/ ----
    opencode_agents_dir = opencode_root / "agents"
    if opencode_agents_dir.exists():
        for agent_md in sorted(opencode_agents_dir.iterdir()):
            if not agent_md.is_file() or agent_md.suffix != ".md":
                continue
            fm = _read_frontmatter(agent_md)
            label = f"{agent_md} [opencode:agent]"
            violations.extend(
                _check_field_set(
                    fm, _OPENCODE_AGENT_REQUIRED, _OPENCODE_AGENT_OPTIONAL, label
                )
            )

    return violations


# ---------------------------------------------------------------------------
# 校验③：runtime_config_consistency
# ---------------------------------------------------------------------------


def check_runtime_config_consistency(
    config: dict[str, Any], src_root: Path
) -> list[str]:
    """校验 runtime-config.yml 与 src/ 实际文件的双向一致。

    具体规则：
      - agents.<owner> 列出的所有 skill 名 = src/skills/ 子目录全集（一一对应）
      - workflows.user_invocable + workflows.internal = src/workflows/*.md 全集
      - agents 字典的 keys = src/agents/*.md 文件名（去后缀）全集
      - workflows.opencode_degrade 必须为空 list（auto-video 已通过 sleep-loop
        在两端原生支持，degrade 机制已退役；保留 key 仅为未来扩展）
      - 顶层不得再出现 opencode_degrade_template key（已与 degrade 机制一同退役）
    """
    violations: list[str] = []

    agents_cfg = config.get("agents", {}) or {}
    workflows_cfg = config.get("workflows", {}) or {}

    # opencode_degrade 已退役：列表必须存在且为空，模板 key 必须缺失
    opencode_degrade = workflows_cfg.get("opencode_degrade")
    if opencode_degrade is None:
        violations.append(
            "runtime_config: workflows.opencode_degrade key 缺失"
            "（须保留为空 list 以记录该机制已退役）"
        )
    elif not isinstance(opencode_degrade, list):
        violations.append(
            f"runtime_config: workflows.opencode_degrade 必须是 list（得到 "
            f"{type(opencode_degrade).__name__}）"
        )
    elif opencode_degrade:
        violations.append(
            f"runtime_config: workflows.opencode_degrade 必须为空 list（当前: "
            f"{opencode_degrade}）。auto-video 已通过 in-session sleep-loop "
            f"在两端原生支持，不再需要 degrade 模板。"
        )
    if "opencode_degrade_template" in config:
        violations.append(
            "runtime_config: 顶层不得再出现 opencode_degrade_template key"
            "（已随 degrade 机制一同退役）"
        )

    # 反转 agents → 业务 skill 集合
    declared_skills: set[str] = set()
    for owner, skills in agents_cfg.items():
        if not isinstance(skills, list):
            violations.append(
                f"runtime_config: agents.{owner} 不是 list（得到 {type(skills).__name__}）"
            )
            continue
        for s in skills:
            declared_skills.add(s)

    actual_skills = _src_skill_names(src_root)
    missing_files = declared_skills - actual_skills
    unregistered = actual_skills - declared_skills
    for s in sorted(missing_files):
        violations.append(
            f"runtime_config: agents mapping 声明了业务 skill '{s}'，"
            f"但 src/skills/{s}/SKILL.md 不存在"
        )
    for s in sorted(unregistered):
        violations.append(
            f"runtime_config: src/skills/{s}/ 存在，但未在 runtime-config.yml "
            f"agents.<owner> 列表中注册"
        )

    # workflows
    user_invocable = set(workflows_cfg.get("user_invocable", []) or [])
    internal = set(workflows_cfg.get("internal", []) or [])
    declared_wfs = user_invocable | internal
    actual_wfs = _src_workflow_names(src_root)
    missing_wf_files = declared_wfs - actual_wfs
    unregistered_wfs = actual_wfs - declared_wfs
    for w in sorted(missing_wf_files):
        violations.append(
            f"runtime_config: workflows 声明了 '{w}'，但 src/workflows/{w}.md 不存在"
        )
    for w in sorted(unregistered_wfs):
        violations.append(
            f"runtime_config: src/workflows/{w}.md 存在，但未在 "
            f"runtime-config.yml workflows.user_invocable/internal 中注册"
        )

    # agents（owner 维度）
    declared_owners = set(agents_cfg.keys())
    actual_agents = _src_agent_names(src_root)
    missing_owner_files = declared_owners - actual_agents
    unregistered_agents = actual_agents - declared_owners
    for o in sorted(missing_owner_files):
        violations.append(
            f"runtime_config: agents.{o} 在 mapping 中声明，但 src/agents/{o}.md 不存在"
        )
    for o in sorted(unregistered_agents):
        violations.append(
            f"runtime_config: src/agents/{o}.md 存在，但 runtime-config.yml "
            f"agents 字典缺少对应 key '{o}'"
        )

    return violations


# ---------------------------------------------------------------------------
# 校验④：business_skill_body
# ---------------------------------------------------------------------------


_FENCED_CODE_RE = re.compile(r"```.*?```", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")


def _strip_code_spans(text: str) -> str:
    """去除 markdown 中的 fenced code blocks 与 inline code spans。

    业务 skill 正文常用 inline code 标记 platform-specific 占位符（例如
    `$ARGUMENTS[0]`）来记录工作流契约；这些是文档说明，不是真正的调度残留，
    因此在 R5 关键字扫描前应剥离。
    """
    text = _FENCED_CODE_RE.sub("", text)
    text = _INLINE_CODE_RE.sub("", text)
    return text


def check_business_skill_body(src_skills: Path) -> list[str]:
    """扫描 src/skills/<n>/SKILL.md 正文，命中任一 R5 关键字即报违规。

    扫描前剥离 markdown code blocks / inline code spans —— 这些位置的关键字
    通常是文档（例如展示工作流契约的 `$ARGUMENTS[0]`），不是真正的平台残留。
    """
    violations: list[str] = []
    if not src_skills.exists():
        return violations
    for skill_dir in sorted(src_skills.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        body = _strip_code_spans(_extract_body(skill_md))
        for keyword in _FORBIDDEN_BODY_KEYWORDS:
            if keyword in body:
                violations.append(
                    f"business_skill_body: src/skills/{skill_dir.name}/SKILL.md "
                    f"正文含调度关键字 '{keyword}'（业务 skill 应保持平台中立）；"
                    f"路径: {skill_md}"
                )
    return violations


# ---------------------------------------------------------------------------
# 校验⑤：invoke_blocks
# ---------------------------------------------------------------------------


def check_invoke_blocks(src_workflows: Path, src_skills: Path) -> list[str]:
    """解析 src/workflows/*.md 的所有 ```invoke 块，校验 yaml + skill 字段。

    规则：
      - 块内 yaml 解析失败 → 报错
      - skill 字段缺失或非字符串 → 报错
      - skill 不在业务 skill ∪ workflow 全集 → 报错
    """
    violations: list[str] = []
    if not src_workflows.exists():
        return violations

    business_skills = (
        {p.name for p in src_skills.iterdir() if p.is_dir()}
        if src_skills.exists()
        else set()
    )
    workflow_names = {
        p.stem for p in src_workflows.iterdir() if p.is_file() and p.suffix == ".md"
    }
    valid_targets = business_skills | workflow_names

    for wf_file in sorted(src_workflows.iterdir()):
        if not wf_file.is_file() or wf_file.suffix != ".md":
            continue
        text = wf_file.read_text(encoding="utf-8")
        for m in _INVOKE_BLOCK_RE.finditer(text):
            block_text = m.group(1)
            try:
                parsed = yaml.safe_load(block_text)
            except yaml.YAMLError as e:
                violations.append(
                    f"invoke_blocks: {wf_file} 含 yaml 解析失败的 invoke 块: {e}"
                )
                continue
            if not isinstance(parsed, dict):
                violations.append(
                    f"invoke_blocks: {wf_file} 含 invoke 块顶层非 mapping: {block_text!r}"
                )
                continue
            skill = parsed.get("skill")
            if not isinstance(skill, str) or not skill:
                violations.append(
                    f"invoke_blocks: {wf_file} 含 invoke 块缺少有效 skill 字段: {block_text!r}"
                )
                continue
            if skill not in valid_targets:
                violations.append(
                    f"invoke_blocks: {wf_file} 引用未注册的 skill '{skill}'"
                    f"（不在业务 skill 也不在 workflow 列表中）"
                )
    return violations


# ---------------------------------------------------------------------------
# 期望计数推导（用于 main 调用 check_file_counts）
# ---------------------------------------------------------------------------


def _expected_counts(config: dict[str, Any], src_root: Path) -> tuple[int, int, int, int]:
    """根据 config + src 推导 5 个目录的期望文件数。

    返回 (claude_skills, opencode_skills, opencode_commands, agents)。
      - claude_skills = len(src/skills) + len(src/workflows)
      - opencode_skills = len(src/skills) + len(workflows.internal)
      - opencode_commands = len(workflows.user_invocable)
      - agents = len(src/agents)
    """
    n_skills = len(_src_skill_names(src_root))
    n_workflows = len(_src_workflow_names(src_root))
    workflows_cfg = config.get("workflows", {}) or {}
    n_internal = len(set(workflows_cfg.get("internal", []) or []))
    n_user_invocable = len(set(workflows_cfg.get("user_invocable", []) or []))
    n_agents = len(_src_agent_names(src_root))
    return (
        n_skills + n_workflows,
        n_skills + n_internal,
        n_user_invocable,
        n_agents,
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="check-structure.py",
        description="校验源结构与双端产物 frontmatter / 文件计数 / invoke 块一致性",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="打印每类校验的额外信息",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    config = load_runtime_config(DEFAULT_RUNTIME_CONFIG)
    expected = _expected_counts(config, DEFAULT_SRC_ROOT)

    file_count_violations = check_file_counts(
        claude_skills=DEFAULT_CLAUDE_ROOT / "skills",
        opencode_skills=DEFAULT_OPENCODE_ROOT / "skills",
        opencode_commands=DEFAULT_OPENCODE_ROOT / "commands",
        claude_agents=DEFAULT_CLAUDE_ROOT / "agents",
        opencode_agents=DEFAULT_OPENCODE_ROOT / "agents",
        expected_claude_skills=expected[0],
        expected_opencode_skills=expected[1],
        expected_opencode_commands=expected[2],
        expected_agents=expected[3],
    )
    fm_violations = check_frontmatter_schema(
        claude_root=DEFAULT_CLAUDE_ROOT,
        opencode_root=DEFAULT_OPENCODE_ROOT,
        src_root=DEFAULT_SRC_ROOT,
        config=config,
    )
    rc_violations = check_runtime_config_consistency(
        config=config,
        src_root=DEFAULT_SRC_ROOT,
    )
    body_violations = check_business_skill_body(DEFAULT_SRC_ROOT / "skills")
    invoke_violations = check_invoke_blocks(
        src_workflows=DEFAULT_SRC_ROOT / "workflows",
        src_skills=DEFAULT_SRC_ROOT / "skills",
    )

    all_violations = (
        file_count_violations
        + fm_violations
        + rc_violations
        + body_violations
        + invoke_violations
    )

    if all_violations:
        print("[check-structure] 发现违规：", file=sys.stderr)
        for v in all_violations:
            print(f"  - {v}", file=sys.stderr)
        print(
            f"[check-structure] 共 {len(all_violations)} 条违规；"
            f"file_counts={len(file_count_violations)} "
            f"frontmatter={len(fm_violations)} "
            f"runtime_config={len(rc_violations)} "
            f"business_body={len(body_violations)} "
            f"invoke={len(invoke_violations)}",
            file=sys.stderr,
        )
        return 1

    print("OK")
    print(
        f"file_counts: OK ({expected[0]} / {expected[1]} / {expected[2]} / "
        f"{expected[3]} / {expected[3]})"
    )
    print("frontmatter_schema: OK")
    print("runtime_config_consistency: OK")
    print("business_skill_body: OK")
    print("invoke_blocks: OK")
    if args.verbose:
        print(
            f"[verbose] 期望计数：claude/skills={expected[0]} "
            f"opencode/skills={expected[1]} opencode/commands={expected[2]} "
            f"agents={expected[3]}"
        )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (FileNotFoundError, ValueError) as exc:
        print(f"[check-structure:error] {exc}", file=sys.stderr)
        sys.exit(1)
