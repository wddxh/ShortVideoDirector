# Codex 安装说明

Codex 支持由 `.codex-plugin/plugin.json` 提供。

Claude Code 从 `skills/` 加载源 skills。Codex 从 `.codex/skills/` 加载生成的轻量适配层。

## 单一 Skill 源

`skills/` 是唯一需要人工维护的 skill 目录。不要手动修改 `.codex/skills/` 下生成的适配层。

适配层只包含 Codex 可识别的元数据、`.codex/tool-mapping.md`，以及指向源 skill `skills/<name>/SKILL.md` 的执行说明。适配层不复制源 skill 正文。

修改 `.codex/tool-mapping.md` 或源 skill 的头部元数据后，重新生成适配层：

```bash
python3 .codex/build-codex-skills.py
```

只检查适配层是否已同步，不写文件：

```bash
python3 .codex/build-codex-skills.py --check
```

## 用户可调用工作流

- `series-video`
- `short-video`
- `series-edit-story`
- `short-edit-story`
- `series-repair-story`
- `short-repair-story`
- `generate-video`
- `check-video`
- `auto-video`

## 说明

- 所有源 skills 都保留在 `skills/`，包括内部工作流和角色 skill，因为用户入口工作流会按名称调用它们。
- `allowed-tools` 和 `model` 等 Claude 专用头部元数据继续保留在源 skill 中供 Claude Code 使用。Codex 适配层的头部元数据只保留跨运行时的发现信息。
- `/auto-video` 的源 skill 仍描述 Claude Cron 行为。Codex 通过 `.codex/tool-mapping.md` 解释这些运行时差异。
