---
name: creator-fix-storyboard-sheet-image
description: Use when the latest sheet visual review marks whole storyboard-sheet images for targeted regeneration.
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Edit, Glob, Grep, Bash, Task
model: sonnet
---

# Fix Storyboard Sheet Images

## 输入

- `$ARGUMENTS[0]`：ep，如 `ep01`。
- `$ARGUMENTS[1]`：visual review path，通常为 `story/episodes/{ep}/.review-storyboard-sheets-visual.md`。
- 后续可指定 canonical `shotNN` scope；未指定时处理最后一轮全部 dirty shots。
- Read review 最大 N 的唯一完整 round，只消费该轮 `### dirty list` 中 `card|image`，以及 impact handoff 的 `card|image|impact|fix_direction`。显式 scope 与该集合取交集。
- Read 选中 cards 和对应意见；不得 Read PNG。

## 修改边界

只可最小 Edit 选中 card 的：

- `## Panel 规划`
- `## 图像生成提示`

不得修改 `## 连续性参考`、`## 引用资产`、`## 基本信息`、heading、Panel 数量、文件名、storyboard 或其他资产。若意见要求越界，报告失败，不扩大修改范围。

每项 visual/impact 意见落实到相关 Panel 规划和/或整板图像提示。保留未涉及 Panel、时间码和既有事实。图片修复单位始终是整张 sheet；不裁切、不局部修图、不拼接旧 panel。

## 执行

1. 校验 review round、路径、scope 和 section 边界，Edit cards。
2. 验证调用可执行：确认 `creator-generate-images` skill 可加载，参数严格为 `{ep} paths {cards...}`，cards 使用完整路径。验证失败时保留旧 PNG 并返回可恢复失败。
3. 使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {cards...}`；一次调用整批 cards，禁止逐 panel 生图。`router owns targeted PNG deletion`，本 skill 不重复删除。
4. 依据接口结果和实际 PNG 落盘情况，只把真实成功的 shots 计入成功集合。失败项保持可恢复失败，不声称已更新，不由本 skill enqueue impact。

Bash 仅用于只读存在性校验；不得用 Bash 删除 PNG 或写 card/review。

## 返回

```text
requested shots: shotNN ... | none
changed cards: shotNN ... | none
successful regenerated shots: shotNN ... | none
failed shots: shotNN: reason ... | none
review path: story/episodes/{ep}/.review-storyboard-sheets-visual.md
```

返回集合以实际结果为准。orchestrator 仅可对 `successful regenerated shots` 做 re-review 或连续性影响 enqueue。
