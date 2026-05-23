# Short Mode: repair-story 专属指南

## 集数解析

- 集数硬编码为 `ep01`（单集短视频只有一集，永不解析 $ARGUMENTS 中的 epXX）
- 即便用户输入含 "ep02" 等也忽略，按 ep01 处理（必要时提示用户："short 模式仅有 ep01"）
- 使用 Bash 检查 `story/episodes/ep01/` 目录是否存在；不存在 → 提示用户先用 `/short-video` 创建短视频，结束

## Phase 4 专属规则

- 若大纲缺失/不完整 → 提示"大纲缺失无法自动恢复（需要剧情方向输入），请使用 `/short-video` 重新生成"，结束

## Phase 5 断点 → 恢复链路（short：script-trio）

按检测到的第一个非 ok 步骤入口，依次执行后续所有步骤。所有 sub-skill 调用通过 Skill / Task 工具按 OC 调度规则；review 失败 → 调对应 fix skill ≤2 轮。**short 模式永不调 `creator-update-records` / `writer-*` / series-only review/fix skill。**

### 从剧本开始恢复

1. `scriptwriter-script`，参数 `ep01`
2. `director-review-script`，参数 `ep01`
3. 若 review return `needs_revision M` → `scriptwriter-fix-script`，参数 `ep01`（≤2 轮；fix skill 自动读 `.review-script.md` 最后一轮意见）
4. 继续"从关键帧开始恢复"

### 从关键帧开始恢复（含资产清单/资产文件/图片/分镜全套重生成）

1. `creator-keyframe-prompts`，参数 `ep01`
2. `director-review-script`，参数 `short ep01`
3. 若 review return `needs_revision M` → `creator-keyframe-prompts`，参数 `ep01 incremental`（≤2 轮；fix skill 自动读 `.review-script.md` 最后一轮意见）
4. `creator-create-assets`，参数 `ep01`
5. 若图像模型非 `none`：
   - `creator-generate-images`，参数 `ep01`
   - `director-review-assets-visual`，参数 `ep01 --type=keyframes`
   - 若 review return 以 `needs_revision` 开头 → `creator-fix-asset-image`，参数 `ep01` + 对应 review 文件路径（basic asset 阶段 = `story/episodes/ep01/.review-basic-assets-visual.md`；keyframe 阶段 = `story/episodes/ep01/.review-keyframes-visual.md`）。≤2 轮；fix skill 自动读最后一轮 dirty list + 意见
6. 继续"从分镜开始恢复"

### 从资产文件开始恢复（keyframes 完整但 assets 缺失）

1. `creator-create-assets`，参数 `ep01`
2. 若图像模型非 `none`：`creator-generate-images`，参数 `ep01`
3. 继续"从分镜开始恢复"

### 从资产图片开始恢复（仅图像模型非 none 时；assets / keyframe .md 完整但图片缺失）

1. `creator-generate-images`，参数 `ep01`
2. 若本次有 keyframe 图被生成（`keyframe-images:missing` 命中）：
   - `director-review-assets-visual`，参数 `ep01 --type=keyframes`
   - 若 review return 以 `needs_revision` 开头 → `creator-fix-asset-image`，参数 `ep01`（≤2 轮）
3. 继续"从分镜开始恢复"

### 从分镜开始恢复

1. `storyboarder-storyboard`，参数 `ep01`
2. `director-review-storyboard`，参数 `ep01`
3. 若 review return `needs_revision M` → `storyboarder-fix-storyboard`，参数 `ep01`（≤2 轮；fix skill 自动读 `.review-storyboard.md` 最后一轮意见）

## Short 恢复 DAG 参考

```
outline → script [review-script+fix] → keyframe-prompts [review-script+fix 二轮]
   → asset-list → assets
   → images [keyframe 图变动: review-assets-visual + ≤2 轮 fix-asset-image]
   → storyboard [review-storyboard+fix]
```

（与 series 唯一差异：novel→script 替换，且无 `[非 ep01: update-records]` 步骤。）

## Short 专属失败模式

- 误调用 `writer-novel` / `writer-fix-novel` / `director-review-novel`（应走 script-trio）
- 误插入 `creator-update-records`（短视频永不需要）
- 误传模式参数给 storyboarder-storyboard / director-review-storyboard / storyboarder-fix-storyboard（这些 skill 模式无关）
- 接纳 "ep02 …" 请求并真的去找该集（应忽略并提示用户）
- 大纲缺失时擅自重生大纲（应直接提示用户走 `/short-video`）
