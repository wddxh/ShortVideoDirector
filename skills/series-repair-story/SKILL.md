---
name: series-repair-story
description: 检测指定集的文件完整性，从断点处恢复生成。自动识别缺失或不完整的文件，重新执行后续步骤。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "[集数，如 ep03，不填则自动检测最新一集]"
---

## 使用示例

```
/series-repair-story ep03
/series-repair-story
```

## 流程

### 阶段 1: 确定目标集数

1. 若 `$ARGUMENTS[0]` 非空 → 使用指定集数
2. 若 `$ARGUMENTS[0]` 为空 → 使用 Bash 调用 `bash scripts/latest-episode.sh` 找到最新集数
3. 若无任何集目录 → 提示用户先用 `/series-video` 开始新故事，流程结束

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
2. 若所有检查通过 → 提示"该集文件完整，无需修复"，流程结束
3. 若大纲缺失/不完整 → 提示"大纲缺失无法自动恢复（需要剧情方向输入），请使用 `/series-video` 重新生成该集"，流程结束
4. 其他情况 → 提示将从哪个步骤开始恢复，询问用户确认

### 阶段 5: 从断点恢复

根据检测到的第一个缺失/不完整步骤，依次执行后续所有步骤：

**从小说开始恢复：**
1. 使用 Skill tool 调用 `writer-novel` skill，传递参数：`{集数}`
2. 使用 Skill tool 调用 `director-review-novel` skill，传递参数：`{集数}`
3. 若"需修改"→ 使用 Skill tool 调用 `writer-fix-novel` skill，传递参数：`{集数} "{修改意见}"`（最多 2 轮）
4. 继续执行"从资产清单开始恢复"

**从资产清单开始恢复：**
1. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`{集数}`
2. 继续执行"从资产文件开始恢复"

**从资产文件开始恢复：**
1. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`{集数}`
2. 若非 ep01：使用 Skill tool 调用 `creator-update-records` skill，传递参数：`{集数}`
3. 若图像模型非 `none`：使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`{集数}`
4. 继续执行"从分镜开始恢复"

**从资产图片开始恢复（仅图像模型非 none 时）：**
1. 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`{集数}`
2. 继续执行"从分镜开始恢复"

**从分镜开始恢复：**
1. 使用 Skill tool 调用 `storyboarder-storyboard` skill，传递参数：`{集数}`
2. 使用 Skill tool 调用 `director-review-storyboard` skill，传递参数：`{集数}`
3. 若"需修改"→ 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，传递参数：`{集数} "{修改意见}"`（最多 2 轮）

### 阶段 6: 完成

1. 输出恢复摘要：从哪个步骤开始恢复、重新生成了哪些内容
2. 提示用户检查结果
