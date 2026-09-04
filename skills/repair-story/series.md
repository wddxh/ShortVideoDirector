# Series Mode: repair-story

## 集数

指定 `$ARGUMENTS[0]`，否则使用 `latest-episode.sh`。无集目录时提示先运行 `/series-video`。大纲缺失时不能自动恢复剧情方向。

## 恢复顺序

始终按真实依赖排序恢复：

```text
outline → novel → script → 基础资产卡 → 基础资产图片 → storyboard → sheet.md → sheet.png → visual review
```

1. 小说/剧本缺失时按需执行：
   - 使用 Skill tool 调用 `writer-novel` skill。
   - 使用 Skill tool 调用 `director-review-novel` skill。
   - 使用 Skill tool 调用 `scriptwriter-script` skill。
   - 使用 Skill tool 调用 `director-review-script` skill。
2. 基础资产卡缺失时使用 Skill tool 调用 `creator-create-assets` skill。非 ep01 再使用 Skill tool 调用 `creator-update-records` skill。
3. basic visual recovery：图像模型 `none` 时 skipped。否则使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} basic`；读取 `successful asset paths`，仅非空时使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings {ep} {successful_asset_paths...}`。Needs_revision 时使用 Skill tool 调用 `creator-fix-asset-image` skill，参数 `story/episodes/{ep}/.review-basic-assets-visual.md {ep}`；读取其 `successful asset paths`，仅非空时使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings {ep} {successful_fixed_asset_paths...}`；共享 `fix_attempts=2`。
4. storyboard recovery：Storyboard 缺失或不完整时使用 Skill tool 调用 `storyboarder-storyboard` skill。再使用 Skill tool 调用 `director-review-storyboard` skill。
5. sheet.md 缺失、不 canonical 或 metadata 不符时使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，参数 `{ep} full`。再使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill；按 owner 顺序修复，最多 2 轮。
6. sheet.png 缺失时使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} storyboard-sheets`。读取 successful shots，并按下方 scoped visual 规则审核，最多 2 轮修复。

- `storyboard-sheet-prompt-review:missing|needs_revision`：使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill，参数 `{ep}`；prompt-fix owner 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill，参数 `{ep}`（review mode），最多 2 轮。
- visual missing recovery：使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} storyboard-sheets`。补图全部完成后 Glob 全部现有 canonical cards 得 `all_canonical_sheet_shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `{ep} {all_canonical_sheet_shots...}`。这是首次视觉审核，不能只审本次 successful。
- visual needs_revision recovery：dirty 时使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill，参数 `{ep} {review_path} {shots...}`；读取 `successful_shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `{ep} {successful_shots...}`；aggregate 自动合并 `previous dirty + previous unknown`。最多 2 轮。

- prompt owner loop：读取 `orchestrator handoff`，共享 `fix_attempts=2`。按序执行：`upstream-storyboard` 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，再使用 Skill tool 调用 `director-review-storyboard` skill；`generator` 使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill（集合变化 full，否则 incremental）；`prompt-fix` 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill（review mode）；最后使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill。每轮更新 handoff。
- Owner loop 收集实际修改的 `changed_card_paths`。图像模型启用时，无论旧 PNG 存在或缺失，都使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {changed_card_paths...}`。读取 `successful shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `{ep} {successful_shots...}`；随后使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `{ep} {successful_shot}`。图像模型 `none` 时跳过图片、visual 和 impact。
- 补图或重生后读取 `successful shots`，仅非空时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `{ep} {successful_shots...}`。
- generator summary routing：解析 `mode/created/updated/deleted` 与 `renumbered`。`created + updated` 只形成仍存在的 `existing_changed_card_paths`，先使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {existing_changed_card_paths...}`。有 `deleted`、`mode=full` 或 `renumbered` 时，随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} storyboard-sheets`。`deleted cards never enter paths`。合并实际 `successful shots union` 后 scoped visual review，再 impact。

图像模型 `none` 时步骤 3 基础图、步骤 6 sheet.png 与 visual review 均以 `skipped` 成功终态报告；sheet.md 与 prompt review 仍必须完成，不执行 impact。

恢复链只从首个失败节点开始，但不得跨过其上游。首次补齐整批 sheet 不做 impact。
