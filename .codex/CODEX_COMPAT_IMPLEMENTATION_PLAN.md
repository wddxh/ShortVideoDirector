# Codex 兼容实现方案

状态：已采用生成 Codex 适配层 skill 的方案。Claude Code 的源 skills 保持在 `skills/` 下不变；所有 Codex 适配内容都放在 `.codex/` 下。

## 背景

本仓库使用 Claude Code plugin 布局：

- `.claude-plugin/plugin.json` 指向 `./skills/`，供 Claude Code 使用。
- `skills/*/SKILL.md` 包含源工作流和角色 skill。
- `agents/*.md` 定义工作流使用的角色提示词。
- `scripts/` 包含 skill 通过 shell 命令调用的本地辅助脚本。

Codex 需要理解 Claude 运行时概念，例如 `Skill tool`、`Agent`、`CronCreate`、`allowed-tools` 和 `model`。这些映射不应注入或修改到 `skills/` 中，因为 `skills/` 是 Claude Code 的唯一事实来源。

## 当前方案

在 `.codex/skills/` 下生成轻量适配层：

```text
ShortVideoDirector/
├── .claude-plugin/
│   └── plugin.json                  # Claude Code manifest -> ./skills/
├── .codex-plugin/
│   └── plugin.json                  # Codex manifest -> ./.codex/skills/
├── .codex/
│   ├── CODEX_COMPAT_IMPLEMENTATION_PLAN.md
│   ├── INSTALL.md
│   ├── build-codex-skills.py        # 适配层生成器和 --check 校验器
│   ├── tool-mapping.md              # Codex 运行时映射
│   └── skills/                      # 生成的适配层 skills
├── agents/
├── scripts/
├── skills/                          # Claude 唯一事实来源
└── README.md
```

Codex manifest 指向生成的适配层：

```json
"skills": "./.codex/skills/"
```

每个适配层：

1. 从源 skill 保留跨运行时可用的发现头部元数据。
2. 内嵌 `.codex/tool-mapping.md`。
3. 指示 Codex 读取并执行 `skills/<name>/SKILL.md`。
4. 对 `rules.md`、`config-template.md` 等同级文件，按源 skill 所在目录解析。

适配层不复制源 skill 正文，也不复制辅助文件。

## 生成器

生成适配层：

```bash
python3 .codex/build-codex-skills.py
```

只校验不写文件：

```bash
python3 .codex/build-codex-skills.py --check
```

生成器保留这些头部元数据字段：

- `name`
- `description`
- `user-invocable`
- `argument-hint`

生成器会刻意从 Codex 适配层头部元数据中省略 Claude 专用字段，例如 `allowed-tools` 和 `model`。

## 验收标准

1. Claude Code 仍可通过 `.claude-plugin/plugin.json` 加载，并使用未修改的 `skills/` 目录。
2. Codex 可通过 `.codex-plugin/plugin.json` 加载，并发现 `.codex/skills/` 下的适配层。
3. 源 skill 的行为只在 `skills/` 中改；Codex 适配只在 `.codex/` 中改。
4. `.codex/skills/` 包含轻量适配层，而不是源 skill 的完整副本。
5. 生成后 `python3 .codex/build-codex-skills.py --check` 通过。
6. README 和 `.codex/INSTALL.md` 说明适配层工作流。
