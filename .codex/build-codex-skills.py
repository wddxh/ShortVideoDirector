#!/usr/bin/env python3
"""Generate Codex skill artifacts from the Claude Code source skills."""

from __future__ import annotations

import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_SKILLS = ROOT / "skills"
CODEX_DIR = ROOT / ".codex"
CODEX_SKILLS = CODEX_DIR / "skills"
TOOL_MAPPING = CODEX_DIR / "tool-mapping.md"

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
        raise SkillFormatError(f"{source} does not start with frontmatter")

    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            frontmatter = [line.rstrip("\n") for line in lines[1:index]]
            body = "".join(lines[index + 1 :])
            return frontmatter, body

    raise SkillFormatError(f"{source} has no closing frontmatter delimiter")


def parse_frontmatter(lines: list[str], source: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in line:
            raise SkillFormatError(f"{source} has unsupported frontmatter line: {line}")
        key, value = line.split(":", 1)
        values[key.strip()] = value.strip()
    return values


def render_frontmatter(values: dict[str, str], source: Path) -> str:
    output = ["---\n"]
    for key in PRESERVED_FRONTMATTER_KEYS:
        if key in values:
            output.append(f"{key}: {values[key]}\n")

    if "name" not in values:
        raise SkillFormatError(f"{source} is missing required frontmatter key: name")
    if "description" not in values:
        raise SkillFormatError(f"{source} is missing required frontmatter key: description")

    output.append("---\n")
    return "".join(output)


def copy_support_files(source_dir: Path, target_dir: Path) -> None:
    for source in source_dir.iterdir():
        if source.name == "SKILL.md":
            continue
        target = target_dir / source.name
        if source.is_dir():
            shutil.copytree(source, target)
        else:
            shutil.copy2(source, target)


def render_skill(source_skill: Path, mapping: str) -> str:
    source_text = source_skill.read_text(encoding="utf-8")
    frontmatter_lines, body = split_frontmatter(source_text, source_skill)
    frontmatter_values = parse_frontmatter(frontmatter_lines, source_skill)

    relative_source = source_skill.relative_to(ROOT).as_posix()
    return (
        render_frontmatter(frontmatter_values, source_skill)
        + "\n"
        + "<!-- BEGIN CODEX RUNTIME MAPPING: generated from .codex/tool-mapping.md -->\n\n"
        + mapping.rstrip()
        + "\n\n<!-- END CODEX RUNTIME MAPPING -->\n\n"
        + f"<!-- BEGIN ORIGINAL SKILL: {relative_source} -->\n\n"
        + body.lstrip()
        + "\n<!-- END ORIGINAL SKILL -->\n"
    )


def generate() -> int:
    if not SOURCE_SKILLS.is_dir():
        raise SkillFormatError(f"missing source skills directory: {SOURCE_SKILLS}")
    if not TOOL_MAPPING.is_file():
        raise SkillFormatError(f"missing tool mapping: {TOOL_MAPPING}")

    mapping = TOOL_MAPPING.read_text(encoding="utf-8")

    if CODEX_SKILLS.exists():
        shutil.rmtree(CODEX_SKILLS)
    CODEX_SKILLS.mkdir(parents=True)

    generated = 0
    for source_dir in sorted(path for path in SOURCE_SKILLS.iterdir() if path.is_dir()):
        source_skill = source_dir / "SKILL.md"
        if not source_skill.is_file():
            raise SkillFormatError(f"missing SKILL.md in {source_dir}")

        target_dir = CODEX_SKILLS / source_dir.name
        target_dir.mkdir()
        copy_support_files(source_dir, target_dir)
        (target_dir / "SKILL.md").write_text(
            render_skill(source_skill, mapping),
            encoding="utf-8",
        )
        generated += 1

    return generated


def main() -> None:
    generated = generate()
    print(f"Generated {generated} Codex skills in {CODEX_SKILLS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
