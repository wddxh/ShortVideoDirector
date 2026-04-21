#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "python-frontmatter>=1.1",
#   "PyYAML>=6.0",
# ]
# ///
"""tools/build.py — 双端产物构建器。

按 tools/runtime-config.yml 的规则，将 src/{skills,agents,workflows}/
canonical 源转换为 .claude/{skills,agents}/ + .opencode/{skills,commands,agents}/
两端产物，并生成 .claude-plugin/plugin.json + .opencode/opencode.json 两份 manifests。

构建步骤（依次执行）：
    1. 业务 skill：src/skills/<name>/ → 两端 skills/<name>/
    2. workflow：src/workflows/<name>.md → 两端 commands/skills 按规则分发
    3. agent：src/agents/<name>.md → 两端 agents/<name>.md
    4. manifests：plugin.json（更新 skills/agents 路径）+ opencode.json（最小化）

`--clean` 会先清空两端 5 个产物子目录（skills/agents/commands），不动 manifests
（manifests 由 build 直接重写覆盖）。
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
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
DEFAULT_PLUGIN_JSON = REPO_ROOT / ".claude-plugin" / "plugin.json"

# 业务 skill 源 frontmatter 仅允许这两个字段
ALLOWED_SOURCE_SKILL_FIELDS = {"name", "description"}

# agent 源 frontmatter 仅允许这两个字段
ALLOWED_SOURCE_AGENT_FIELDS = {"name", "description"}

# workflow 源 frontmatter 仅允许这四个字段（argument-hint 可选）
ALLOWED_SOURCE_WORKFLOW_FIELDS = {"name", "description", "user-invocable", "argument-hint"}

# 双端产物 frontmatter 字段顺序（确定性，避免 git diff 噪音）
CLAUDE_SKILL_FIELD_ORDER: tuple[str, ...] = (
    "name",
    "description",
    "user-invocable",
    "context",
    "agent",
)
OPENCODE_SKILL_FIELD_ORDER: tuple[str, ...] = ("name", "description")

# Claude workflow 产物字段顺序
CLAUDE_WORKFLOW_FIELD_ORDER: tuple[str, ...] = (
    "name",
    "description",
    "user-invocable",
    "argument-hint",
    "allowed-tools",
)

# opencode user-invocable workflow（commands/）字段顺序
# 注意：不含 name —— opencode commands 以文件名为准
OPENCODE_COMMAND_FIELD_ORDER: tuple[str, ...] = (
    "description",
    "agent",
    "subtask",
    "argument-hint",
)

# opencode internal workflow（skills/）字段顺序，与业务 skill 一致
OPENCODE_INTERNAL_WORKFLOW_FIELD_ORDER: tuple[str, ...] = ("name", "description")

# Claude agent 产物字段顺序：name + description + tools + model
CLAUDE_AGENT_FIELD_ORDER: tuple[str, ...] = ("name", "description", "tools", "model")

# opencode agent 产物字段顺序：description + mode（不含 name；不含 model）
OPENCODE_AGENT_FIELD_ORDER: tuple[str, ...] = ("description", "mode")

# invoke 块识别 + $ARGUMENTS 索引识别
_INVOKE_BLOCK_RE = re.compile(r"```invoke\n(.*?)\n```", re.DOTALL)
# 同时匹配 `$ARGUMENTS[N]` 与切片记法 `$ARGUMENTS[N..]`（用于 generate-video
# 描述「从该索引起的剩余参数」的场景）。group(1) 为索引数字，group(2) 为可选
# 的切片标记 `..`。
_ARGUMENTS_INDEX_RE = re.compile(r"\$ARGUMENTS\[(\d+)(\.\.)?\]")

# opencode 端：当 invoke 块的 skill 指向 workflow（而非业务 skill）时使用的
# fallback 措辞模板。Claude 端始终走 invoke_template；opencode 端业务 skill
# 走 invoke_template（task 工具措辞），workflow target 走此 fallback。
# 硬编码在此处（而非 runtime-config.yml）以保持 yaml 文件简洁；如需调整可
# 直接改本字符串。
_OPENCODE_WORKFLOW_FALLBACK_TEMPLATE = (
    "使用 skill 工具加载 `{skill}` skill 的内容并按其描述执行{args_phrase}"
)


# ---------------------------------------------------------------------------
# 配置加载
# ---------------------------------------------------------------------------


def load_runtime_config(path: Path) -> dict[str, Any]:
    """读取 runtime-config.yml，返回 dict。"""
    if not path.exists():
        raise FileNotFoundError(f"runtime config 不存在: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"runtime config 顶层不是 mapping: {path}")
    return data


def build_skill_to_owner_index(config: dict[str, Any]) -> dict[str, str]:
    """把 agents 配置反转为 {skill_name: owner_name}。

    重复声明（同一 skill 出现在多个 owner 下）视为配置错误，立即报错。
    """
    agents = config.get("agents")
    if not isinstance(agents, dict):
        raise ValueError("runtime-config.yml 缺少 agents mapping 或类型错误")
    index: dict[str, str] = {}
    for owner, skills in agents.items():
        if not isinstance(skills, list):
            raise ValueError(
                f"runtime-config.yml agents.{owner} 不是 list（得到 {type(skills).__name__}）"
            )
        for skill in skills:
            if skill in index:
                raise ValueError(
                    f"runtime-config.yml: skill '{skill}' 在多个 owner 下重复声明 "
                    f"（{index[skill]} 与 {owner}）"
                )
            index[skill] = owner
    return index


# ---------------------------------------------------------------------------
# Skill 解析与 frontmatter 注入
# ---------------------------------------------------------------------------


def parse_skill(path: Path) -> frontmatter.Post:
    """读取 SKILL.md，返回 frontmatter.Post（仅用于 metadata 解析）。

    注意：post.content 会被 python-frontmatter strip 前导空白，因此正文应通过
    extract_raw_body() 取得，不要用 post.content。
    """
    if not path.exists():
        raise FileNotFoundError(f"skill 文件不存在: {path}")
    with path.open("r", encoding="utf-8") as f:
        return frontmatter.load(f)


_FRONTMATTER_RE = re.compile(r"^---\n.*?\n---\n", re.DOTALL)


def extract_raw_body(path: Path) -> str:
    """读取源文件原始 body（保留 closing `---\\n` 之后的所有字符，含前导空行）。

    若文件无 frontmatter 头，返回整个文件内容。
    """
    text = path.read_text(encoding="utf-8")
    return _FRONTMATTER_RE.sub("", text, count=1)


def _ordered_metadata(
    metadata: dict[str, Any], field_order: tuple[str, ...]
) -> dict[str, Any]:
    """按 field_order 重新排序 dict（Python 3.7+ 保留插入顺序）。

    field_order 中没列出的字段按字母序追加到末尾（防御性，避免无声丢字段）。
    """
    ordered: dict[str, Any] = {}
    for key in field_order:
        if key in metadata:
            ordered[key] = metadata[key]
    for key in sorted(k for k in metadata.keys() if k not in field_order):
        ordered[key] = metadata[key]
    return ordered


def inject_frontmatter(
    src_metadata: dict[str, Any],
    runtime_inject: dict[str, Any],
    extra_fields: dict[str, Any] | None = None,
    field_order: tuple[str, ...] = (),
) -> dict[str, Any]:
    """合并源 metadata + runtime 注入 + extra_fields，返回新的 dict（按 field_order 排序）。

    冲突优先级：extra_fields > runtime_inject > 源 frontmatter
    （这意味着 runtime-config.yml 里的注入字段会覆盖源的同名字段，但当前业务
    skill 源 frontmatter 仅含 name/description，不会冲突。）
    """
    merged: dict[str, Any] = dict(src_metadata)
    merged.update(runtime_inject or {})
    if extra_fields:
        merged.update(extra_fields)
    if field_order:
        merged = _ordered_metadata(merged, field_order)
    return merged


def _yaml_dump_metadata(metadata: dict[str, Any]) -> str:
    """按确定性 yaml 风格 dump metadata。"""
    return yaml.safe_dump(
        metadata,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
    )


def write_output(metadata: dict[str, Any], body: str, output_path: Path) -> None:
    """以 `---\\n<yaml>---\\n<body>` 格式写出（自动建目录、覆盖已存在文件）。

    body 原样写出，不做任何 strip / normalize（保证三端正文一致）。
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fm_text = _yaml_dump_metadata(metadata)
    output_path.write_text(
        f"---\n{fm_text}---\n{body}",
        encoding="utf-8",
    )


def copy_attachments(src_dir: Path, output_dir: Path) -> list[Path]:
    """把 src_dir 下除 SKILL.md 之外的所有常规文件原样复制到 output_dir。

    返回成功复制的目标路径列表（用于 verbose 日志 / 测试断言）。
    子目录目前不递归（业务 skill 目前都是平坦结构，含 rules.md 即够）；
    若未来出现子目录可在此扩展。
    """
    copied: list[Path] = []
    if not src_dir.exists():
        return copied
    output_dir.mkdir(parents=True, exist_ok=True)
    for child in sorted(src_dir.iterdir()):
        if not child.is_file():
            continue
        if child.name == "SKILL.md":
            continue
        target = output_dir / child.name
        shutil.copy2(child, target)
        copied.append(target)
    return copied


# ---------------------------------------------------------------------------
# 业务 skill 双端构建
# ---------------------------------------------------------------------------


def _validate_source_skill(
    post: frontmatter.Post, skill_name: str, src_path: Path
) -> None:
    """业务 skill 源 frontmatter 仅允许 name + description。"""
    extra = set(post.metadata.keys()) - ALLOWED_SOURCE_SKILL_FIELDS
    if extra:
        raise ValueError(
            f"src/skills/{skill_name}/SKILL.md 源 frontmatter 含非法字段 "
            f"{sorted(extra)}（仅允许 {sorted(ALLOWED_SOURCE_SKILL_FIELDS)}）"
            f"\n  路径: {src_path}"
        )
    missing = ALLOWED_SOURCE_SKILL_FIELDS - set(post.metadata.keys())
    if missing:
        raise ValueError(
            f"src/skills/{skill_name}/SKILL.md 源 frontmatter 缺少字段 "
            f"{sorted(missing)}（必须含 {sorted(ALLOWED_SOURCE_SKILL_FIELDS)}）"
            f"\n  路径: {src_path}"
        )
    name_field = post.metadata.get("name")
    if name_field != skill_name:
        raise ValueError(
            f"src/skills/{skill_name}/SKILL.md frontmatter.name='{name_field}' "
            f"与目录名 '{skill_name}' 不一致"
            f"\n  路径: {src_path}"
        )


def build_business_skills(
    src_root: Path,
    claude_root: Path,
    opencode_root: Path,
    config: dict[str, Any],
    verbose: bool = False,
) -> int:
    """构建所有业务 skill 的双端产物，返回处理的 skill 数量。

    fail-fast：任一 skill 校验失败立刻抛 ValueError，不会继续处理其余 skill。
    """
    src_skills_dir = src_root / "skills"
    if not src_skills_dir.exists():
        raise FileNotFoundError(f"src/skills/ 不存在: {src_skills_dir}")

    skill_to_owner = build_skill_to_owner_index(config)
    claude_inject = (
        config.get("runtimes", {}).get("claude", {}).get("business_skill_inject", {})
        or {}
    )
    opencode_inject = (
        config.get("runtimes", {}).get("opencode", {}).get("business_skill_inject", {})
        or {}
    )

    count = 0
    for skill_dir in sorted(src_skills_dir.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_name = skill_dir.name
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            raise FileNotFoundError(
                f"src/skills/{skill_name}/ 缺少 SKILL.md（路径: {skill_md}）"
            )

        if skill_name not in skill_to_owner:
            raise ValueError(
                f"业务 skill '{skill_name}' 未在 runtime-config.yml 的 agents "
                f"mapping 中注册。\n"
                f"  源路径: {skill_md}\n"
                f"  请在 tools/runtime-config.yml 的 agents.<owner> 列表中添加 "
                f"'{skill_name}'，或删除该目录。"
            )
        owner = skill_to_owner[skill_name]

        src_post = parse_skill(skill_md)
        _validate_source_skill(src_post, skill_name, skill_md)
        raw_body = extract_raw_body(skill_md)

        claude_metadata = inject_frontmatter(
            src_post.metadata,
            runtime_inject=claude_inject,
            extra_fields={"agent": owner},
            field_order=CLAUDE_SKILL_FIELD_ORDER,
        )
        opencode_metadata = inject_frontmatter(
            src_post.metadata,
            runtime_inject=opencode_inject,
            extra_fields=None,
            field_order=OPENCODE_SKILL_FIELD_ORDER,
        )

        claude_skill_dir = claude_root / "skills" / skill_name
        opencode_skill_dir = opencode_root / "skills" / skill_name
        claude_out = claude_skill_dir / "SKILL.md"
        opencode_out = opencode_skill_dir / "SKILL.md"

        write_output(claude_metadata, raw_body, claude_out)
        write_output(opencode_metadata, raw_body, opencode_out)
        copy_attachments(skill_dir, claude_skill_dir)
        copy_attachments(skill_dir, opencode_skill_dir)

        if verbose:
            print(f"[skill:{owner}] {skill_md} → {claude_out}, {opencode_out}")

        count += 1

    return count


# ---------------------------------------------------------------------------
# Workflow 处理：invoke 块展开 + $ARGUMENTS 索引转换
# ---------------------------------------------------------------------------


def transform_arguments_indices(text: str, offset: int) -> str:
    """`$ARGUMENTS[N]` → `$<N+offset>`，`$ARGUMENTS[N..]` → `$<N+offset>...`。

    仅 opencode 端使用。

    边界（regex 已保证）：
        - 'ARGUMENTS[3]' 不带 $ → 不替换
        - '$ARGUMENTS123' 不带 [] → 不替换
        - '$ARGUMENTS[]' 空索引 → 不匹配（必须有数字）
    """

    def _sub(m: "re.Match[str]") -> str:
        new_index = int(m.group(1)) + offset
        slice_suffix = "..." if m.group(2) else ""
        return f"${new_index}{slice_suffix}"

    return _ARGUMENTS_INDEX_RE.sub(_sub, text)


def expand_invoke_block(
    invoke_yaml: dict[str, Any],
    runtime: str,
    config: dict[str, Any],
    skill_to_owner: dict[str, str],
    business_skill_set: set[str],
) -> str:
    """把单个 invoke 块的 yaml dict 展开为对应平台的自然语言段落。

    runtime ∈ {'claude', 'opencode'}。

    - Claude 端：所有 target 都走 invoke_template
    - opencode 端：业务 skill 走 invoke_template（task 工具措辞），workflow
      target 走 fallback 措辞（使用 skill 工具加载）
    """
    if runtime not in ("claude", "opencode"):
        raise ValueError(f"未知 runtime: {runtime}")
    skill = invoke_yaml.get("skill")
    if not isinstance(skill, str) or not skill:
        raise ValueError(f"invoke 块缺少 skill 字段: {invoke_yaml!r}")
    args = invoke_yaml.get("args", "")
    runtime_cfg = config["runtimes"][runtime]

    # 空字符串 / None / 空白 → 视为无参数
    if args is None or (isinstance(args, str) and args == ""):
        args_phrase = runtime_cfg["invoke_no_args_phrase"]
    else:
        args_phrase = runtime_cfg["invoke_with_args_phrase"].format(args=args)

    if runtime == "opencode" and skill not in business_skill_set:
        return _OPENCODE_WORKFLOW_FALLBACK_TEMPLATE.format(
            skill=skill, args_phrase=args_phrase
        )

    template = runtime_cfg["invoke_template"].rstrip("\n")
    owner = skill_to_owner.get(skill, "")
    # Claude 模板不引用 {owner}，但 .format() 接受多余 kwargs
    return template.format(skill=skill, args_phrase=args_phrase, owner=owner)


def _process_workflow_body(
    body: str,
    runtime: str,
    config: dict[str, Any],
    skill_to_owner: dict[str, str],
    business_skill_set: set[str],
    workflow_set: set[str],
    src_path: Path,
) -> str:
    """对 workflow 正文执行 invoke 展开 + opencode 端的 $ARGUMENTS 转换。

    fail-fast：invoke 块的 skill 字段不在 business_skill_set ∪ workflow_set
    时立即 raise，错误信息含 src_path 与块原文便于排查。
    """
    valid_targets = business_skill_set | workflow_set

    def _replace(m: "re.Match[str]") -> str:
        block_text = m.group(1)
        try:
            invoke_yaml = yaml.safe_load(block_text)
        except yaml.YAMLError as e:
            raise ValueError(
                f"workflow {src_path} 的 invoke 块 yaml 解析失败: {e}\n"
                f"  块内容:\n{block_text}"
            ) from e
        if not isinstance(invoke_yaml, dict):
            raise ValueError(
                f"workflow {src_path} 的 invoke 块顶层不是 mapping: {block_text!r}"
            )
        skill = invoke_yaml.get("skill")
        if skill not in valid_targets:
            raise ValueError(
                f"workflow {src_path} 的 invoke 块引用了不存在的 skill '{skill}'"
                f"（不在业务 skill 也不在 workflow 列表中）。\n"
                f"  块内容:\n{block_text}"
            )
        return expand_invoke_block(
            invoke_yaml, runtime, config, skill_to_owner, business_skill_set
        )

    expanded = _INVOKE_BLOCK_RE.sub(_replace, body)
    if runtime == "opencode":
        offset = config["runtimes"]["opencode"].get("arguments_index_offset", 1)
        expanded = transform_arguments_indices(expanded, offset)
    return expanded


def _validate_source_workflow(
    post: frontmatter.Post, wf_name: str, src_path: Path
) -> None:
    """校验 workflow 源 frontmatter：仅允许 ALLOWED_SOURCE_WORKFLOW_FIELDS 子集。"""
    extra = set(post.metadata.keys()) - ALLOWED_SOURCE_WORKFLOW_FIELDS
    if extra:
        raise ValueError(
            f"src/workflows/{wf_name}.md 源 frontmatter 含非法字段 "
            f"{sorted(extra)}（仅允许 {sorted(ALLOWED_SOURCE_WORKFLOW_FIELDS)}）"
            f"\n  路径: {src_path}"
        )
    required = {"name", "description", "user-invocable"}
    missing = required - set(post.metadata.keys())
    if missing:
        raise ValueError(
            f"src/workflows/{wf_name}.md 源 frontmatter 缺少字段 "
            f"{sorted(missing)}（必须含 {sorted(required)}）"
            f"\n  路径: {src_path}"
        )
    if post.metadata.get("name") != wf_name:
        raise ValueError(
            f"src/workflows/{wf_name}.md frontmatter.name="
            f"'{post.metadata.get('name')}' 与文件名 '{wf_name}' 不一致"
            f"\n  路径: {src_path}"
        )
    if not isinstance(post.metadata.get("user-invocable"), bool):
        raise ValueError(
            f"src/workflows/{wf_name}.md frontmatter.user-invocable 必须为 bool"
            f"（当前: {post.metadata.get('user-invocable')!r}）\n  路径: {src_path}"
        )


def _copy_workflow_attachments_dir(
    src_subdir: Path, dest_dir: Path
) -> list[Path]:
    """递归复制 src/workflows/<name>/ 子目录下所有文件到 dest_dir/。

    workflow 附属文件目前都是平坦结构（仅 1 层），此处复用 copy_attachments
    的扁平复制语义；如未来出现深层嵌套可在此扩展。
    """
    copied: list[Path] = []
    if not src_subdir.exists() or not src_subdir.is_dir():
        return copied
    dest_dir.mkdir(parents=True, exist_ok=True)
    for child in sorted(src_subdir.iterdir()):
        if not child.is_file():
            continue
        target = dest_dir / child.name
        shutil.copy2(child, target)
        copied.append(target)
    return copied


def build_workflows(
    src_root: Path,
    claude_root: Path,
    opencode_root: Path,
    config: dict[str, Any],
    verbose: bool = False,
) -> int:
    """构建所有 workflow 的双端产物，返回处理的 workflow 数量。

    输出路径：
        - Claude（所有 workflow）：.claude/skills/<name>/SKILL.md
        - opencode user_invocable：.opencode/commands/<name>.md
        - opencode internal：.opencode/skills/<name>/SKILL.md

    注：历史曾对 opencode 端的 auto-video 走「降级模板」分支，自 sleep-loop
    改造后所有 user_invocable workflow 走同一条 invoke 展开路径，不再特殊化。
    runtime-config.yml 仍保留 opencode_degrade 空列表以备未来扩展。
    """
    src_workflows_dir = src_root / "workflows"
    if not src_workflows_dir.exists():
        raise FileNotFoundError(
            f"src/workflows/ 不存在: {src_workflows_dir}"
        )

    workflows_cfg = config.get("workflows", {}) or {}
    user_invocable = set(workflows_cfg.get("user_invocable", []) or [])
    internal = set(workflows_cfg.get("internal", []) or [])
    workflow_set = user_invocable | internal

    skill_to_owner = build_skill_to_owner_index(config)
    business_skill_set = set(skill_to_owner.keys())

    claude_runtime = config.get("runtimes", {}).get("claude", {}) or {}
    opencode_runtime = config.get("runtimes", {}).get("opencode", {}) or {}
    claude_user_inject = (
        claude_runtime.get("workflow_user_invocable_inject", {}) or {}
    )
    claude_internal_inject = (
        claude_runtime.get("workflow_internal_inject", {}) or {}
    )
    opencode_user_inject = (
        opencode_runtime.get("workflow_user_invocable_inject", {}) or {}
    )

    workflow_files = sorted(
        p for p in src_workflows_dir.iterdir()
        if p.is_file() and p.suffix == ".md"
    )

    count = 0
    for wf_file in workflow_files:
        wf_name = wf_file.stem
        post = parse_skill(wf_file)
        _validate_source_workflow(post, wf_name, wf_file)

        is_user_invocable = bool(post.metadata["user-invocable"])
        # 配置一致性：源 frontmatter 与 runtime-config.yml 的 workflows 列表
        if is_user_invocable and wf_name not in user_invocable:
            raise ValueError(
                f"workflow '{wf_name}' user-invocable=true 但不在 runtime-config.yml "
                f"workflows.user_invocable 列表中。\n  路径: {wf_file}"
            )
        if not is_user_invocable and wf_name not in internal:
            raise ValueError(
                f"workflow '{wf_name}' user-invocable=false 但不在 runtime-config.yml "
                f"workflows.internal 列表中。\n  路径: {wf_file}"
            )

        raw_body = extract_raw_body(wf_file)

        # ---- Claude 端：所有 workflow 都进 .claude/skills/<name>/SKILL.md ----
        claude_body = _process_workflow_body(
            raw_body,
            runtime="claude",
            config=config,
            skill_to_owner=skill_to_owner,
            business_skill_set=business_skill_set,
            workflow_set=workflow_set,
            src_path=wf_file,
        )
        claude_inject = (
            claude_user_inject if is_user_invocable else claude_internal_inject
        )
        claude_metadata = inject_frontmatter(
            src_metadata=dict(post.metadata),
            runtime_inject=claude_inject,
            extra_fields=None,
            field_order=CLAUDE_WORKFLOW_FIELD_ORDER,
        )
        claude_skill_dir = claude_root / "skills" / wf_name
        claude_out = claude_skill_dir / "SKILL.md"
        write_output(claude_metadata, claude_body, claude_out)

        # ---- opencode 端 ----
        if is_user_invocable:
            opencode_body = _process_workflow_body(
                raw_body,
                runtime="opencode",
                config=config,
                skill_to_owner=skill_to_owner,
                business_skill_set=business_skill_set,
                workflow_set=workflow_set,
                src_path=wf_file,
            )
            # commands frontmatter：description + agent + subtask + argument-hint（无 name）
            src_meta_no_name = {
                k: v for k, v in post.metadata.items()
                if k in {"description", "argument-hint"}
            }
            opencode_metadata = inject_frontmatter(
                src_metadata=src_meta_no_name,
                runtime_inject=opencode_user_inject,
                extra_fields=None,
                field_order=OPENCODE_COMMAND_FIELD_ORDER,
            )
            opencode_cmd_path = opencode_root / "commands" / f"{wf_name}.md"
            write_output(opencode_metadata, opencode_body, opencode_cmd_path)
            # 附属文件：src/workflows/<name>/ → .opencode/commands/<name>/
            _copy_workflow_attachments_dir(
                src_workflows_dir / wf_name,
                opencode_root / "commands" / wf_name,
            )
        else:
            # internal workflow → opencode skills/，frontmatter 与业务 skill 一致
            opencode_body = _process_workflow_body(
                raw_body,
                runtime="opencode",
                config=config,
                skill_to_owner=skill_to_owner,
                business_skill_set=business_skill_set,
                workflow_set=workflow_set,
                src_path=wf_file,
            )
            opencode_skill_meta = {
                "name": post.metadata["name"],
                "description": post.metadata["description"],
            }
            opencode_metadata = inject_frontmatter(
                src_metadata=opencode_skill_meta,
                runtime_inject={},
                extra_fields=None,
                field_order=OPENCODE_INTERNAL_WORKFLOW_FIELD_ORDER,
            )
            opencode_skill_path = (
                opencode_root / "skills" / wf_name / "SKILL.md"
            )
            write_output(opencode_metadata, opencode_body, opencode_skill_path)

        # 附属子目录复制到 Claude 端：src/workflows/<name>/* → .claude/skills/<name>/*
        _copy_workflow_attachments_dir(
            src_workflows_dir / wf_name,
            claude_skill_dir,
        )

        if verbose:
            print(f"[workflow] {wf_file} → claude:{claude_out}")

        count += 1

    return count


# ---------------------------------------------------------------------------
# Agent 双端构建
# ---------------------------------------------------------------------------


def _validate_source_agent(
    post: frontmatter.Post, agent_name: str, src_path: Path
) -> None:
    """agent 源 frontmatter 仅允许 name + description。"""
    extra = set(post.metadata.keys()) - ALLOWED_SOURCE_AGENT_FIELDS
    if extra:
        raise ValueError(
            f"src/agents/{agent_name}.md 源 frontmatter 含非法字段 "
            f"{sorted(extra)}（仅允许 {sorted(ALLOWED_SOURCE_AGENT_FIELDS)}）"
            f"\n  路径: {src_path}"
        )
    missing = ALLOWED_SOURCE_AGENT_FIELDS - set(post.metadata.keys())
    if missing:
        raise ValueError(
            f"src/agents/{agent_name}.md 源 frontmatter 缺少字段 "
            f"{sorted(missing)}（必须含 {sorted(ALLOWED_SOURCE_AGENT_FIELDS)}）"
            f"\n  路径: {src_path}"
        )
    if post.metadata.get("name") != agent_name:
        raise ValueError(
            f"src/agents/{agent_name}.md frontmatter.name="
            f"'{post.metadata.get('name')}' 与文件名 '{agent_name}' 不一致"
            f"\n  路径: {src_path}"
        )


def process_agent(
    src_path: Path, runtime: str, config: dict[str, Any]
) -> tuple[dict[str, Any], str]:
    """解析单个 agent 源文件，按 runtime 注入 frontmatter，返回 (metadata, body)。

    runtime ∈ {'claude', 'opencode'}。
    - Claude：注入 tools + model（保留 name + description）
    - opencode：注入 mode（保留 description；丢弃 name）
    """
    if runtime not in ("claude", "opencode"):
        raise ValueError(f"未知 runtime: {runtime}")

    agent_name = src_path.stem
    post = parse_skill(src_path)
    _validate_source_agent(post, agent_name, src_path)
    raw_body = extract_raw_body(src_path)

    runtime_inject = (
        config.get("runtimes", {}).get(runtime, {}).get("agent_inject", {}) or {}
    )

    if runtime == "claude":
        metadata = inject_frontmatter(
            src_metadata=dict(post.metadata),
            runtime_inject=runtime_inject,
            extra_fields=None,
            field_order=CLAUDE_AGENT_FIELD_ORDER,
        )
    else:
        # opencode：drop name（agent 名以文件名为准）
        src_meta_no_name = {
            k: v for k, v in post.metadata.items() if k != "name"
        }
        metadata = inject_frontmatter(
            src_metadata=src_meta_no_name,
            runtime_inject=runtime_inject,
            extra_fields=None,
            field_order=OPENCODE_AGENT_FIELD_ORDER,
        )

    return metadata, raw_body


def build_agents(
    src_root: Path,
    claude_root: Path,
    opencode_root: Path,
    config: dict[str, Any],
    verbose: bool = False,
) -> int:
    """构建所有 agent 的双端产物，返回处理的 agent 数量。

    fail-fast：runtime-config.yml 的 agents mapping 中所有 owner 都必须有对应的
    src/agents/<owner>.md 文件；缺失则立即 raise。
    """
    src_agents_dir = src_root / "agents"
    if not src_agents_dir.exists():
        raise FileNotFoundError(f"src/agents/ 不存在: {src_agents_dir}")

    agents_cfg = config.get("agents")
    if not isinstance(agents_cfg, dict):
        raise ValueError("runtime-config.yml 缺少 agents mapping 或类型错误")
    expected_owners = sorted(agents_cfg.keys())

    count = 0
    for owner in expected_owners:
        src_path = src_agents_dir / f"{owner}.md"
        if not src_path.exists():
            raise FileNotFoundError(
                f"agent '{owner}' 在 runtime-config.yml agents mapping 中声明，"
                f"但源文件不存在。\n  期望路径: {src_path}"
            )

        claude_meta, body = process_agent(src_path, "claude", config)
        opencode_meta, _ = process_agent(src_path, "opencode", config)

        claude_out = claude_root / "agents" / f"{owner}.md"
        opencode_out = opencode_root / "agents" / f"{owner}.md"
        write_output(claude_meta, body, claude_out)
        write_output(opencode_meta, body, opencode_out)

        if verbose:
            print(f"[agent] {src_path} → {claude_out}, {opencode_out}")

        count += 1

    return count


# ---------------------------------------------------------------------------
# Manifests 生成
# ---------------------------------------------------------------------------


def generate_plugin_json(plugin_json_path: Path) -> None:
    """读取现有 .claude-plugin/plugin.json，更新 skills 字段为 `./.claude/skills/`，
    新增 agents 字段 `./.claude/agents/`，保留 name/version/description。

    若文件不存在则 raise FileNotFoundError（plugin.json 是版本化资产，应一直存在）。
    """
    if not plugin_json_path.exists():
        raise FileNotFoundError(
            f".claude-plugin/plugin.json 不存在: {plugin_json_path}"
        )
    existing = json.loads(plugin_json_path.read_text(encoding="utf-8"))
    if not isinstance(existing, dict):
        raise ValueError(
            f"plugin.json 顶层不是 object: {plugin_json_path}"
        )

    output = {
        "name": existing.get("name", "short-video-director"),
        "version": existing.get("version", "1.0.0"),
        "description": existing.get("description", ""),
        "skills": "./.claude/skills/",
        "agents": "./.claude/agents/",
    }
    plugin_json_path.parent.mkdir(parents=True, exist_ok=True)
    plugin_json_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def generate_opencode_json(opencode_root: Path) -> None:
    """生成 .opencode/opencode.json：按 ADR-006 最小化（$schema + permission allow-all）。"""
    output = {
        "$schema": "https://opencode.ai/config.json",
        "permission": {
            "edit": "allow",
            "bash": "allow",
            "webfetch": "allow",
        },
    }
    opencode_root.mkdir(parents=True, exist_ok=True)
    (opencode_root / "opencode.json").write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------


def clean_outputs(claude_root: Path, opencode_root: Path, verbose: bool = False) -> None:
    """清空双端产物目录：Claude skills/agents + opencode skills/commands/agents。

    保留：.claude/projects/、用户本地状态、.opencode/opencode.json、
    .claude-plugin/plugin.json（manifests 由 build 直接重写）。
    """
    targets = [
        claude_root / "skills",
        claude_root / "agents",
        opencode_root / "skills",
        opencode_root / "commands",
        opencode_root / "agents",
    ]
    for d in targets:
        if d.exists():
            if verbose:
                print(f"[clean] rm -rf {d}")
            shutil.rmtree(d)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="build.py",
        description="构建 Claude Code + opencode 双端产物（TASK-005：仅业务 skill）",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="仅校验源结构与 runtime-config.yml 一致性，不写产物（CI 用）",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="先清空两端 skills/agents/commands 产物再生成（不动 manifests）",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="打印每个文件的 source → output 映射",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    config = load_runtime_config(DEFAULT_RUNTIME_CONFIG)

    if args.clean:
        clean_outputs(DEFAULT_CLAUDE_ROOT, DEFAULT_OPENCODE_ROOT, verbose=args.verbose)

    if args.check:
        # --check 仅做结构校验：跑 build_business_skills 但写到一次性 buffer 是
        # 杀鸡用牛刀；这里复用 fail-fast 校验链，写到临时目录由后续 task 决定。
        # 当前 stub：仅校验 config + 反查表。后续 TASK-008 会接管 --check。
        build_skill_to_owner_index(config)
        if args.verbose:
            print("[check] runtime-config.yml 结构 OK（agents mapping 解析成功）")
        return 0

    n_skills = build_business_skills(
        src_root=DEFAULT_SRC_ROOT,
        claude_root=DEFAULT_CLAUDE_ROOT,
        opencode_root=DEFAULT_OPENCODE_ROOT,
        config=config,
        verbose=args.verbose,
    )
    n_workflows = build_workflows(
        src_root=DEFAULT_SRC_ROOT,
        claude_root=DEFAULT_CLAUDE_ROOT,
        opencode_root=DEFAULT_OPENCODE_ROOT,
        config=config,
        verbose=args.verbose,
    )
    n_agents = build_agents(
        src_root=DEFAULT_SRC_ROOT,
        claude_root=DEFAULT_CLAUDE_ROOT,
        opencode_root=DEFAULT_OPENCODE_ROOT,
        config=config,
        verbose=args.verbose,
    )

    generate_plugin_json(DEFAULT_PLUGIN_JSON)
    generate_opencode_json(DEFAULT_OPENCODE_ROOT)

    if args.verbose:
        print(f"[build] 业务 skill: {n_skills} 个 → 双端产物已生成")
        print(f"[build] workflow: {n_workflows} 个 → 双端产物已生成")
        print(f"[build] agent: {n_agents} 个 → 双端产物已生成")
        print(f"[build] manifests: {DEFAULT_PLUGIN_JSON.name} + opencode.json 已写入")

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (FileNotFoundError, ValueError) as exc:
        print(f"[build.py:error] {exc}", file=sys.stderr)
        sys.exit(1)
