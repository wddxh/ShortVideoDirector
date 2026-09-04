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

- review mode CLI：`ep`。读取 latest sheet prompt review 的 prompt-fix owner，保持 pipeline 现有行为。
- direct mode CLI：`ep + --direct + card + instruction`。card 必须是本集 canonical card path 或 shotNN；instruction 是 Phase 3 具体修改描述。
- direct mode 只处理指定 card，不读取或拼接旧 review。
- Review mode 读取 `story/episodes/{ep}/.review-storyboard-sheet-prompts.md` 最大 N 轮及 dirty list；direct mode 不读取 review。
- 两种模式都读取目标 cards、已审核 storyboard、config 和 `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`。

## 严格边界

只处理最后一轮 `owner=prompt-fix` 的意见及其定位 shot。只可 Edit card 中以下三个 section 的现有内容：

- `## Panel 规划`
- `## 连续性参考`
- `## 图像生成提示`

不得修改基本信息、引用资产、heading、文件名、Panel 数量或 storyboard；不得创建/删除 card。不生图；不得读取、生成、删除或重生成任何图片，不调用生图 skill。

本 skill 只执行最后一轮 `owner=prompt-fix` 意见。`upstream-storyboard` 和 `generator` 由 orchestrator 按 review handoff 先处理；调用本 skill 即表示前两步已完成。没有 prompt-fix 项时不编辑任何文件。

Direct mode 不要求 owner 或 dirty list，但仍只可修改上方三个白名单 section；instruction 要求修改其他 section 时返回 unhandled，不扩大边界。

## 流程

1. review mode 锁定最后一轮并按 owner 过滤；direct mode 将 card/shotNN 规范化为本集唯一 canonical card。拒绝其他集或不存在路径。
2. Review mode 将 prompt-fix 项匹配到 dirty list 中唯一 card；direct mode 使用规范化后的指定 card 和传入 instruction。确认修改不要求越过 section 白名单，否则报告未处理。
3. 做最小修改：保留未被点名的 PANEL、时间码、景别、机位、摄影机及其他 section。整板或 direct instruction 也只调整三个允许 section。
4. Edit 后重新读取并比较，确认 schema、Panel 数量、资产 links 和非白名单 section byte-for-byte 不变；记录实际 changed shots。
5. 不修改 review 文件；下一轮由 reviewer append。

## 返回

```text
changed shots: shotNN ... | none
no_image_generated: true
input mode: review | direct
unhandled prompt-fix: location: reason ... | none
```

只报告实际磁盘变化；同一 shot 多项意见只列一次。
