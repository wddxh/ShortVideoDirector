# continue-series mode: pipeline

适用：用户在已有系列上续写新一集（ep0X，X ≥ 2，或系列已规划但本集尚未生成）。跳过系列规划阶段。

## 前置条件
- `story/arc.md` 已存在（系列规划已完成）
- 上一集的产物（outline / novel / script / storyboard / 资产）已落盘

## 调用链

每步通过 task tool dispatch (OC) 或 Skill tool (CC) 执行，**明确告知 mode 和 ep 参数**。任一步失败立即停止并向用户报告。

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
11. **creator-generate-images** — 为本集新增的 character / location / item / building 资产生成图片
12. **director-review-assets-visual** — `--type=characters,locations,items,buildings`
    - if dirty: **creator-fix-asset-image** 循环 ≤2 rounds，每轮后重新 review
    - 2 轮后仍 dirty → 报告用户人工介入

### Phase D: 分镜 & 关键帧
13. **storyboarder-storyboard** — ep='ep0X'
14. **director-review-storyboard**
15. **creator-keyframe-prompts** — 输入: storyboard.md (从分镜 inline KF 标记翻译)
16. **creator-generate-images** — 为 keyframes 生成图片
17. **director-review-assets-visual** — `--type=keyframes`
    - if dirty: **creator-fix-asset-image** 循环 ≤2 rounds
    - 2 轮后仍 dirty → 报告用户人工介入

### Phase E: 视频生成
18. **creator-video-dreamina** — 派发本集所有镜头到即梦 multimodal2video，pending → submitted/failed 状态转移

## 完成
所有步骤通过后，向用户报告：
- 集号 ep0X
- 各阶段产物路径 (outline / novel / script / storyboard / 资产清单)
- video tasks.json 路径
- 提示用户后续用 `/check-video ep0X` 或 `/auto-video ep0X` 跟踪视频任务
