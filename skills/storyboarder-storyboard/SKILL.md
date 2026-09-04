---
name: storyboarder-storyboard
description: 把剧本翻译为 storyboard.md（≤15s 切片、镜头语言和完整视听 prose），不规划 storyboard sheet panel。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

- `story/episodes/$ARGUMENTS[0]/script.md`
- `story/episodes/$ARGUMENTS[0]/outline.md`
- `config.md`
- 本集资产清单对应的 `assets/**/*.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-video.md`

## 动态参数

- `$ARGUMENTS[0]`：当前集数，如 `ep01`

## 职责

把剧本忠实翻译为 `story/episodes/$ARGUMENTS[0]/storyboard.md`：

1. 按视觉节拍和对白边界将每个场景拆为不超过 15 秒的 shot，场景合计保持在剧本目标时长 ±10%。
2. 为每个 shot 写固定七字段和完整的 `画面与声音描述`。
3. Prose 明确动作过程与终态、角色和道具朝向、屏幕方向、结束位置和空间关系，使每个 shot 可独立生成，也给下游连续性判断提供事实。
4. 不改剧本对白，不引入剧本未声明的基础资产，不重新分配场景节奏。
5. 不规划 panel，不创建或修改 storyboard sheet 卡片/图片。Creator 负责 sheet，Director 负责语义审核。

写入前按 rules.md 自检字段、编号、时长、对白配速和资产引用。

## 输出

使用 Write 写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`。
