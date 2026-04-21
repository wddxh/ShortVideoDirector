"""tools/tests/test_build_agent.py — TASK-007 agent 双端构建测试。

覆盖核心场景：
1. 典型注入路径：源 src/agents/<name>.md → Claude / opencode 双端产物 frontmatter
   字段差异，正文与源一字不差地一致
2. 两端 frontmatter 字段差异：Claude 含 name+description+tools+model，opencode
   含 description+mode（不含 name、不含 model）
3. fail-fast：runtime-config.yml 的 agents mapping 引用了某 owner，但
   src/agents/<owner>.md 不存在 → 立即 raise，错误信息含 owner 名 + 路径
4. 正文一字不改：源含「## 接收任务时的执行协议」小节时，两端产物均逐字保留
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import build  # type: ignore[import-not-found]  # noqa: E402


MIN_CONFIG: dict = {
    "agents": {"director": []},
    "runtimes": {
        "claude": {
            "agent_inject": {
                "tools": "Read, Write, Edit, Glob, Grep, Bash, Skill",
                "model": "inherit",
            },
        },
        "opencode": {
            "agent_inject": {
                "mode": "subagent",
            },
        },
    },
}


def _write_agent(src_root: Path, name: str, description: str, body: str) -> None:
    agents_dir = src_root / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)
    (agents_dir / f"{name}.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n{body}",
        encoding="utf-8",
    )


def _parse_frontmatter(text: str) -> dict:
    import yaml

    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    assert m is not None, f"无 frontmatter: {text[:80]!r}"
    return yaml.safe_load(m.group(1))


def _strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", text, count=1, flags=re.DOTALL)


def test_agent_typical_injection(tmp_path: Path) -> None:
    """单个 agent 的双端注入：Claude 4 字段、opencode 2 字段，正文一致。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    body = "# Director Agent\n\n## 角色定义\n\n经验丰富的导演。\n"
    _write_agent(src_root, "director", "导演 agent", body)

    build.build_agents(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=MIN_CONFIG,
    )

    claude_out = claude_root / "agents" / "director.md"
    opencode_out = opencode_root / "agents" / "director.md"
    assert claude_out.exists(), f"未生成 {claude_out}"
    assert opencode_out.exists(), f"未生成 {opencode_out}"

    src_body = _strip_frontmatter(
        (src_root / "agents" / "director.md").read_text(encoding="utf-8")
    )
    assert _strip_frontmatter(claude_out.read_text(encoding="utf-8")) == src_body
    assert _strip_frontmatter(opencode_out.read_text(encoding="utf-8")) == src_body


def test_agent_frontmatter_field_difference(tmp_path: Path) -> None:
    """Claude 端含 name+description+tools+model；opencode 端含 description+mode。

    关键差异：opencode 不含 name（以文件名为准）；不含 model（对齐 ADR-006）。
    """
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    _write_agent(src_root, "director", "测试导演", "body\n")

    build.build_agents(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=MIN_CONFIG,
    )

    claude_fm = _parse_frontmatter(
        (claude_root / "agents" / "director.md").read_text(encoding="utf-8")
    )
    opencode_fm = _parse_frontmatter(
        (opencode_root / "agents" / "director.md").read_text(encoding="utf-8")
    )

    assert set(claude_fm.keys()) == {"name", "description", "tools", "model"}
    assert claude_fm["name"] == "director"
    assert claude_fm["description"] == "测试导演"
    assert claude_fm["tools"] == "Read, Write, Edit, Glob, Grep, Bash, Skill"
    assert claude_fm["model"] == "inherit"

    assert set(opencode_fm.keys()) == {"description", "mode"}
    assert "name" not in opencode_fm, "opencode agent 不应含 name 字段"
    assert "model" not in opencode_fm, "opencode agent 不应含 model 字段（ADR-006）"
    assert opencode_fm["description"] == "测试导演"
    assert opencode_fm["mode"] == "subagent"


def test_agent_fail_fast_when_owner_missing(tmp_path: Path) -> None:
    """runtime-config.yml agents mapping 引用 director，但 src/agents/director.md
    不存在 → fail-fast，错误信息含 owner 名。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"
    (src_root / "agents").mkdir(parents=True)

    with pytest.raises(Exception) as excinfo:
        build.build_agents(
            src_root=src_root,
            claude_root=claude_root,
            opencode_root=opencode_root,
            config=MIN_CONFIG,
        )
    msg = str(excinfo.value)
    assert "director" in msg, f"错误信息缺少 owner 名: {msg}"


def test_agent_preserves_protocol_section_verbatim(tmp_path: Path) -> None:
    """源含「## 接收任务时的执行协议」小节时，两端产物逐字保留该小节。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    body = (
        "# Director\n\n## 接收任务时的执行协议\n\n"
        "1. **调用 skill 工具**\n2. **执行**\n3. **汇报**\n"
    )
    _write_agent(src_root, "director", "test", body)

    build.build_agents(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=MIN_CONFIG,
    )

    src_body = _strip_frontmatter(
        (src_root / "agents" / "director.md").read_text(encoding="utf-8")
    )
    claude_body = _strip_frontmatter(
        (claude_root / "agents" / "director.md").read_text(encoding="utf-8")
    )
    opencode_body = _strip_frontmatter(
        (opencode_root / "agents" / "director.md").read_text(encoding="utf-8")
    )
    assert "## 接收任务时的执行协议" in claude_body
    assert "## 接收任务时的执行协议" in opencode_body
    assert claude_body == src_body
    assert opencode_body == src_body
