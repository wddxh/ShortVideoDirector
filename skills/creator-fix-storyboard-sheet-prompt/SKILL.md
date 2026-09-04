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
- 读取最后一轮 dirty cards、已审核 storyboard、config 和 `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`。

## 严格边界

只处理最后一轮 `owner=prompt-fix` 的意见及其定位 shot。只可 Edit card 中以下三个 section 的现有内容：

- `## Panel 规划`
- `## 连续性参考`
- `## 图像生成提示`

不得修改基本信息、引用资产、heading、文件名、Panel 数量或 storyboard；不得创建/删除 card。不生图；不得读取、生成、删除或重生成任何图片，不调用生图 skill。

`owner=generator|upstream-storyboard` 的意见不处理，并在结果中明示“由 orchestrator 处理”：generator 项应重跑 generator，upstream-storyboard 项应先修 storyboard 再 full 生成。没有 `owner=prompt-fix` 项时不编辑任何文件并正常返回。

## 流程

1. 锁定最后一轮边界，按意见项读取 location、owner、observed、expected、direction；dirty list 不能替代 owner 过滤。
2. 对每个 prompt-fix 项读取对应 card，确认定位存在且修改不要求越过 section 白名单；否则报告未处理，不扩大范围。
3. 做最小修改：保留未被点名的 PANEL、时间码、景别、机位、摄影机及其他 section。若意见定位整板，也只调整三个允许 section。
4. Edit 后重新读取并比较，确认 schema、Panel 数量、资产 links 和非白名单 section byte-for-byte 不变；记录实际 changed shots。
5. 不修改 review 文件；下一轮由 reviewer append。

## 返回

```text
changed shots: shotNN ... | none
no_image_generated: true
orchestrator handles owner=generator: shotNN ... | none
orchestrator handles owner=upstream-storyboard: shotNN ... | none
unhandled prompt-fix: location: reason ... | none
```

只报告实际磁盘变化；同一 shot 多项意见只列一次。
