# short mode: pipeline

适用：单集短视频（无系列规划，无 arc，无 novel，无 update-records）。固定 ep='ep01'。

## 调用链

每步使用 Skill tool 调用对应 skill, 显式传 mode / ep 参数。除 review-* 步骤外, 任一步失败立即停止并向用户报告; review-* 步骤按下方"review 循环 (通用模式)"处理。

## review 循环 (通用模式, 适用所有 review-* 步骤)

每个 review-* 步骤最多 fix 2 次。**main session 自己维护 fix 计数 (fix_attempts)**, 不要依赖 review 文件的"第 N 轮"编号——那是 review skill 内部调用次数计数 (每次 review 调用 +1), 与 fix 次数无关。

1. 使用 Skill tool 调用 <review-skill> (initial review) → 追加到 `.review-<type>.md`
2. 读 `.review-<type>.md` 最后一段结论:
   - "pass" → 进入下一 Step
   - "needs_revision" → 进入修复循环 (fix_attempts 从 1 开始)

修复循环:

**第 1 次** (fix_attempts=1):
- a. 使用 Skill tool 调用 <fix-skill> (传 `.review-<type>.md` 路径)
- b. 使用 Skill tool 调用 <review-skill> → 追加新一段到 `.review-<type>.md`
- c. 读最新结论:
  - pass → 跳出循环, 进入下一 Step
  - needs_revision → 进入第 2 次

**第 2 次** (fix_attempts=2):
- a. 使用 Skill tool 调用 <fix-skill>
- b. 使用 Skill tool 调用 <review-skill> → 追加新一段
- c. 读最新结论:
  - pass → 跳出循环, 进入下一 Step
  - needs_revision → main session 直接 print:
    > ⚠️ <ep> <step name> 已尝试 2 次修复后仍未通过, 剩余问题:
    > <从 .review-<type>.md 最后一段摘要>
    > 已自动跳过, 继续下一步 (使用已有的 outline / assets / keyframes 等产物)。可用 /edit-story 手动修订。
    然后跳出循环, 进入下一 Step

**绝不问用户**: 跳过不需要用户确认; print 警告后直接进入下一 Step (使用已有产物, 不阻断 pipeline)。

### review → fix skill 映射

| review skill | fix skill |
|---|---|
| director-review-outline | director-fix-outline |
| director-review-script | scriptwriter-fix-script |
| director-review-storyboard | storyboarder-fix-storyboard |
| director-review-assets-visual | creator-fix-asset-image |

### Phase A: 剧情确定
1. **director-plot-options** — mode='short'，action='generate'（无 arc，单集自闭合剧情）。子代理自己落盘到 `story/plot-options.md`（含末尾 sentinel `<!-- 候选列表结束，等待用户选定 -->`），prompt 只返回 3 候选标题摘要。
   - main session 收到摘要后 Read `story/plot-options.md` → 完整呈现 3 候选给用户 → 问"选定 A/B/C 或提修改意见？"
   - 用户回复 modify + target_option → 重派 director-plot-options，action='modify'，target_option=X，modification=<用户文本>，previous_options_path=`story/plot-options.md`。重复直到用户选定。
   - 用户选定（如 A）→ main session 用 Edit 把 "## 用户已选定方向\n\n> 选定方向：选项 A —《<主题名称>》\n\n后续 director-input-confirm / director-outline 等步骤均基于本方向展开。\n" 块**插在 sentinel 之前**（anchor=`<!-- 候选列表结束，等待用户选定 -->`）。
2. **director-input-confirm** — 结构化确认用户输入

### Phase B: 本集大纲 & 剧本
3. **director-outline** — mode='short', ep='ep01'
4. **director-review-outline**
5. 跳过 writer-novel（short 模式无小说原文）
6. **scriptwriter-script** — mode='short', ep='ep01'（直接基于 outline，无 novel 输入）
7. **director-review-script**

### Phase C: 资产 (角色/场景/物品/建筑)
8. **creator-create-assets** — ep='ep01'，登记本集新资产
9. **creator-generate-images** — 为 character / location / item / building 资产生成图片
10. **director-review-assets-visual** — `--type=characters,locations,items,buildings`
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase D: 分镜 & 关键帧
11. **storyboarder-storyboard** — ep='ep01'
12. **director-review-storyboard**
13. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
14. **creator-generate-images** — 为 keyframes 生成图片
15. **director-review-assets-visual** — `--type=keyframes`
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase E: 视频生成
16. **creator-video-dreamina** — 派发本集所有镜头到即梦 multimodal2video，pending → submitted/failed 状态转移

## 完成
所有步骤通过后，向用户报告：
- 集号 ep01
- 各阶段产物路径 (outline / script / storyboard / 资产清单)
- video tasks.json 路径
- 提示用户后续用 `/check-video ep01` 或 `/auto-video ep01` 跟踪视频任务
