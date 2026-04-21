---
name: short-repair-story
description: 检测单集短视频的文件完整性，从断点处恢复生成。自动识别缺失或不完整的文件，重新执行后续步骤。
user-invocable: true
---

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
- `assets:ok` / `assets:missing:{缺失资产名}`
- `images:ok` / `images:missing:{缺失资产名}` / `images:skipped`
- `storyboard:ok` / `storyboard:missing` / `storyboard:incomplete:{实际数}/{目标数}`

根据输出判断第一个非 ok 状态的检查项，确定从哪个步骤开始恢复。

### 阶段 4: 报告 + 确认

1. 向用户报告检测结果：哪些通过，哪些缺失/不完整
2. 若所有检查通过 → 提示"文件完整，无需修复"，流程结束
3. 若大纲缺失/不完整 → 提示"大纲缺失无法自动恢复（需要剧情方向输入），请使用 `/short-video` 重新生成"，流程结束
4. 其他情况 → 提示将从哪个步骤开始恢复，询问用户确认

### 阶段 5: 从断点恢复

根据检测到的第一个缺失/不完整步骤，依次执行后续所有步骤：

**从剧本开始恢复：**
1. 调用 `scriptwriter-script`：

```invoke
skill: scriptwriter-script
args: "ep01"
```
2. 调用 `director-review-script`：

```invoke
skill: director-review-script
args: "ep01"
```
3. 若"需修改"→ 调用 `scriptwriter-fix-script`（最多 2 轮）：

```invoke
skill: scriptwriter-fix-script
args: 'ep01 "{修改意见}"'
```
4. 继续执行"从资产清单开始恢复"

**从资产清单开始恢复：**
1. 调用 `storyboarder-asset-list`：

```invoke
skill: storyboarder-asset-list
args: "ep01"
```
2. 继续执行"从资产文件开始恢复"

**从资产文件开始恢复：**
1. 调用 `creator-create-assets`：

```invoke
skill: creator-create-assets
args: "ep01"
```
2. 若图像模型非 `none`：调用 `creator-generate-images`：

```invoke
skill: creator-generate-images
args: "ep01"
```
3. 继续执行"从分镜开始恢复"

**从资产图片开始恢复（仅图像模型非 none 时）：**
1. 调用 `creator-generate-images`：

```invoke
skill: creator-generate-images
args: "ep01"
```
2. 继续执行"从分镜开始恢复"

**从分镜开始恢复：**
1. 调用 `short-storyboard`：

```invoke
skill: short-storyboard
args: "ep01"
```
2. 调用 `short-review-storyboard`：

```invoke
skill: short-review-storyboard
args: "ep01"
```
3. 若"需修改"→ 调用 `short-fix-storyboard`（最多 2 轮）：

```invoke
skill: short-fix-storyboard
args: 'ep01 "{修改意见}"'
```

### 阶段 6: 完成

1. 输出恢复摘要：从哪个步骤开始恢复、重新生成了哪些内容
2. 提示用户检查结果
