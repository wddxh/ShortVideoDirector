# new-series mode: pipeline

适用：用户开新系列，从 ep01 开始。

## 调用链

每步通过 task tool dispatch (OC) 或 Skill tool (CC) 执行，**明确告知 mode 和 ep 参数**。任一步失败立即停止并向用户报告。

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
    - if dirty: **creator-fix-asset-image** 循环 ≤2 rounds，每轮后重新 review
    - 2 轮后仍 dirty → 报告用户人工介入

### Phase D: 分镜 & 关键帧
14. **storyboarder-storyboard** — ep='ep01'
15. **director-review-storyboard**
16. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
17. **creator-generate-images** — 为 keyframes 生成图片
18. **director-review-assets-visual** — `--type=keyframes`
    - if dirty: **creator-fix-asset-image** 循环 ≤2 rounds
    - 2 轮后仍 dirty → 报告用户人工介入

### Phase E: 视频生成
19. **creator-video-dreamina** — 派发本集所有镜头到即梦 multimodal2video，pending → submitted/failed 状态转移

## 完成
所有步骤通过后，向用户报告：
- 集号 ep01
- 各阶段产物路径 (outline / novel / script / storyboard / 资产清单)
- video tasks.json 路径
- 提示用户后续用 `/check-video ep01` 或 `/auto-video ep01` 跟踪视频任务
