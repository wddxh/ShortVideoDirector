"""tools/tests/test_build_manifest.py — TASK-007 manifests 生成测试。

覆盖核心场景：
1. plugin.json：保留源 name/version/description，skills/agents 字段写入正确路径
2. opencode.json：含 $schema + permission（edit/bash/webfetch=allow），不含 model
3. plugin.json 路径与格式：相对仓库根 `./.claude/skills/` 与 `./.claude/agents/`，
   2 空格缩进 + 末尾换行
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS_DIR))

import build  # type: ignore[import-not-found]  # noqa: E402


def _write_existing_plugin(plugin_path: Path, content: dict) -> None:
    plugin_path.parent.mkdir(parents=True, exist_ok=True)
    plugin_path.write_text(
        json.dumps(content, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def test_plugin_json_preserves_metadata_and_updates_paths(tmp_path: Path) -> None:
    """plugin.json 应保留源 name/version/description；skills 字段更新为
    `./.claude/skills/`；新增 agents 字段 `./.claude/agents/`。"""
    plugin_path = tmp_path / ".claude-plugin" / "plugin.json"
    _write_existing_plugin(
        plugin_path,
        {
            "name": "short-video-director",
            "version": "1.0.0",
            "description": "测试描述",
            "skills": "./skills/",
        },
    )

    build.generate_plugin_json(plugin_path)

    data = json.loads(plugin_path.read_text(encoding="utf-8"))
    assert data["name"] == "short-video-director"
    assert data["version"] == "1.0.0"
    assert data["description"] == "测试描述"
    assert data["skills"] == "./.claude/skills/"
    assert data["agents"] == "./.claude/agents/"
    assert set(data.keys()) == {"name", "version", "description", "skills", "agents"}


def test_opencode_json_minimal_with_permission(tmp_path: Path) -> None:
    """opencode.json 含 $schema + permission（allow-all），不含 model。"""
    opencode_root = tmp_path / ".opencode"

    build.generate_opencode_json(opencode_root)

    out = opencode_root / "opencode.json"
    assert out.exists(), f"未生成 {out}"
    data = json.loads(out.read_text(encoding="utf-8"))
    assert data["$schema"] == "https://opencode.ai/config.json"
    assert data["permission"] == {
        "edit": "allow",
        "bash": "allow",
        "webfetch": "allow",
    }
    assert "model" not in data, "opencode.json 不应含 model 字段（ADR-006）"
    assert set(data.keys()) == {"$schema", "permission"}


def test_plugin_json_format_is_pretty(tmp_path: Path) -> None:
    """plugin.json 应保留 2 空格缩进 + 末尾换行（与现有文件一致）。"""
    plugin_path = tmp_path / ".claude-plugin" / "plugin.json"
    _write_existing_plugin(
        plugin_path,
        {
            "name": "x",
            "version": "0.1.0",
            "description": "d",
            "skills": "./skills/",
        },
    )

    build.generate_plugin_json(plugin_path)

    text = plugin_path.read_text(encoding="utf-8")
    assert text.endswith("\n"), "plugin.json 应以换行符结尾"
    assert '\n  "name":' in text, "plugin.json 应使用 2 空格缩进"


def test_opencode_json_format_is_pretty(tmp_path: Path) -> None:
    """opencode.json 同样 2 空格缩进 + 末尾换行。"""
    opencode_root = tmp_path / ".opencode"

    build.generate_opencode_json(opencode_root)

    text = (opencode_root / "opencode.json").read_text(encoding="utf-8")
    assert text.endswith("\n")
    assert '\n  "$schema":' in text or '\n  "permission":' in text
