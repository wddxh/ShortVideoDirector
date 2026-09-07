---
name: director-review-storyboard-sheet-impact
description: Use when a regenerated storyboard sheet may invalidate the direct next sheet's declared visual continuity.
user-invocable: false
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

# Review Direct Storyboard Sheet Impact

## 输入与严格边界

- 委托明确 ep、新生成 upstream canonical `shotNN`、直接下游兼容性审核 outcome 与读取边界，不设位置参数协议。
- 必读共享 review-meta-rules/output-language；委托提供已确认输出语言，只在独立新 Director review context 中执行。不支持嵌套时由主 AI 忠实 relay，把原始结果返回原生产 Director；不能在生产者上下文自审。
- 只读新 upstream card 和 PNG，以及数字上直接 N+1 downstream card。先读 downstream card 的 `## 连续性参考`。
- downstream 不存在，或没有显式 previous 指向 upstream：返回 `no_dependency`；此时不读 downstream PNG。
- 有显式 previous 时，再读 downstream PNG。除这两张 card/PNG 和共享规则外不读 sibling、旧图、storyboard 或 review。按共享规则在阅读前和结束后 fingerprint 实际项目输入；输入漂移、读取失败、看不到图片或隔离不可用时返回下方 unknown JSON。
- 业务文件严格只读；不写 review，不修改 card，不删图，不生图，不 dispatch。Bash 只可调用现有只读脚本、执行检查或做临时验证，不得写、改、删业务产物。

## Director 判断

对声明继承的尺度、角度与姿态，应用共享 `review-meta-rules.md` 的“数值与姿态的可用性判断”；无实质影响的差异为 unaffected，不据此扩展读取范围或要求精确复制上游姿态。

仅依据 downstream 明确声明继承的元素，语义判断当前 downstream 是否仍兼容新 upstream。不要机械匹配服装、姿态、光线、标签等关键词，不把构图微调、边框变化、轻微英文错字或未声明继承的变化判为 affected。

重点看继承状态是否仍可读且衔接：例如左手持物、进入方向或已声明光线关系有无真实冲突。整板画布可不同，panel 内视频画面与声明状态才是相应判断对象；不同网格或构图本身不证明连续性失败。本配对评估不验证完整生成设置/receipt，也不扩大读取范围代替整板验收。

实际看过所需配对且证据当前，声明继承仍满足剧情与必要连续性时返回 `unaffected`；无影响的细节、色彩、布局或机位差异不进 affected/dirty，也不建议为精确复刻上游而重生。用户明确的关键继承设计仍须核对；身份错接、关键持有物丢失或空间动作冲突造成真实断裂时仍为 affected。可用兼容即停止该影响分支，不追求完美；缺必要图/参考或证据漂移仍为 unknown，不能猜测兼容。

- `no_dependency`：没有 direct declared previous。
- `unaffected`：存在 declared previous，但当前 downstream 与新 upstream 对声明元素仍兼容。
- `affected`：声明继承的可见状态发生具体不兼容，现有 downstream 会造成连续性断裂。

只给结论与最小 fix direction；不执行修复。`no_dependency` 和 `unaffected` 的 `fix_direction` 必须是空字符串；`affected` 必须非空。

这三个 status 仅为影响 findings，不是六类材料的验收状态，不写另一 reviewer 的 pass，不续签材料证据，不发起修复链。所检查的配对及输入指纹随 task 证据保留，供原 Director 决定后续评估。

## 输出

成功完成语义判断时只返回以下 exact JSON，不包 markdown，不增加字段：

```json
{
  "upstream": "shot01",
  "downstream": "shot02",
  "status": "affected",
  "reason": "声明继承的具体元素与新上游不兼容",
  "fix_direction": "让下游进入状态对齐新上游的可见结束状态"
}
```

status 枚举严格为 `no_dependency|unaffected|affected`。upstream/downstream 使用 canonical `shotNN`；reason 必须明确且非空。

无法完成评估是独立失败形状，不属于上述三个语义结论；不提供 fix_direction：

```json
{"upstream":"shot01","downstream":"shot02","status":"unknown","reason":"无法读取 downstream PNG，连续性评估未完成"}
```

生产 Director 收到 unknown、空响应或非法结果时停止该次影响评估，保留阻塞并请求可用输入/独立重评；不能解释为 affected、unaffected 或 no_dependency，也不能据此启动修复或续签验收。只有确知 downstream 不存在才能判 no_dependency，读取/权限失败不是不存在。
