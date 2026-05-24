# continue-series mode: pipeline

适用：用户在已有系列上续写新一集（ep0X，X ≥ 2，或系列已规划但本集尚未生成）。跳过系列规划阶段。

## 前置条件
- `story/arc.md` 已存在（系列规划已完成）
- 上一集的产物（outline / novel / script / storyboard / 资产）已落盘

## 调用链

每步使用 Skill tool 调用对应 skill, 显式传 mode / ep 参数。除 review-* 步骤外, 任一步失败按下方"子代理任务失败时的重试规则"处理 (自动重试最多 3 次, 4 次仍失败则中断 pipeline); review-* 步骤按下方"review 循环 (通用模式)"处理 review 结论 (本规则同样适用于 review-* / fix-* 的 task 派发本身, 即技术故障层重试)。

## 子代理任务失败时的重试规则 (通用模式, 适用所有 task 派发)

当主 session 通过 `task` 工具派发子代理任务**返回 error** (而非 result) 时, 视为任务失败 (含 stream timeout / chunkTimeout abort / network / rate-limit / provider 5xx 等技术故障)。

**自动重试**: main session 维护 `task_attempts` 计数器, 初次调用为 attempt 1。

- attempt 1 (initial) 失败 → 立即重派 → 进入 attempt 2 (retry 1)
- attempt 2 (retry 1) 失败 → 立即重派 → 进入 attempt 3 (retry 2)
- attempt 3 (retry 2) 失败 → 立即重派 → 进入 attempt 4 (retry 3)
- attempt 4 (retry 3) 失败 → **中断 pipeline** (不再派发后续任何 step)

**重派要求**: 使用**完全相同**的 `task` 参数 (同 subagent_type, 同 prompt, 同 description), 不修改、不缩短、不换路径、不问用户、不打折扣。

**中断 pipeline 行为**: main session 直接 print:
> ❌ <ep> <step name> 子代理任务连续 4 次失败 (3 次自动重试均未成功)
> 最后一次错误: <error 摘要>
> Pipeline 已中断。请检查日志, 修复问题后用 /series-repair-story <ep> 续跑。

print 后立即返回, **不再派发任何后续 step**, 不再调用 review / fix / Phase X 任何后续逻辑。

**用户主动 cancel** (按 Esc 等) 不算 task 失败, 不触发重试, 直接 abort 整个 pipeline。

**与 review 循环的关系**: 本规则适用于**所有** task 派发, 包括 review-* 和 fix-* skill 的派发本身。即 review skill 子代理因技术故障失败时也走本规则的 3 次重试; 重试成功后再按下方"review 循环"段处理 review 结论 (pass / needs_revision)。两套规则正交: 本规则管"task 调用是否技术上成功", review 循环管"内容质量是否达标"。

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
| director-review-novel | writer-fix-novel |
| director-review-script | scriptwriter-fix-script |
| director-review-storyboard | storyboarder-fix-storyboard |
| director-review-assets-visual | creator-fix-asset-image |
| director-review-asset-prompts | creator-fix-asset |

### Phase A: 上下文加载（必做）
1. **必读 `story/arc.md`** — 获取系列阶段规划与本集在弧线中的位置
2. 跳过 director-plot-options / director-input-confirm / director-arc / director-review-arc

### Phase B: 本集大纲 & 文本
3. **director-outline** — mode='continue-series', ep='ep0X'
4. **director-review-outline**
5. **writer-novel** — ep='ep0X'
6. **director-review-novel**
7. **scriptwriter-script** — mode='continue-series', ep='ep0X'
8. **director-review-script**

### Phase C: 资产 (角色/场景/物品/建筑)
9. **creator-create-assets** — ep='ep0X'，登记本集**新增**资产
10. **creator-update-records** — ep='ep0X'，为本集出场的**已有**资产追加出场记录条目（非 ep01 必做）
11. **director-review-asset-prompts** — `$ARGUMENTS[1]=basic`，审本集 character/location/item/building 资产 .md 卡的 `## 图像生成提示` 段表达 (按"review 循环 (通用模式)"处理; needs_revision → creator-fix-asset 修订 prompt section 不生图)
12. **creator-generate-images** — 为本集新增的 character / location / item / building 资产生成图片
13. **director-review-assets-visual** — `--type=characters,locations,items,buildings {ep}`（review 文件 = `story/episodes/{ep}/.review-basic-assets-visual.md`）
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase D: 分镜 & 关键帧
14. **storyboarder-storyboard** — ep='ep0X'
15. **director-review-storyboard**
16. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
17. **director-review-asset-prompts** — `$ARGUMENTS[1]=keyframes`，**仅审**本集 keyframe .md 卡的 `## 图像生成提示` 段表达 (按"review 循环 (通用模式)"处理; needs_revision → creator-fix-asset 修订 prompt 不生图)
18. **creator-generate-images** — 为 keyframes 生成图片
19. **director-review-assets-visual** — `--type=keyframes {ep}`（review 文件 = `story/episodes/{ep}/.review-keyframes-visual.md`）
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

## 完成

向用户报告：
- 集号 ep0X
- 各阶段产物路径 (outline / novel / script / storyboard / 资产清单)

视频生成不由 pipeline 自动派发，请用户手动启动：
1. **检查本集产物质量**：通读 outline / novel / script / storyboard / 资产图片（character / location / item / building / keyframe），确认无明显错漏
2. **如发现问题**：用 `/edit-story` 提出修改意见，pipeline 会按 DAG 级联修复相关产物（含资产图重生）
3. **质量确认后**：用 `/generate-video ep0X` 启动视频生成；启动后用 `/check-video ep0X` 或 `/auto-video ep0X` 跟踪任务状态
