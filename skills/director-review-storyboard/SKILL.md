---
name: director-review-storyboard
description: Director审核Storyboarder分镜的叙事、节奏、七字段契约和可生成性。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

- `story/episodes/$ARGUMENTS[0]/{outline,script,storyboard}.md`
- 本集资产清单对应的基础资产卡
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/{output-language,review-meta-rules,visual-prompt-craft-common,visual-prompt-craft-video}.md`

## 审核职责

Director 负责 storyboard 的语义 gate；Creator 后续负责 storyboard sheet panel 规划。逐项审核：

1. Storyboard 完整覆盖剧本，节奏和转场合理，对白原文与人物性格一致。
2. Shot 编号有序、唯一、连续，单 shot ≤15s，场景合计在目标时长 ±10%，并批量运行 `speech-rate.sh`。
3. 每个 shot 严格使用七字段；人物与 location/item/building 引用完整且路径有效。
4. Prose 可被单镜独立消费，明确动作过程和终态、朝向、屏幕方向、结束位置、持有状态和空间关系。
5. 视觉描述遵循共享 video prompt 规则，没有把 panel 规划写入 storyboard。

语义判断由 Director 完成，不用机械关键词代替叙事、连续性或画面质量判断。

## 输出

Append 到 `story/episodes/$ARGUMENTS[0]/.review-storyboard.md`：

```markdown
## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

或：

```markdown
## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **shot {N}：** {问题} → {方向}
```

返回 `pass` 或 `needs_revision {M}`。
