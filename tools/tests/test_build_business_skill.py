"""tools/tests/test_build_business_skill.py — TASK-005 业务 skill 构建测试。

覆盖 3 个核心场景：
1. 典型注入路径：源 SKILL.md → Claude / opencode 双端产物 frontmatter 正确注入，正文一致
2. fail-fast：源含未在 agents mapping 注册的 skill，build 抛异常且错误信息含 skill 名
3. 附属文件复制：源含 rules.md，两端产物均包含 rules.md
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

# 让 tools/ 进入 import path
TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import build  # type: ignore[import-not-found]  # noqa: E402


# ---------------------------------------------------------------------------
# 测试工具
# ---------------------------------------------------------------------------

MIN_CONFIG: dict = {
    "agents": {"director": ["foo"]},
    "runtimes": {
        "claude": {
            "business_skill_inject": {
                "user-invocable": False,
                "context": "fork",
            },
        },
        "opencode": {
            "business_skill_inject": {},
        },
    },
}


def _write_skill(
    src_root: Path,
    name: str,
    description: str,
    body: str,
    extra_files: dict[str, str] | None = None,
) -> None:
    """在 src_root/skills/<name>/ 下写最小 SKILL.md 与可选附属文件。"""
    skill_dir = src_root / "skills" / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_md = skill_dir / "SKILL.md"
    skill_md.write_text(
        f"---\nname: {name}\ndescription: {description}\n---\n{body}",
        encoding="utf-8",
    )
    for fname, content in (extra_files or {}).items():
        (skill_dir / fname).write_text(content, encoding="utf-8")


def _parse_frontmatter(text: str) -> dict:
    import yaml

    m = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    assert m is not None, f"无 frontmatter: {text[:80]!r}"
    return yaml.safe_load(m.group(1))


def _strip_frontmatter(text: str) -> str:
    return re.sub(r"^---\n.*?\n---\n", "", text, count=1, flags=re.DOTALL)


# ---------------------------------------------------------------------------
# 测试 1：典型注入路径
# ---------------------------------------------------------------------------


def test_business_skill_typical_injection(tmp_path: Path) -> None:
    """单个 skill 的双端注入：Claude 含 5 字段，opencode 仅 2 字段，正文不变。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    body = "## 输入\n- 测试正文（保持不变）。\n"
    _write_skill(src_root, "foo", "test description", body)

    build.build_business_skills(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=MIN_CONFIG,
    )

    claude_skill = claude_root / "skills" / "foo" / "SKILL.md"
    opencode_skill = opencode_root / "skills" / "foo" / "SKILL.md"
    assert claude_skill.exists(), f"未生成 {claude_skill}"
    assert opencode_skill.exists(), f"未生成 {opencode_skill}"

    claude_text = claude_skill.read_text(encoding="utf-8")
    opencode_text = opencode_skill.read_text(encoding="utf-8")

    claude_fm = _parse_frontmatter(claude_text)
    opencode_fm = _parse_frontmatter(opencode_text)

    assert set(claude_fm.keys()) == {
        "name",
        "description",
        "user-invocable",
        "context",
        "agent",
    }
    assert claude_fm["name"] == "foo"
    assert claude_fm["description"] == "test description"
    assert claude_fm["user-invocable"] is False
    assert claude_fm["context"] == "fork"
    assert claude_fm["agent"] == "director"

    assert set(opencode_fm.keys()) == {"name", "description"}
    assert opencode_fm["name"] == "foo"
    assert opencode_fm["description"] == "test description"

    src_body = _strip_frontmatter(
        (src_root / "skills" / "foo" / "SKILL.md").read_text(encoding="utf-8")
    )
    assert _strip_frontmatter(claude_text) == src_body
    assert _strip_frontmatter(opencode_text) == src_body


# ---------------------------------------------------------------------------
# 测试 2：fail-fast — 未注册 skill
# ---------------------------------------------------------------------------


def test_business_skill_fail_fast_unregistered(tmp_path: Path) -> None:
    """src/skills/<name>/ 在 agents mapping 中找不到 owner 时立刻抛异常。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    _write_skill(src_root, "ghost-skill", "未注册的 skill", "body\n")

    with pytest.raises(Exception) as excinfo:
        build.build_business_skills(
            src_root=src_root,
            claude_root=claude_root,
            opencode_root=opencode_root,
            config=MIN_CONFIG,
        )
    msg = str(excinfo.value)
    assert "ghost-skill" in msg, f"错误信息缺少 skill 名: {msg}"


# ---------------------------------------------------------------------------
# 测试 3：附属文件复制
# ---------------------------------------------------------------------------


def test_business_skill_preserves_body_leading_blank_line(tmp_path: Path) -> None:
    """源 SKILL.md 在 closing `---` 后含空行时，产物必须保留该空行（一字不改）。

    回归保护：python-frontmatter 默认会 strip 正文前导空白，本测试确保我们绕过它。
    """
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    skill_dir = src_root / "skills" / "foo"
    skill_dir.mkdir(parents=True)
    raw_src = "---\nname: foo\ndescription: test\n---\n\n## 输入\n- bar\n"
    (skill_dir / "SKILL.md").write_text(raw_src, encoding="utf-8")

    build.build_business_skills(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=MIN_CONFIG,
    )

    src_body = _strip_frontmatter(raw_src)
    claude_body = _strip_frontmatter(
        (claude_root / "skills" / "foo" / "SKILL.md").read_text(encoding="utf-8")
    )
    opencode_body = _strip_frontmatter(
        (opencode_root / "skills" / "foo" / "SKILL.md").read_text(encoding="utf-8")
    )
    assert claude_body == src_body, f"claude body mismatch: {claude_body!r} != {src_body!r}"
    assert opencode_body == src_body, f"opencode body mismatch: {opencode_body!r} != {src_body!r}"


def test_business_skill_copies_attachments(tmp_path: Path) -> None:
    """源含 rules.md 时，两端产物目录均原样复制。"""
    src_root = tmp_path / "src"
    claude_root = tmp_path / ".claude"
    opencode_root = tmp_path / ".opencode"

    rules_content = "# Rules\n- 规则 1\n- 规则 2\n"
    _write_skill(
        src_root,
        "foo",
        "test",
        "body\n",
        extra_files={"rules.md": rules_content},
    )

    build.build_business_skills(
        src_root=src_root,
        claude_root=claude_root,
        opencode_root=opencode_root,
        config=MIN_CONFIG,
    )

    claude_rules = claude_root / "skills" / "foo" / "rules.md"
    opencode_rules = opencode_root / "skills" / "foo" / "rules.md"
    assert claude_rules.exists(), f"未复制到 {claude_rules}"
    assert opencode_rules.exists(), f"未复制到 {opencode_rules}"
    assert claude_rules.read_text(encoding="utf-8") == rules_content
    assert opencode_rules.read_text(encoding="utf-8") == rules_content
