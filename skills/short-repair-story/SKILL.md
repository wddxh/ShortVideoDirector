---
name: short-repair-story
description: 检测单集短视频的文件完整性，从断点处恢复生成。自动识别缺失或不完整的文件，重新执行后续步骤。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
model: opus
---

## 失败处理（核心规则）

**sub-agent task 失败后，永远不要在主 session 自己接管本应由 sub-agent 做的工作。**

正确做法：
1. 分析失败原因（task return 值 / 错误信息）
2. 如可修复：用修正后的参数重新派发同一 sub-agent
3. 如不可修复：将失败原因和已尝试方案返回给用户，停止流程

错误做法：
- ❌ "sub-agent 失败了，我自己来写这个 novel.md"
- ❌ "task 报错了，我在主 session 直接调用 Write"
- ❌ "我 fallback 一下，自己生成 keyframes.json"

原因：主 session 缺少 sub-agent 的隔离上下文（专属 system prompt、skill 加载、permission 配置），自己接管会导致质量下降、跨步骤上下文污染、permission 错配等问题。即使 sub-agent 失败，工作所有权也必须留在 sub-agent 层。

## 使用示例

```
/short-repair-story
```

## 流程

### 阶段 1: 确认目标

1. 集数固定为 ep01
2. 使用 Bash 检查 `story/episodes/ep01/` 目录是否存在
3. 若不存在 → 提示用户先用 `/short-video` 创建短视频，流程结束

### 阶段 2: 读取配置

1. 使用 Bash 调用 `bash scripts/read-config.sh "每集分镜数"` 等获取所需配置值

### 阶段 3: 逐项检测完整性

使用 Bash 调用 `bash scripts/check-episode.sh {集数}` 一次性检查所有项目。

脚本输出每行一项检查结果，格式为 `{检查项}:{状态}[:详情]`：
- `outline:ok` / `outline:missing` / `outline:incomplete`
- `novel:ok` / `novel:missing` / `novel:incomplete:{实际字数}/{目标下限}`
- `script:ok` / `script:missing` / `script:incomplete`
- `asset-list:ok` / `asset-list:missing`
- `keyframes:ok` / `keyframes:missing` / `keyframes:incomplete:{原因}`（原因可能为 `json-empty`、`md-dir-missing`、`md-count-mismatch:{md数}/{json数}`）
- `assets:ok` / `assets:missing:{缺失资产名}`
- `images:ok` / `images:missing:{缺失资产名}` / `images:skipped`
- `keyframe-images:ok` / `keyframe-images:missing:{缺失KF-id}` / `keyframe-images:skipped`
- `storyboard:ok` / `storyboard:missing` / `storyboard:incomplete:{实际数}/{目标数}`

根据输出判断第一个非 ok 状态的检查项，确定从哪个步骤开始恢复。注意：`asset-list:missing` 与 `keyframes:missing/incomplete` 应合并处理——资产清单由 `director-keyframes` 写入 outline，缺资产清单等同于缺 keyframes，统一从"从关键帧开始恢复"路径走。

### 阶段 4: 报告 + 确认

1. 向用户报告检测结果：哪些通过，哪些缺失/不完整
2. 若所有检查通过 → 提示"文件完整，无需修复"，流程结束
3. 若大纲缺失/不完整 → 提示"大纲缺失无法自动恢复（需要剧情方向输入），请使用 `/short-video` 重新生成"，流程结束
4. 其他情况 → 提示将从哪个步骤开始恢复，询问用户确认

### 阶段 5: 从断点恢复

根据检测到的第一个缺失/不完整步骤，依次执行后续所有步骤：

**从剧本开始恢复：**
1. 使用 Skill tool 调用 `scriptwriter-script` skill，传递参数：`ep01`
2. 使用 Skill tool 调用 `director-review-script` skill，传递参数：`ep01`
3. 若 review return `needs_revision M` → 使用 Skill tool 调用 `scriptwriter-fix-script` skill，传递参数：`ep01`（最多 2 轮 fix；fix skill 自动读 `.review-script.md` 最后一轮意见）
4. 继续执行"从关键帧开始恢复"

**从关键帧开始恢复（含资产清单/资产文件/图片/分镜全套重生成）：**
1. 使用 Skill tool 调用 `director-keyframes` skill，传递参数：`ep01`
2. 使用 Skill tool 调用 `director-review-keyframes-narrative` skill，传递参数：`ep01`
3. 若 review return `needs_revision M` → 使用 Skill tool 调用 `director-keyframes` skill，传递参数：`ep01 incremental`（最多 2 轮 fix；fix skill 自动读 `.review-keyframes-narrative.md` 最后一轮意见）
4. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`
5. 使用 Skill tool 调用 `creator-keyframe-prompts` skill，传递参数：`ep01`
6. 若图像模型非 `none`：
   - 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
   - 使用 Skill tool 调用 `director-review-keyframes-visual` skill，传递参数：`ep01`
   - 若 review return 以 `needs_revision` 开头 → 使用 Skill tool 调用 `creator-fix-keyframe-image` skill，传递参数：`ep01`（最多 2 轮 fix；fix skill 自动读 `.review-keyframes-visual.md` 最后一轮 dirty list + 意见）
7. 继续执行"从分镜开始恢复"

**从资产文件开始恢复（keyframes 完整但 assets 缺失）：**
1. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`
2. 若图像模型非 `none`：使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
3. 继续执行"从分镜开始恢复"

**从资产图片开始恢复（仅图像模型非 none 时；assets / keyframe .md 完整但图片缺失）：**
1. 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
2. 若本次有 keyframe 图被生成（`keyframe-images:missing` 命中）：
   - 使用 Skill tool 调用 `director-review-keyframes-visual` skill，传递参数：`ep01`
   - 若 review return 以 `needs_revision` 开头 → 使用 Skill tool 调用 `creator-fix-keyframe-image` skill，传递参数：`ep01`（最多 2 轮 fix；fix skill 自动读 `.review-keyframes-visual.md` 最后一轮 dirty list + 意见）
3. 继续执行"从分镜开始恢复"

**从分镜开始恢复：**
1. 使用 Skill tool 调用 `short-storyboard` skill，传递参数：`ep01`
2. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
3. 若 review return `needs_revision M` → 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01`（最多 2 轮 fix；fix skill 自动读 `.review-storyboard.md` 最后一轮意见）

### 阶段 6: 完成

1. 输出恢复摘要：从哪个步骤开始恢复、重新生成了哪些内容
2. 提示用户检查结果
