---
name: director-review-storyboard-sheets-visual
description: Use when generated storyboard-sheet images need visual review or a scoped re-review after regeneration.
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

# Review Storyboard Sheets Visually

## 输入与边界

- `$ARGUMENTS[0]`：ep，如 `ep01`。后续参数可为 canonical `shotNN`，形成显式 scope。
- cards 为 `assets/storyboard-sheets/{ep}/shotNN.md`，图片为 `assets/images/storyboard-sheets/{ep}/shotNN.png`。
- review 路径为 `story/episodes/{ep}/.review-storyboard-sheets-visual.md`。
- 本 skill 只调度和落盘。严禁 Read 任何 PNG，也不自行作视觉判断；每张图由独立 Task 执行 `director-review-storyboard-sheet-visual-single`。
- 不修改 card、图片、storyboard 或资产。

## Scope 与调度

1. review 不存在时，未指定 scope 则 Glob 全部 cards；指定 scope 时只取对应 cards。
2. review 已存在时，定位最大 N 和唯一 `<!-- /round-N -->`。显式 scope 优先；否则只合并最后一轮 `### dirty list` 与 `### 无法判定` 中的 cards。最后一轮通过且无显式 scope 时直接返回 `pass`，不追加空轮。
3. 映射每个 card/image pair。缺图预扫描直接产生 dirty issue，不派发 single。
4. 其余每 sheet 一个 Task，参数为 `{card_path} {image_path}`。每批 ≤5 个并行 Task；技术失败或非约定 JSON 重试 1 次，仍失败进入无法判定，不进入 dirty。
5. single 返回空字符串即通过；合法 JSON 原样聚合。同一卡多个 issues 只产生一个 dirty entry。

必须使用 Task 工具派发 `director-review-storyboard-sheet-visual-single`；aggregate context 只保留文本结果。

## Round 输出

第 1 轮 Write；后续 Edit，以前一轮唯一 footer 为 anchor append。写后 Read，确认当前 footer 恰好一次。M 为去重 dirty cards，K 为无法判定 cards。heading 使用：

```text
## 第 {N} 轮 ({timestamp}) - 通过
## 第 {N} 轮 ({timestamp}) - 通过 ({K} 项无法判定)
## 第 {N} 轮 ({timestamp}) - 需修改 ({M} shots)
## 第 {N} 轮 ({timestamp}) - 需修改 ({M} shots, {K} 项无法判定)
```

有问题时使用稳定结构：

```markdown
### 意见列表
- card: assets/storyboard-sheets/{ep}/shotNN.md
  image: assets/images/storyboard-sheets/{ep}/shotNN.png
  location: PANEL NN
  issue: 可见问题
  fix_direction: 最小修复方向

### dirty list
assets/storyboard-sheets/{ep}/shotNN.md|assets/images/storyboard-sheets/{ep}/shotNN.png

### 无法判定
assets/storyboard-sheets/{ep}/shotNN.md|assets/images/storyboard-sheets/{ep}/shotNN.png

### 连续性影响评估

---
<!-- /round-{N} -->
```

无对应内容的 section 可省略；每轮必须有 footer。返回 `pass`、`pass {K}_unknown`、`needs_revision {M}` 或 `needs_revision {M} {K}_unknown`。

## 连续性影响评估 Handoff

图片修复成功后，orchestrator 对直接 N+1 调用 impact skill，并把 exact JSON 追加到本轮 `### 连续性影响评估`：

使用 Edit 将记录插入当前轮 footer 之前；section 不存在时先创建该 heading。保留 `<!-- /round-{N} -->` 唯一且仍位于轮次末尾；每次写后 Read 自检。

- `no_dependency` 或 `unaffected`：记录 reason，不加入 dirty，并停止该分支。
- `affected`：追加 `card|image|impact|{fix_direction}`，同时把 `card|image` 加入 `### dirty list`；调用 `creator-fix-storyboard-sheet-image {ep} {review-path} shotNN`。
- fix 失败：记录失败并停止该分支，不 enqueue。
- fix 成功：记录成功并 enqueue 该 shot，继续检查其直接 N+1。

不得从关键词机械判定影响状态；只消费 impact reviewer JSON。初次全量生成不运行影响传播。
