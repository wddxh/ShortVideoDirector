# Short Mode: repair-story

集数固定 `ep01`，不调用 series-only writer/update-records。

## 恢复顺序

```text
outline → script → 基础资产卡 → 基础资产图片 → storyboard → sheet.md → sheet.png → visual review
```

按第一个失败节点恢复。使用 Skill tool 调用 `scriptwriter-script` skill；使用 Skill tool 调用 `creator-create-assets` skill；使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 basic`；使用 Skill tool 调用 `storyboarder-storyboard` skill；使用 Skill tool 调用 `director-review-storyboard` skill；使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill，参数 `ep01 full`；使用 Skill tool 调用 `director-review-storyboard-sheet-prompts` skill；使用 Skill tool 调用 `creator-generate-images` skill，参数 `ep01 storyboard-sheets`；使用 Skill tool 调用 `director-review-storyboard-sheets-visual` skill。所有 review 最多修复 2 轮。

图像模型 `none` 时基础资产图片、sheet.png、visual review 和 impact 均报告 `skipped` 成功终态；仍创建并审核全部 sheet.md。
