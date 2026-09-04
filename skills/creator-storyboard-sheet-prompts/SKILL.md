---
name: creator-storyboard-sheet-prompts
description: Use when an approved episode storyboard needs storyboard-sheet planning cards before image generation.
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Storyboard Sheet Prompts

## 输入

必须读取：
- `story/episodes/$ARGUMENTS[0]/storyboard.md` 必须是已审核 storyboard；读取同目录 `.review-storyboard.md`，其最后一轮必须为“通过”，否则报上游错误并停止。
- `config.md`，取得项目语言、视频比例、视频风格和图像模型约束。
- Glob `assets/**/*.md`，建立资产名和真实路径映射；按 storyboard 当前 shot 实际引用读取所需资产卡。
- `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`，严格使用 card schema 和分板规则。

### 动态参数

- 读取完整 `$ARGUMENTS` token 序列；仅使用受支持的 `$ARGUMENTS` 与 `$ARGUMENTS[N]` 表示法。
- token 0 / `$ARGUMENTS[0]`：ep，如 `ep01`。
- token 1 / `$ARGUMENTS[1]`：mode，`full` 或 `incremental`；缺省为 `full`。
- token 2 及以后：`incremental` 的 shots，每项必须是 canonical `shotNN`。缺失、非法、重复或不属于当前 storyboard 时拒绝运行。

示例参数：`ep01 incremental shot03 shot08`。必须保留多个独立 token；不得把多个 shot 合并成一个未解析字符串。

## 边界

唯一可写产物是 `assets/storyboard-sheets/{ep}/shotNN.md`。不修改 `storyboard.md`、config、资产卡、review 文件或 pipeline；不生图，也不删除或读取图片。旧 pipeline 未调用本 skill 时行为保持不变。

skill frontmatter 的 `allowed-tools` 只会收窄 skill 权限，不能恢复 `agents/creator.md` 未授予的 agent tools；因此 Creator agent 必须同时具备 Grep 和 Bash。

编号有两种严格用途：文件名保持 canonical `shotNN.md`；card H1 写 `# shotNN Storyboard Sheet`，基本信息的对应分镜展示为 `shot N`（N 是无前导零整数），Panel heading 从 `### PANEL 01` 起连续编号，数量字段写 `- Panel 数量：M`。不得把对应分镜写成 `shotNN`，也不得省略 `Panel` 后的空格。

每张 card 只规划一个已审核 storyboard shot。missing asset 是上游错误：不得臆造资产、路径或替代物；把对应 shot 记入 failed 并明确要求修复 storyboard/资产清单。

## 同步流程

1. 解析 storyboard 的全集顺序 `### shot N`；仅为文件名将 N 格式化为 `shotNN`，card 的“对应分镜”保留 `shot N` 整数展示。提取时长、景别、机位/摄影机运动、出场人物、引用资产及带时间码的画面 beat。
2. 校验每个 shot 的 character、location、item、building 等资产均可唯一解析到现有 `.md`。Sheet card 只引用这些当前基础资产与可选相邻前镜 sheet。
3. 写任何 card 前用 Bash 执行 `mkdir -p "assets/storyboard-sheets/{ep}"`；首次 `full` 不能假设目录已存在。
4. `full`：为 storyboard 中所有 shot 创建或覆盖 card；用 Bash `rm -- "{orphan_path}"` 删除已确认的孤儿 orphan card。全覆盖不表示无条件改写：内容相同计 preserved。
5. `incremental`：从完整 `$ARGUMENTS` 读取 token 2 及以后的 canonical shot tokens，只处理这些 cards，其他 card 保持不动。发现新增、删除、重排或编号变化，拒绝增量并要求 `full`。不得删除 orphan。
6. 按 rules 分解动态 Panel，无固定数量和上限；生成完整 prompt 后写 card。失败 shot 不写半成品，其他 shot 可继续。
7. 写后重新读取目标 card，确认 section 顺序、时间覆盖、链接路径与 Markdown 子集；只报告磁盘实际变化。

禁止用 Bash 写 card；Bash 仅可用于 `mkdir -p` 创建目标目录、只读校验，以及在 `full` 中用 `rm --` 删除已确认的 orphan `.md`。

## 返回

返回机器可辨且人类可读的摘要，六项均须出现：

```text
created: shotNN ...
updated: shotNN ...
preserved: shotNN ...
deleted: shotNN ...
failed: shotNN: reason ...
actual changed shots: shotNN ...
```

`actual changed shots` 是 `created + updated + deleted` 的去重集合；无项目写 `none`。incremental 返回中必须能证明未请求 shots 被 preserved。
