# new-series mode: pipeline

适用：用户开新系列，从 ep01 开始。

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
| director-review-arc | director-fix-arc |
| director-review-outline | director-fix-outline |
| director-review-novel | writer-fix-novel |
| director-review-script | scriptwriter-fix-script |
| director-review-storyboard | storyboarder-fix-storyboard |
| director-review-assets-visual | creator-fix-asset-image |
| director-review-asset-prompts | creator-fix-asset |

### Phase A: 系列规划
1. **director-plot-options** — mode='series'，action='generate'。子代理自己落盘到 `story/plot-options.md`（含末尾 sentinel `<!-- 候选列表结束，等待用户选定 -->`），prompt 只返回 3 候选标题摘要。
   - main session 收到摘要后 Read `story/plot-options.md` → 完整呈现 3 候选给用户 → 问"选定 A/B/C 或提修改意见？"
   - 用户回复 modify + target_option → 重派 director-plot-options，action='modify'，target_option=X，modification=<用户文本>，previous_options_path=`story/plot-options.md`。重复直到用户选定。
   - 用户选定（如 A）→ main session 用 Edit 把 "## 用户已选定方向\n\n> 选定方向：选项 A —《<主题名称>》\n\n后续 director-input-confirm / director-arc / director-outline 等步骤均基于本方向展开。\n" 块**插在 sentinel 之前**（anchor=`<!-- 候选列表结束，等待用户选定 -->`）。
2. **director-input-confirm** — 结构化确认用户输入。注意：总集数已由入口 series-video 阶段 4 写入 config.md `总集数` 字段，本步骤仅 restate，不再问用户。
3. **director-arc** — 生成阶段级剧情弧线（总集数从 config.md 读，不从 prompt 接收）
4. **director-review-arc** — 审核 arc

### Phase B: ep01 大纲 & 文本
5. **director-outline** — mode='new-series', ep='ep01'
6. **director-review-outline**
7. **writer-novel** — ep='ep01'
8. **director-review-novel**
9. **scriptwriter-script** — mode='new-series', ep='ep01'
10. **director-review-script**

### Phase C: 资产 (角色/场景/物品/建筑)
11. **creator-create-assets** — ep='ep01'，登记本集新资产
12. **director-review-asset-prompts** — `$ARGUMENTS[1]=basic`，审本集 character/location/item/building 资产 .md 卡的 `## 图像生成提示` 段表达 (按"review 循环 (通用模式)"处理; needs_revision → creator-fix-asset 修订 prompt section 不生图)
13. **creator-generate-images** — 为 character / location / item / building 资产生成图片
14. **director-review-assets-visual** — `--type=characters,locations,items,buildings`
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase D: 分镜 & 关键帧
15. **storyboarder-storyboard** — ep='ep01'
16. **director-review-storyboard**
17. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
18. **director-review-asset-prompts** — `$ARGUMENTS[1]=keyframes`，**仅审**本集 keyframe .md 卡的 `## 图像生成提示` 段表达 (按"review 循环 (通用模式)"处理; needs_revision → creator-fix-asset 修订 prompt 不生图)
19. **creator-generate-images** — 为 keyframes 生成图片
20. **director-review-assets-visual** — `--type=keyframes`
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase E: 视频生成
21. **creator-video-dreamina** — 派发本集所有镜头到即梦 multimodal2video，pending → submitted/failed 状态转移

## 完成
所有步骤通过后，向用户报告：
- 集号 ep01
- 各阶段产物路径 (outline / novel / script / storyboard / 资产清单)
- video tasks.json 路径
- 提示用户后续用 `/check-video ep01` 或 `/auto-video ep01` 跟踪视频任务
