# Short Mode: repair-story

集数固定 `ep01`，不调用 series-only writer/update-records。

## 恢复顺序

```text
outline → script → 基础资产卡 → 基础资产图片 → storyboard → sheet.md → sheet.png → visual review
```

按第一个失败节点恢复，且不得跳过下列前置节点：

1. `script:missing|incomplete`：使用 Skill tool 调用 `scriptwriter-script` skill，参数 `short ep01`；再使用 Skill tool 调用 `director-review-script` skill，参数 `short ep01`。Needs_revision 时使用 Skill tool 调用 `scriptwriter-fix-script` skill，参数 `short ep01`；再使用 Skill tool 调用 `director-review-script` skill，参数 `short ep01`，共享 `fix_attempts=2`。
2. `asset-list:missing`：使用 Skill tool 调用 `scriptwriter-script` skill，参数 `short ep01`；再使用 Skill tool 调用 `director-review-script` skill，参数 `short ep01`。Needs_revision 时使用 Skill tool 调用 `scriptwriter-fix-script` skill，参数 `short ep01`；再使用 Skill tool 调用 `director-review-script` skill，参数 `short ep01`，共享 `fix_attempts=2`。清单恢复后使用 Skill tool 调用 `creator-create-assets` skill，参数 `ep01`，然后才进入基础资产图片恢复。
3. `assets:missing`：使用 Skill tool 调用 `creator-create-assets` skill，参数 `ep01`。资产卡补齐后才进入基础资产图片恢复。

- basic visual recovery：图像模型 `none` 时 skipped。否则使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 basic`；读取 `successful asset paths`，仅非空时使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings ep01 {successful_asset_paths...}`。Needs_revision 时使用 Skill tool 调用 `creator-fix-asset-image` skill，参数 `story/episodes/ep01/.review-basic-assets-visual.md ep01`；读取其 `successful asset paths`，仅非空时使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings ep01 {successful_fixed_asset_paths...}`；共享 `fix_attempts=2`。
- storyboard recovery：使用 Skill tool 调用 `storyboarder-storyboard` skill并 review；随后生成 sheet cards/prompt，调用 `creator-generate-images ep01 storyboard-sheets`，再按 successful shots scoped visual 规则审核。

- `storyboard-sheet-prompt-review:missing|needs_revision`：使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill，参数 `ep01`；prompt-fix owner 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill，参数 `ep01`（review mode），最多 2 轮。
- visual missing recovery：使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`。补图全部完成后 Glob 全部现有 canonical cards 得 `all_canonical_sheet_shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {all_canonical_sheet_shots...}`。这是首次视觉审核，不能只审本次 successful。
- visual needs_revision recovery：dirty 时使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill，参数 `ep01 {review_path} {shots...}`；读取 `successful_shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`；aggregate 自动合并 `previous dirty + previous unknown`。最多 2 轮。

- prompt owner loop：读取 `orchestrator handoff`，共享 `fix_attempts=2`。按序执行：`upstream-storyboard` 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，再使用 Skill tool 调用 `director-review-storyboard` skill；`generator` 使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill（集合变化 full，否则 incremental）；`prompt-fix` 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill（review mode）；最后使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill。每轮更新 handoff。
- Owner loop 收集实际修改的 `changed_card_paths`。图像模型启用时，无论旧 PNG 存在或缺失，都使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {changed_card_paths...}`。读取 `successful shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`；随后使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `ep01 {successful_shot}`。图像模型 `none` 时跳过图片、visual 和 impact。
- 补图或重生后读取 `successful shots`，仅非空时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`。
- generator summary routing：解析 `mode/created/updated/deleted` 与 `renumbered`。`created + updated` 只形成仍存在的 `existing_changed_card_paths`，先使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {existing_changed_card_paths...}`。有 `deleted`、`mode=full` 或 `renumbered` 时，随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`。`deleted cards never enter paths`。合并实际 `successful shots union` 后 scoped visual review，再 impact。

图像模型 `none` 时基础资产图片、sheet.png、visual review 和 impact 均报告 `skipped` 成功终态；仍创建并审核全部 sheet.md。
