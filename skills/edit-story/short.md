# Short Mode: edit-story

集数固定 `ep01`。跨集、arc 或 config 修改不在此流程。

## Sheet 影响规则

Storyboard 变化只重建 changed/added/deleted/renumbered shots；基础资产变化只重建直接引用 sheets；panel/prompt 变化只重建本 sheet。先完成整个 dirty batch，只有其外部直接依赖者才执行 impact review。`unaffected` 停止，`affected` 修复后逐层评估。

顺序为基础资产卡/图 → storyboard/review → sheet card/prompt review → sheet PNG/visual review → dirty batch 外 impact。submitted/done 视频保持保护。

图像模型 `none` 时 sheet card 与 prompt review 仍完成；图片、visual、impact 以 `skipped` 终态报告。
