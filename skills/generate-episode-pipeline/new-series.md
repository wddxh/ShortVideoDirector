# new-series mode: pipeline

适用：用户开新系列，从 ep01 开始。

## 调用链

每步使用 Skill tool 调用对应 skill, 显式传 mode / ep 参数。除 review-* 步骤外, 任一步失败立即停止并向用户报告; review-* 步骤按下方"review 循环 (通用模式)"处理。

## review 循环 (通用模式, 适用所有 review-* 步骤)

每个 review-* 步骤遵循下述循环, 最多 2 轮修复:

1. 使用 Skill tool 调用 <review-skill> → 产生 `.review-<type>.md`
2. 读 `.review-<type>.md` 最后一轮结论:
   - "pass" → 进入下一 Step
   - "needs_revision" → 进入修复循环 (下方)

修复循环 (循环 i ∈ {1, 2}):
- a. 使用 Skill tool 调用 <fix-skill> (传 `.review-<type>.md` 路径)
- b. 使用 Skill tool 重新调用 <review-skill> → 写入 `.review-<type>.md` 新一轮
- c. 读最新结论:
  - pass → 跳出循环, 进入下一 Step
  - i == 2 且仍 needs_revision → main session 直接 print:
    > ⚠️ <ep> <step name> review 第 2 轮仍未通过, 剩余问题:
    > <从 .review-<type>.md 摘要>
    > 已自动跳过, 继续下一步。可用 /edit-story 手动修订。
    然后跳出循环, 进入下一 Step

### review → fix skill 映射

| review skill | fix skill |
|---|---|
| director-review-arc | director-fix-arc |
| director-review-outline | director-fix-outline |
| director-review-novel | writer-fix-novel |
| director-review-script | scriptwriter-fix-script |
| director-review-storyboard | storyboarder-fix-storyboard |
| director-review-assets-visual | creator-fix-asset-image |

### Phase A: 系列规划
1. **director-plot-options** — mode='series'，要求用户给出总集数 + 选定剧情方向
2. **director-input-confirm** — 结构化确认用户输入
3. **director-arc** — 生成阶段级剧情弧线 (接收已确定的总集数)
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
12. **creator-generate-images** — 为 character / location / item / building 资产生成图片
13. **director-review-assets-visual** — `--type=characters,locations,items,buildings`
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase D: 分镜 & 关键帧
14. **storyboarder-storyboard** — ep='ep01'
15. **director-review-storyboard**
16. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
17. **creator-generate-images** — 为 keyframes 生成图片
18. **director-review-assets-visual** — `--type=keyframes`
    - (按"review 循环 (通用模式)"处理, max 2 轮; 2 轮后仍 dirty 则 main session print 警告并自动跳过, 提示用户用 /edit-story 修订)

### Phase E: 视频生成
19. **creator-video-dreamina** — 派发本集所有镜头到即梦 multimodal2video，pending → submitted/failed 状态转移

## 完成
所有步骤通过后，向用户报告：
- 集号 ep01
- 各阶段产物路径 (outline / novel / script / storyboard / 资产清单)
- video tasks.json 路径
- 提示用户后续用 `/check-video ep01` 或 `/auto-video ep01` 跟踪视频任务
