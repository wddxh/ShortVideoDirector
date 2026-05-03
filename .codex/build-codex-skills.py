#!/usr/bin/env python3
"""Generate thin Codex skill wrappers from the shared Claude skills."""

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
    if "name" not in values:
        raise SkillFormatError(f"{source} is missing required frontmatter key: name")
    if "description" not in values:
        raise SkillFormatError(f"{source} is missing required frontmatter key: description")

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
    skill_name = skill_dir.name
    relative_source = source_skill.relative_to(ROOT).as_posix()
    relative_skill_dir = skill_dir.relative_to(ROOT).as_posix()

    return (
        render_frontmatter(frontmatter_values, source_skill)
        + "\n"
        + "# Codex Adapter\n\n"
        + "This is a generated Codex wrapper. The source skill remains the "
        + f"single source of truth at `{relative_source}`.\n\n"
        + "Do not edit this wrapper by hand. Update the source skill only when "
        + "you intentionally want to change Claude behavior, then regenerate "
        + "wrappers with `python3 .codex/build-codex-skills.py`.\n\n"
        + "## Runtime Mapping\n\n"
        + mapping.rstrip()
        + "\n\n"
        + "## Execute Source Skill\n\n"
        + f"1. Read `{relative_source}` and execute that skill's instructions "
        + "with the user's original arguments.\n"
        + f"2. Treat `{relative_skill_dir}/` as the source skill directory. "
        + "When the source skill references sibling files such as `rules.md` "
        + "or `config-template.md`, resolve them relative to that directory.\n"
        + "3. Treat repository-root paths such as `scripts/`, `agents/`, "
        + "`story/`, `assets/`, and `config.md` as paths relative to the "
        + "current workspace root.\n"
        + "4. Do not copy or edit source skill instructions while executing "
        + "this wrapper.\n"
    )


def expected_wrappers() -> dict[Path, str]:
    if not SOURCE_SKILLS.is_dir():
        raise SkillFormatError(f"missing source skills directory: {SOURCE_SKILLS}")
    if not TOOL_MAPPING.is_file():
        raise SkillFormatError(f"missing tool mapping: {TOOL_MAPPING}")

    mapping = TOOL_MAPPING.read_text(encoding="utf-8")
    wrappers: dict[Path, str] = {}

    for source_dir in sorted(path for path in SOURCE_SKILLS.iterdir() if path.is_dir()):
        source_skill = source_dir / "SKILL.md"
        if not source_skill.is_file():
            raise SkillFormatError(f"missing SKILL.md in {source_dir}")

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
        errors.append(f"stale wrapper: {stale.relative_to(ROOT)}")
    for missing in sorted(expected - existing):
        errors.append(f"missing wrapper: {missing.relative_to(ROOT)}")
    for target in sorted(expected & existing):
        current = target.read_text(encoding="utf-8")
        if current != wrappers[target]:
            errors.append(f"outdated wrapper: {target.relative_to(ROOT)}")

    if errors:
        print("Codex skill wrappers are out of date:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        print("Run: python3 .codex/build-codex-skills.py", file=sys.stderr)
        return 1

    print(f"Codex skill wrappers are up to date ({len(wrappers)} wrappers)")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify generated wrappers without writing files",
    )
    args = parser.parse_args()

    if args.check:
        raise SystemExit(check())

    generated = generate()
    print(f"Generated {generated} Codex skill wrappers in {CODEX_SKILLS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
