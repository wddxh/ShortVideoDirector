# Series Mode: repair-story 专属指南

## 集数解析

1. 若 `$ARGUMENTS[0]` 非空 → 使用指定集数（统一转为 epXX 格式）
2. 若 `$ARGUMENTS[0]` 为空 → 使用 Bash 调用 `bash scripts/latest-episode.sh` 找到最新集数
3. 若无任何集目录 → 提示用户先用 `/series-video` 开始新故事，结束

## Phase 4 专属规则

- 若大纲缺失/不完整 → 提示"大纲缺失无法自动恢复（需要剧情方向输入），请使用 `/series-video` 重新生成该集"，结束

## Phase 5 断点 → 恢复链路（series：novel-trio）

按检测到的第一个非 ok 步骤入口，依次执行后续所有步骤。所有 sub-skill 调用通过 Skill / Task 工具按 OC 调度规则；review 失败 → 调对应 fix skill ≤2 轮。

### 从小说开始恢复

1. `writer-novel`，参数 `{ep}`
2. `director-review-novel`，参数 `{ep}`
3. 若 review return `needs_revision M` → `writer-fix-novel`，参数 `{ep}`（≤2 轮；fix skill 自动读 `.review-novel.md` 最后一轮意见）
4. 继续"从关键帧开始恢复"

### 从关键帧开始恢复（含资产清单/资产文件/图片/分镜全套重生成）

1. `director-keyframes`，参数 `{ep}`
2. `director-review-keyframes-narrative`，参数 `{ep}`
3. 若 review return `needs_revision M` → `director-keyframes`，参数 `{ep} incremental`（≤2 轮；fix skill 自动读 `.review-keyframes-narrative.md` 最后一轮意见）
4. `creator-create-assets`，参数 `{ep}`
5. **若非 ep01**：`creator-update-records`，参数 `{ep}`
6. `creator-keyframe-prompts`，参数 `{ep}`
7. 若图像模型非 `none`：
   - `creator-generate-images`，参数 `{ep}`
   - `director-review-keyframes-visual`，参数 `{ep}`
   - 若 review return 以 `needs_revision` 开头 → `creator-fix-keyframe-image`，参数 `{ep}`（≤2 轮；fix skill 自动读 `.review-keyframes-visual.md` 最后一轮 dirty list + 意见）
8. 继续"从分镜开始恢复"

### 从资产文件开始恢复（keyframes 完整但 assets 缺失）

1. `creator-create-assets`，参数 `{ep}`
2. **若非 ep01**：`creator-update-records`，参数 `{ep}`
3. 若图像模型非 `none`：`creator-generate-images`，参数 `{ep}`
4. 继续"从分镜开始恢复"

### 从资产图片开始恢复（仅图像模型非 none 时；assets / keyframe .md 完整但图片缺失）

1. `creator-generate-images`，参数 `{ep}`
2. 若本次有 keyframe 图被生成（`keyframe-images:missing` 命中）：
   - `director-review-keyframes-visual`，参数 `{ep}`
   - 若 review return 以 `needs_revision` 开头 → `creator-fix-keyframe-image`，参数 `{ep}`（≤2 轮）
3. 继续"从分镜开始恢复"

### 从分镜开始恢复

1. `storyboarder-storyboard`，参数 `{ep}`
2. `director-review-storyboard`，参数 `{ep}`
3. 若 review return `needs_revision M` → `storyboarder-fix-storyboard`，参数 `{ep}`（≤2 轮；fix skill 自动读 `.review-storyboard.md` 最后一轮意见）

## Series 恢复 DAG 参考

```
outline → novel [review-novel+fix] → keyframes [review-keyframes-narrative+fix]
   → asset-list → assets → [非 ep01: update-records] → keyframe-mds
   → images [keyframe 图变动: review-keyframes-visual + ≤2 轮 fix-keyframe-image]
   → storyboard [review-storyboard+fix]
```

## Series 专属失败模式

- 解析集数错误（$ARGUMENTS[0] 缺失时未走 `scripts/latest-episode.sh` 兜底）
- 非 ep01 漏插 `creator-update-records`
- 误调用 short-only skill（`scriptwriter-*` / `short-fix-storyboard` / `short-review-storyboard`）
- 大纲缺失时擅自调 `director-fix-outline` 或 `writer-novel`（应直接提示用户走 `/series-video`）
