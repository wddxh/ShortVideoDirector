---
name: creator-fix-storyboard-sheet-prompt
description: Use when the latest storyboard-sheet prompt review assigns targeted card wording revisions to prompt-fix.
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Edit, Glob, Grep
model: sonnet
---

# Fix Storyboard Sheet Prompt

## 输入

- `$ARGUMENTS[0]`：ep，如 `ep01`。
- 读取 `story/episodes/{ep}/.review-storyboard-sheet-prompts.md`，只解析最大 N 的最后一轮，且必须有唯一 `<!-- /round-N -->`。
- 读取最后一轮 dirty list；每行必须是完整 card path `assets/storyboard-sheets/{ep}/shotNN.md`，直接读取这些 dirty cards。另读已审核 storyboard、config 和 `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`。

## 严格边界

只处理最后一轮 `owner=prompt-fix` 的意见及其定位 shot。只可 Edit card 中以下三个 section 的现有内容：

- `## Panel 规划`
- `## 连续性参考`
- `## 图像生成提示`

不得修改基本信息、引用资产、heading、文件名、Panel 数量或 storyboard；不得创建/删除 card。不生图；不得读取、生成、删除或重生成任何图片，不调用生图 skill。

读取最后一轮 `### orchestrator handoff`。执行顺序必须是 upstream-storyboard → generator → prompt-fix → 一次 review；每个 owner 工作单都包含精确完整 card paths 和 review path。先核验 upstream-storyboard 和 generator 的问题在当前 storyboard/cards 中已解决；任一未解决则返回 blocked。两者均已解决后才处理 prompt-fix；**Fix 不得先跑**。

`owner=generator|upstream-storyboard` 的意见不处理，并在结果中明示由 orchestrator 处理。没有 `owner=prompt-fix` 项时不编辑任何文件并正常返回。

## 流程

1. 锁定最后一轮边界，解析 dirty list 的完整 repo-relative card paths，并拒绝短 id、其他集或非 canonical 路径；按意见项读取 location、owner、observed、expected、direction。dirty list 不能替代 owner 过滤。
2. 将 prompt-fix 项的 shot 定位匹配到 dirty list 中唯一完整 card path 后读取；确认定位存在且修改不要求越过 section 白名单，否则报告未处理，不扩大范围。
3. 做最小修改：保留未被点名的 PANEL、时间码、景别、机位、摄影机及其他 section。若意见定位整板，也只调整三个允许 section。
4. Edit 后重新读取并比较，确认 schema、Panel 数量、资产 links 和非白名单 section byte-for-byte 不变；记录实际 changed shots。
5. 不修改 review 文件；下一轮由 reviewer append。

## 返回

```text
changed shots: shotNN ... | none
no_image_generated: true
orchestrator handles owner=generator: assets/storyboard-sheets/{ep}/shot03.md, assets/storyboard-sheets/{ep}/shot08.md | none
orchestrator handles owner=upstream-storyboard: assets/storyboard-sheets/{ep}/shot09.md | none
orchestrator handles owner=prompt-fix: assets/storyboard-sheets/{ep}/shot10.md | none
review path: story/episodes/{ep}/.review-storyboard-sheet-prompts.md
next: once upstream-storyboard, generator, and prompt-fix complete, run 一次 review
unhandled prompt-fix: location: reason ... | none
```

只报告实际磁盘变化；同一 shot 多项意见只列一次。
