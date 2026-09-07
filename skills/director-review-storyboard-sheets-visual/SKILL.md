---
name: director-review-storyboard-sheets-visual
description: Use when generated storyboard-sheet images need visual review or a scoped re-review after regeneration.
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

# Review Storyboard Sheets Visually

## 输入与边界

- 委托说明 ep、审核 outcome、相关参考与可选明确 canonical shots/card paths，形成显式 scope。
- cards 为 `assets/storyboard-sheets/{ep}/shotNN.md`，图片为 `assets/images/storyboard-sheets/{ep}/shotNN.png`。
- review 路径为 `story/episodes/{ep}/.review-storyboard-sheets-visual.md`。
- 本上下文只汇总文本与落盘，不 Read 任何 PNG，也不自行作视觉判断；每张图的审核 outcome 委托独立新 Director context。
- 不修改 card、图片、storyboard 或资产。
- 必读共享 review-meta-rules/output-language；新 Director review context 与生产者隔离，按共享规则先声明 `sheet-visual` scope，单项阅读前/结束后 fingerprint 所有实际输入，aggregate 验证原结果后落盘。

## Scope 与调度

## Scope 优先级协议

1. 未指定 scope 时从当前 storyboard 的 shot 集合推导 canonical cards，检查每个目标最新证据，只审缺失、过时或未通过项；指定时只取明确 cards，不自动并入历史 dirty/unknown。
2. 按最大标题 N 续轮，按 card path 去重；范围外未解决记录原样保留，另报生产 Director，不因本轮 pass 清除。历史纯 pass 必须验证当前 inputs，显式目标仍审核。
3. 映射 card/image pair。缺卡/缺图记 unknown 和路径原因，不派发 single，不伪造指纹。
4. 每 sheet 一个独立新 Director context，委托 card/image 语义匹配与声明连续性审核，附实际配置、当前 shot、直接参考、只读边界与结果形状。可并行或串行，例如每批最多五项；技术失败或非约定 JSON 进入无法判定，由委托方决定是否重试。
5. 仅显式合法 JSON 中的 status 才是结论；空响应/缺项为 unknown。同一卡多个 issues 只产生一个 dirty entry。

Reviewer 自行发现并选用方法，不指定加载某个 skill。不支持嵌套时由主 AI 忠实 relay 并回传原 Director。aggregate context 只保留文本结果，skill 加载本身不隔离。无隔离则 unknown。范围选择所读 storyboard/实际配置（SVD_CONFIG 或 config.md）也纳入前后指纹；子结果输入原样保留，不能用最新哈希覆盖漂移。

以下描述本轮状态计数与可建议的重审目标来源，不是自动重试循环；显式 scope 始终优先，范围外 dirty/unknown 保留待负责人决定。

dirty_count/M 只计独立 reviewer 确认有真实内容、明显不合理特征、必要连续性或读板阻塞的去重 cards，不计无影响的细节、色彩、布局或机位建议。纯偏好不进入修复意见/dirty；若 single 把建议误列 blocker，交原 reviewer 澄清，汇总者不改判。证据当前且可用 pass 即停止该目标质量循环，不因追求精确复刻或完美反复重生；可选精修仅在用户要求或新需求出现时考虑。unknown 单列，不能当可用，也不能转成重生指令。

## Round 收敛协议

```json
{
  "terminal": {"dirty_count": 0, "unknown_count": 0},
  "retry_scope_sources": ["dirty", "unknown"],
  "deduplicate_by": "card_path"
}
```

## Round 输出

第 1 轮 Write；后续 Edit append，保留未完成历史轮。按共享规则先写 scope 开工块，结束更新同一 evidence，核对每目标恰好一个 result 再加唯一 footer。写后 Read 自检。M 为去重 dirty cards，K 为无法判定 cards。heading 使用：

```text
## 第 {N} 轮 ({timestamp}) - 通过
## 第 {N} 轮 ({timestamp}) - 无法判定 ({K} 项)
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

无对应内容的 section 可省略；每个完成轮必须有完整 evidence 和 footer，不能只有上述模板。返回 `pass`、`unknown {K}`、`needs_revision {M}` 或 `needs_revision {M} {K}_unknown`，不替修复者调度工作。

## 连续性影响评估 Handoff

以下是结果消费者的记录约定，不规定调用顺序或修复链。

## Impact Round 合同

```json
{
  "affected_write": "assigned findings only",
  "mutate_closed_pass": false,
  "clean_statuses": ["no_dependency", "unaffected"],
  "clean_write": "findings only; no material pass",
  "clean_record": "exact JSON with reason",
  "clean_dirty_count": 0,
  "repair_owner": "production Director",
  "unknown_action": "stop assessment; report blocker"
}
```

生产 Director 可把“新上游是否破坏直接下游声明的继承关系”委托新独立 Director context，附当前配对、严格读取范围和结果形状，由 reviewer 选择方法。aggregate 不自行发起修复、enqueue、传播或其他 reviewer 记录写入。

受托汇总时在自己的本轮 `### 连续性影响评估` 保留 exact JSON 和 reason。`affected` 是具体 findings，可供修复者消费为 `card|image|impact|{fix_direction}` 与 `card|image` dirty；不能改已关闭 pass。`no_dependency` / `unaffected` 不进 dirty，也不产生 material pass 或覆盖现有 unknown/失败。

Impact 的 `unknown` 为评估失败形状，只有 upstream/downstream/status/reason。生产 Director 停止该次影响评估并报告阻塞；aggregate 保留原始失败于无法判定，不转 affected dirty，不提出据此重生，不续签 material pass。空响应或非法结果同样处理。

Impact 结论不是完整 sheet-visual result；需要续签材料验收时，由受托独立 reviewer 以当前 scope 和真实输入完成评估，按共享证据规则另开轮。生产 Director 决定最小修正和必要重审。首次生成无“新上游替换旧上游”的影响传播，不做无依据链式评估。
