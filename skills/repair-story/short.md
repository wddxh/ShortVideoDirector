# Short Mode: repair-story

集数固定 `ep01`，不调用 series-only writer/update-records。

## 恢复顺序

```text
outline → script → 基础资产卡 → 基础资产图片 → storyboard → sheet.md → sheet.png → visual review
```

按第一个失败节点恢复：使用 Skill tool 调用 `scriptwriter-script` skill；使用 Skill tool 调用 `creator-create-assets` skill；使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 basic`；使用 Skill tool 调用 `storyboarder-storyboard` skill并 review；使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，参数 `ep01 full`，再做 prompt owner loop；随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`。Sheet 生图后按 successful shots scoped visual 规则审核。所有 review 最多修复 2 轮。

- `storyboard-sheet-prompt-review:missing|needs_revision`：使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill，参数 `ep01`；prompt-fix owner 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill，参数 `ep01`（review mode），最多 2 轮。
- visual missing recovery：使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`。补图全部完成后 Glob 全部现有 canonical cards 得 `all_canonical_sheet_shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {all_canonical_sheet_shots...}`。这是首次视觉审核，不能只审本次 successful。
- visual needs_revision recovery：dirty 时使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill，参数 `ep01 {review_path} {shots...}`；读取 `successful_shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`；aggregate 自动合并 `previous dirty + previous unknown`。最多 2 轮。

- prompt owner loop：读取 `orchestrator handoff`，共享 `fix_attempts=2`。按序执行：`upstream-storyboard` 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，再使用 Skill tool 调用 `director-review-storyboard` skill；`generator` 使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill（集合变化 full，否则 incremental）；`prompt-fix` 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill（review mode）；最后使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill。每轮更新 handoff。
- Owner loop 收集实际修改的 `changed_card_paths`。图像模型启用时，无论旧 PNG 存在或缺失，都使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {changed_card_paths...}`。读取 `successful shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`；随后使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `ep01 {successful_shot}`。图像模型 `none` 时跳过图片、visual 和 impact。
- 补图或重生后读取 `successful shots`，仅非空时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`。
- generator summary routing：解析 `mode/created/updated/deleted` 与 `renumbered`。`created + updated` 只形成仍存在的 `existing_changed_card_paths`，先使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {existing_changed_card_paths...}`。有 `deleted`、`mode=full` 或 `renumbered` 时，随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`。`deleted cards never enter paths`。合并实际 `successful shots union` 后 scoped visual review，再 impact。

图像模型 `none` 时基础资产图片、sheet.png、visual review 和 impact 均报告 `skipped` 成功终态；仍创建并审核全部 sheet.md。
