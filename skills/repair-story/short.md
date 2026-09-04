# Short Mode: repair-story

集数固定 `ep01`，不调用 series-only writer/update-records。

## 恢复顺序

```text
outline → script → 基础资产卡 → 基础资产图片 → storyboard → sheet.md → sheet.png → visual review
```

按第一个失败节点恢复：使用 Skill tool 调用 `scriptwriter-script` skill；使用 Skill tool 调用 `creator-create-assets` skill；使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 basic`；使用 Skill tool 调用 `storyboarder-storyboard` skill并 review；使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，参数 `ep01 full`，再做 prompt owner loop；随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`。Sheet 生图后按 successful shots scoped visual 规则审核。所有 review 最多修复 2 轮。

- `storyboard-sheet-prompt-review:missing|needs_revision`：使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill，参数 `ep01`；prompt-fix owner 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill，参数 `ep01`（review mode），最多 2 轮。
- `storyboard-sheet-visual-review:missing|needs_revision`：图片完整时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01`；dirty 使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill，参数 `ep01 {review_path} {shots...}`，最多 2 轮。

- prompt owner loop：读取 `orchestrator handoff`，共享 `fix_attempts=2`。按序执行：`upstream-storyboard` 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，再使用 Skill tool 调用 `director-review-storyboard` skill；`generator` 使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill（集合变化 full，否则 incremental）；`prompt-fix` 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill（review mode）；最后使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill。每轮更新 handoff。
- 补图或重生后读取 `successful shots`，仅非空时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`。

图像模型 `none` 时基础资产图片、sheet.png、visual review 和 impact 均报告 `skipped` 成功终态；仍创建并审核全部 sheet.md。
