---
name: creator-generate-images
description: 按 basic、storyboard-sheets 或 paths scope 路由图片生成。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Glob, Skill, Bash
model: sonnet
---

## 动态参数

- `$ARGUMENTS[0]`：集数，如 `ep01`
- `$ARGUMENTS[1]`：scope，必须为 `basic`、`storyboard-sheets` 或 `paths`
- `$ARGUMENTS[2..]`：`paths` scope 的明确卡片路径

## 路由

1. 读取 `config.md` 的图像模型。若为 `none`，输出 `images:skipped`；对于 `storyboard-sheets` 额外输出 `storyboard-sheet-images:skipped`。
2. `basic`：从本集资产清单收集 character/location/item/building 卡，跳过已有 PNG。使用 Skill tool 调用 `creator-image-{图像模型值}` skill，参数为 `basic {卡片路径...}`。
3. `storyboard-sheets`：先调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/reconcile-storyboard-sheet-images.sh {ep}`，删除无 card 的 orphan PNG，并读取 `missing cards`。再 Glob canonical cards，使用 Skill tool 调用 `creator-image-{图像模型值}` skill，参数为 `storyboard-sheets {ep} {卡片路径...}`；existing PNG 保持 skip，missing/created 图正常生成。返回 reconcile removed 和本次实际生成成功 shots，不把 preserved/deleted 计入。
4. `paths`：只接受显式基础资产或 sheet card 路径，并按原顺序去重。协议标记：`sheet card paths: force`，targeted sheet cards 必须强制重生；`basic asset paths: caller-managed`，基础资产是否删除旧图由 edit/fix caller 决定，router 不自动删除。混合类型按类别分别执行。使用 Skill tool 调用 `creator-image-{图像模型值}` skill，参数为 `paths {卡片路径...}`。

Sheet card paths 的付费边界：验证所有 card canonical 且属于当前 ep 后，provider 层仅删除明确 target cards 的旧 PNG，再调用串行 coordinator `--force`。Provider 失败后旧图保持缺失并报告可恢复 dirty；不得删除未请求的 sheet PNG。

任何 scope 都不截断参考图。Provider 限制作为 provider 原始错误返回。

## 输出

返回 scope、成功、跳过、失败和 pending 数量；保留每个失败路径与原始原因。Sheet scope 额外返回稳定集合 `successful shots: shotNN ... | none`，只列本次实际落盘成功的 shots；caller 只能用该集合形成 visual review scope。
