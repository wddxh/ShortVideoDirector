---
name: director-review-storyboard-sheet-impact
description: Use when a regenerated storyboard sheet may invalidate the direct next sheet's declared visual continuity.
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob
model: opus
---

# Review Direct Storyboard Sheet Impact

## 输入与严格边界

- `$ARGUMENTS[0]`：ep，如 `ep01`。
- `$ARGUMENTS[1]`：新生成的 upstream canonical `shotNN`。
- 只读新 upstream card 和 PNG，以及数字上直接 N+1 downstream card。先读 downstream card 的 `## 连续性参考`。
- downstream 不存在，或没有显式 previous 指向 upstream：返回 `no_dependency`；此时不读 downstream PNG。
- 有显式 previous 时，再读 downstream PNG。除这两张 card/PNG 外不读 sibling、旧图、storyboard 或 review。
- 严格只读；不写 review，不修改 card，不删图，不生图，不 dispatch。

## Director 判断

仅依据 downstream 明确声明继承的元素，语义判断当前 downstream 是否仍兼容新 upstream。不要机械匹配服装、姿态、光线、标签等关键词，不把构图微调、边框变化、轻微英文错字或未声明继承的变化判为 affected。

- `no_dependency`：没有 direct declared previous。
- `unaffected`：存在 declared previous，但当前 downstream 与新 upstream 对声明元素仍兼容。
- `affected`：声明继承的可见状态发生具体不兼容，现有 downstream 会造成连续性断裂。

只给结论与最小 fix direction；不执行修复。`no_dependency` 和 `unaffected` 的 `fix_direction` 必须是空字符串；`affected` 必须非空。

## 输出

只返回 exact JSON，不包 markdown，不增加字段：

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
