# Series Mode: edit-story

从 `$ARGUMENTS` 解析单个 ep；未指定时澄清。跨多集、arc 或 config 修改不在此流程。

## 可执行入口表

| 节点 | 入口条件 | 下游起点 |
|---|---|---|
| outline | 本集大纲变化 | novel |
| novel | 小说变化 | script |
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
| outline | `director-fix-outline` + `director-review-outline`; mode, ep, review, extra instructions |
| novel | `writer-fix-novel` + `director-review-novel`; ep |
| script | `scriptwriter-fix-script` + `director-review-script`; mode, ep, review, extra instructions |
| base-asset-card | `creator-fix-asset` + prompt review; asset path, ep basic |
| base-asset-image | image router + basic visual review; ep paths assets |
| storyboard | storyboard fix + review; ep |
| sheet-prompt | card generator + prompt review/fix; ep full/incremental |
| sheet-image | image router + sheet visual review/fix; ep paths cards |
| impact | direct impact reviewer; ep upstream shot |

按入口执行需要的下列标准调用，不在影响清单中的节点跳过：

- outline review mode map: `ep01=new-series`; `ep02+=continue-series`。
- script mode 使用同一映射：`ep01=new-series`; `ep02+=continue-series`。
- 使用 Skill tool 调用 `director-fix-outline` skill，传 mode=series、ep、review path、extra instructions。随后使用 Skill tool 调用 `director-review-outline` skill，参数 `{outline_review_mode} {ep}`。
- 使用 Skill tool 调用 `writer-fix-novel` skill，参数 `{ep} --direct {target} {instruction}`。随后使用 Skill tool 调用 `director-review-novel` skill，参数 `{ep}`。
- 使用 Skill tool 调用 `scriptwriter-fix-script` skill，参数 `{script_mode} {ep} --direct {target} {instruction}`。随后使用 Skill tool 调用 `director-review-script` skill，参数 `{script_mode} {ep}`。
- Outline/novel/script 修改后重新读取终态资产清单；存在新增且缺失的资产卡时，先使用 Skill tool 调用 `creator-create-assets` skill，参数 `{ep}`。非 ep01 随后使用 Skill tool 调用 `creator-update-records` skill，参数 `{ep}`。只有已存在且被直接修改的卡才使用 `creator-fix-asset`。
- 使用 Skill tool 调用 `creator-fix-asset` skill，参数 `{asset_path} {意见}`。随后使用 Skill tool 调用 `director-review-asset-prompts` skill，参数 `{ep} basic {asset_path}`。
- 使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {asset_paths...}`。随后使用 Skill tool 调用 `director-review-assets-visual` skill，参数 `--type=characters,locations,items,buildings {ep}`。
- 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，参数 `{ep} --direct {target} {instruction}`。随后使用 Skill tool 调用 `director-review-storyboard` skill，参数 `{ep}`。
- 对 visual dirty 使用 Skill tool 调用 `creator-fix-storyboard-sheet-image` skill，参数 `{ep} {review_path} {shots...}`。
- 使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `{ep} {upstream_shot}`。

- direct sheet sequence: 使用 Skill tool 调用 `creator-fix-storyboard-sheet-prompt` skill，参数 `{ep} --direct {card} {instruction}`；使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill 并按 owner loop；通过后使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {card}`。
- storyboard sequence: 使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，参数 `{ep} incremental {shots...}`（集合变化用 full）；随后使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill 并按 owner loop。收集 generator/fix 实际写入的 `actual_changed_card_paths`；通过后使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {actual_changed_card_paths...}`。读取 `successful shots`，使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `{ep} {successful_shots...}`；随后使用 Skill tool 调用 `director-review-storyboard-sheet-impact` skill，参数 `{ep} {successful_shot}`。
- asset sheet sequence: 基础资产成功重生后，读取直接引用 cards，使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {direct_card_paths...}`。
- 每次重生读取 router 的 `successful shots`；仅非空时使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill，参数 `{ep} {successful_shots...}`。Impact 也只从实际成功 shots 开始。
- generator summary routing：解析 `mode/created/updated/deleted` 及 storyboard fixer 的 `renumbered`。`created + updated` 仅映射仍存在的 `existing_changed_card_paths`，先使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} paths {existing_changed_card_paths...}`。有 `deleted`、`mode=full` 或 `renumbered` 时，随后使用 Skill tool 调用 `creator-generate-images` skill，参数 `{ep} storyboard-sheets`，清 orphan 并补 created。`deleted cards never enter paths`。合并两次实际 `successful shots union` 后 scoped visual review，再 impact。

Storyboard 变化只重建真实 changed/added/deleted/renumbered shots；编号集合变化用 `full`。基础资产变化只重建直接引用 sheets；panel/prompt 变化只重建当前 sheet。先完成整个 dirty batch，只有 batch 外直接依赖者才 impact；`unaffected` 停止，`affected` 修复后逐层传播。submitted/done 视频不自动重提。图像模型 `none` 时 card/prompt review 仍执行，图片、visual、impact 报告 `skipped`。
