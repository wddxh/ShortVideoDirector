#!/usr/bin/env python3
"""从 Claude 源 skills 生成轻量 Codex 适配层。"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_SKILLS = ROOT / "skills"
CODEX_SKILLS = ROOT / ".codex" / "skills"
TOOL_MAPPING = ROOT / ".codex" / "tool-mapping.md"

PRESERVED_FRONTMATTER_KEYS = (
    "name",
    "description",
    "user-invocable",
    "argument-hint",
)


class SkillFormatError(RuntimeError):
    pass


def split_frontmatter(text: str, source: Path) -> tuple[list[str], str]:
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        raise SkillFormatError(f"{source} 没有以头部元数据开始")

    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            frontmatter = [line.rstrip("\n") for line in lines[1:index]]
            body = "".join(lines[index + 1 :])
            return frontmatter, body

    raise SkillFormatError(f"{source} 缺少头部元数据结束分隔符")


def parse_frontmatter(lines: list[str], source: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            raise SkillFormatError(f"{source} 包含不支持的头部元数据行: {line}")
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip()
    return values


def render_frontmatter(values: dict[str, str], source: Path) -> str:
    if "name" not in values:
        raise SkillFormatError(f"{source} 缺少必需的头部元数据字段: name")
    if "description" not in values:
        raise SkillFormatError(f"{source} 缺少必需的头部元数据字段: description")

    output = ["---\n"]
    for key in PRESERVED_FRONTMATTER_KEYS:
        if key in values:
            output.append(f"{key}: {values[key]}\n")
    output.append("---\n")
    return "".join(output)


def render_wrapper(source_skill: Path, mapping: str) -> str:
    source_text = source_skill.read_text(encoding="utf-8")
    frontmatter_lines, _body = split_frontmatter(source_text, source_skill)
    frontmatter_values = parse_frontmatter(frontmatter_lines, source_skill)

    skill_dir = source_skill.parent
    relative_source = source_skill.relative_to(ROOT).as_posix()
    relative_skill_dir = skill_dir.relative_to(ROOT).as_posix()

    return (
        render_frontmatter(frontmatter_values, source_skill)
        + "\n"
        + "# Codex 适配器\n\n"
        + "这是生成的 Codex 适配层。源 skill 仍是唯一事实来源，位置为 "
        + f"`{relative_source}`。\n\n"
        + "不要手动编辑这个适配层。只有在确实需要改变 Claude 行为时才修改"
        + "源 skill，然后运行 `python3 .codex/build-codex-skills.py` "
        + "重新生成适配层。\n\n"
        + "## 运行时映射\n\n"
        + mapping.rstrip()
        + "\n\n"
        + "## 执行源 Skill\n\n"
        + f"1. 读取 `{relative_source}`，并使用用户的原始参数执行该 skill 的说明。\n"
        + f"2. 将 `{relative_skill_dir}/` 视为源 skill 目录。"
        + "当源 skill 引用 `rules.md` 或 `config-template.md` 等同级文件时，"
        + "相对该目录解析。\n"
        + "3. 将 `scripts/`、`agents/`、`story/`、`assets/` 和 `config.md` "
        + "等仓库根路径视为相对当前工作区根目录的路径。\n"
        + "4. 执行本适配层时，不要复制或修改源 skill 说明。\n"
    )


def expected_wrappers() -> dict[Path, str]:
    if not SOURCE_SKILLS.is_dir():
        raise SkillFormatError(f"缺少源 skills 目录: {SOURCE_SKILLS}")
    if not TOOL_MAPPING.is_file():
        raise SkillFormatError(f"缺少工具映射文件: {TOOL_MAPPING}")

    mapping = TOOL_MAPPING.read_text(encoding="utf-8")
    wrappers: dict[Path, str] = {}

    for source_dir in sorted(path for path in SOURCE_SKILLS.iterdir() if path.is_dir()):
        source_skill = source_dir / "SKILL.md"
        if not source_skill.is_file():
            raise SkillFormatError(f"{source_dir} 中缺少 SKILL.md")

        target = CODEX_SKILLS / source_dir.name / "SKILL.md"
        wrappers[target] = render_wrapper(source_skill, mapping)

    return wrappers


def generate() -> int:
    wrappers = expected_wrappers()

    if CODEX_SKILLS.exists():
        shutil.rmtree(CODEX_SKILLS)
    CODEX_SKILLS.mkdir(parents=True)

    for target, content in wrappers.items():
        target.parent.mkdir(parents=True)
        target.write_text(content, encoding="utf-8")

    return len(wrappers)


def check() -> int:
    wrappers = expected_wrappers()
    errors: list[str] = []

    existing = {
        path
        for path in CODEX_SKILLS.glob("*/SKILL.md")
        if path.is_file()
    }
    expected = set(wrappers)

    for stale in sorted(existing - expected):
        errors.append(f"多余的适配层: {stale.relative_to(ROOT)}")
    for missing in sorted(expected - existing):
        errors.append(f"缺少适配层: {missing.relative_to(ROOT)}")
    for target in sorted(expected & existing):
        current = target.read_text(encoding="utf-8")
        if current != wrappers[target]:
            errors.append(f"过期的适配层: {target.relative_to(ROOT)}")

    if errors:
        print("Codex skill 适配层未同步:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print("请运行: python3 .codex/build-codex-skills.py", file=sys.stderr)
        return 1

    print(f"Codex skill 适配层已同步（共 {len(wrappers)} 个）")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="只校验生成的适配层，不写入文件",
    )
    args = parser.parse_args()

    if args.check:
        raise SystemExit(check())

    generated = generate()
    print(f"已在 {CODEX_SKILLS.relative_to(ROOT)} 生成 {generated} 个 Codex skill 适配层")


if __name__ == "__main__":
    main()
