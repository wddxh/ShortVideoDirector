# Short Mode: edit-story

集数固定 `ep01`。跨集、arc 或 config 修改不在此流程。

## 可执行入口表

| 节点 | 入口条件 | 下游起点 |
|---|---|---|
| outline | 本集大纲变化 | script |
| script | 剧本变化 | base-asset-card |
| base-asset-card | 基础资产卡变化 | base-asset-image |
| base-asset-image | 基础资产图变化 | storyboard |
| storyboard | shot 内容或编号变化 | sheet-prompt |
| sheet-prompt | card/panel/prompt 变化 | sheet-image |
| sheet-image | sheet PNG 变化 | impact |
| impact | dirty batch 外直接依赖 | 逐层评估 |

## 节点路由表

| 节点 | 可执行路由与参数 |
|---|---|
| outline | outline fix + review; mode=short, ep01, review, extra instructions |
| script | script fix + review; mode=short, ep01, review, extra instructions |
| base-asset-card | asset fix + prompt review; asset path, ep01 basic |
| base-asset-image | image router + basic visual review; ep01 paths assets |
| storyboard | storyboard fix + review; ep01 |
| sheet-prompt | card generator + prompt review/fix; ep01 full/incremental |
| sheet-image | image router + sheet visual review/fix; ep01 paths cards |
| impact | direct impact reviewer; ep01 upstream shot |

按入口执行需要的下列标准调用，不在影响清单中的节点跳过：

- 使用 Skill tool 调用 `director-fix-outline` skill，传 mode=short、ep01、review path、extra instructions。随后使用 Skill tool 调用 `director-review-outline` skill，参数 `short ep01`。
- 使用 Skill tool 调用 `scriptwriter-fix-script` skill，参数 `short ep01 --direct {target} {instruction}`。随后使用 Skill tool 调用 `director-review-script` skill，参数 `short ep01`。
- Outline/script 修改后重新读取终态资产清单；存在新增且缺失的资产卡时，先使用 Skill tool 调用 `creator-create-assets` skill，参数 `ep01`。只有已存在且被直接修改的卡才使用 `creator-fix-asset`。
- existing asset review closure：使用 Skill tool 调用 `creator-fix-asset` skill，参数 `{asset_path} {意见}`。随后使用 Skill tool 调用 `director-review-asset-prompts` skill，参数 `ep01 basic {asset_path}`。
- existing asset review closure：prompt needs_revision 时使用 Skill tool 调用 `creator-fix-asset` skill，参数 `{asset_path} story/episodes/ep01/.review-asset-prompts.md`；再使用 Skill tool 调用 `director-review-asset-prompts` skill，参数 `ep01 basic {asset_path}`，通过后才生图。使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {asset_path}`；读取 `successful asset paths`，仅非空时使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings ep01 {successful_asset_paths...}`。Visual needs_revision 时使用 Skill tool 调用 `creator-fix-asset-image` skill，参数 `story/episodes/ep01/.review-basic-assets-visual.md ep01`；读取 `successful asset paths` 为 `{successful_fixed_asset_paths...}`，仅非空时使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings ep01 {successful_fixed_asset_paths...}`。
- 两层 review 各自共享 `fix_attempts=2`；prompt 仍未通过则 `stop_before_image`，visual 仍未通过则 `stop_before_direct_sheets`。
- 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，参数 `ep01 --direct {target} {instruction}`。随后使用 Skill tool 调用 `director-review-storyboard` skill，参数 `ep01`。
- 对 visual dirty 使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill，参数 `ep01 {review_path} {shots...}`。
- 使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `ep01 {upstream_shot}`。

- direct sheet sequence: 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill，参数 `ep01 --direct {card} {instruction}`；使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill并按 owner loop；通过后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {card}`。
- storyboard sequence: 使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，参数 `ep01 incremental {shots...}`（集合变化用 full）；随后使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill并按 owner loop。收集 generator/fix 实际写入的 `actual_changed_card_paths`；通过后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {actual_changed_card_paths...}`。读取 `successful shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`；随后使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `ep01 {successful_shot}`。
- asset sheet sequence: 基础资产成功重生后，读取直接引用 cards，使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {direct_card_paths...}`。
- 每次重生读取 router 的 `successful shots`；仅非空时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `ep01 {successful_shots...}`。Impact 也只从实际成功 shots 开始。
- generator summary routing：解析 `mode/created/updated/deleted` 及 storyboard fixer 的 `renumbered`。`created + updated` 仅映射仍存在的 `existing_changed_card_paths`，先使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 paths {existing_changed_card_paths...}`。有 `deleted`、`mode=full` 或 `renumbered` 时，随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`，清 orphan 并补 created。`deleted cards never enter paths`。合并两次实际 `successful shots union` 后 scoped visual review，再 impact。

Storyboard 变化只重建真实 changed/added/deleted/renumbered shots；编号集合变化用 `full`。基础资产变化只重建直接引用 sheets；panel/prompt 变化只重建当前 sheet。先完成整个 dirty batch，只评估 batch 外直接依赖；`unaffected` 停止，`affected` 修复后逐层传播。submitted/done 视频保持保护。图像模型 `none` 时 card/prompt review 仍执行，图片、visual、impact 报告 `skipped`。
