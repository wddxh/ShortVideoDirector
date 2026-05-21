# short mode: pipeline

适用：单集短视频（无系列规划，无 arc，无 novel，无 update-records）。固定 ep='ep01'。

## 调用链

每步通过 task tool dispatch (OC) 或 Skill tool (CC) 执行，**明确告知 mode 和 ep 参数**。任一步失败立即停止并向用户报告。

### Phase A: 剧情确定
1. **director-plot-options** — mode='short'（无 arc，单集自闭合剧情）
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
    - if dirty: **creator-fix-asset-image** 循环 ≤2 rounds，每轮后重新 review
    - 2 轮后仍 dirty → 报告用户人工介入

### Phase D: 分镜 & 关键帧
11. **storyboarder-storyboard** — ep='ep01'
12. **director-review-storyboard**
13. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
14. **creator-generate-images** — 为 keyframes 生成图片
15. **director-review-assets-visual** — `--type=keyframes`
    - if dirty: **creator-fix-asset-image** 循环 ≤2 rounds
    - 2 轮后仍 dirty → 报告用户人工介入

### Phase E: 视频生成
16. **creator-video-dreamina** — 派发本集所有镜头到即梦 multimodal2video，pending → submitted/failed 状态转移

## 完成
所有步骤通过后，向用户报告：
- 集号 ep01
- 各阶段产物路径 (outline / script / storyboard / 资产清单)
- video tasks.json 路径
- 提示用户后续用 `/check-video ep01` 或 `/auto-video ep01` 跟踪视频任务
