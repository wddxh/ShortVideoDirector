# Series Mode: edit-story

从 `$ARGUMENTS` 解析单个 ep；未指定时澄清。跨多集、arc 或 config 修改不在此流程。

## Sheet 影响规则

- Storyboard changed/added/deleted/renumbered shots：只重建真实受影响 card；编号集合变化用 `full`，否则用 `incremental {shots}`。
- 基础资产卡或 PNG 变化：只重建直接引用该资产的 sheets。
- Sheet card 的 panel/prompt 变化：只重建当前 sheet PNG。
- 先形成当前 dirty batch 并全部重生；只有直接依赖者位于 dirty batch 外，才使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill。`unaffected` 停止传播；`affected` 按标准 handoff 修复并向其直接依赖继续。
- submitted/done 视频不自动重提。

执行顺序：上游文本与 review → 基础资产卡 → 基础资产图/basic review → storyboard/review → sheet card/prompt review → sheet PNG/visual review → dirty batch 外 impact。

调用使用标准句式：使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill；使用 Skill tool 调用 `creator-generate-images` skill；使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill。

图像模型 `none` 时 card/prompt review 仍执行，图片、visual 和 impact 报告 `skipped`。
