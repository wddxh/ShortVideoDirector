---
name: short-repair-story
description: 检测单集短视频的文件完整性，从断点处恢复生成。自动识别缺失或不完整的文件，重新执行后续步骤。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
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

1. 读取 `config.md` 获取配置（每集分镜数等）

### 阶段 3: 逐项检测完整性

按生成顺序检查目标集目录下的文件：

**检查 1 — 大纲：** `story/episodes/ep01/outline.md`
- 不存在 → 状态：**大纲缺失**
- 存在但不包含 `## 结局设计` → 状态：**大纲不完整**
- 通过 → 继续检查

**检查 2 — 剧本：** `story/episodes/ep01/script.md`
- 不存在 → 状态：**剧本缺失**
- 存在但不包含 `## 场景` → 状态：**剧本不完整**
- 通过 → 继续检查

**检查 3 — 资产清单：** `story/episodes/ep01/outline.md` 中的 `## 本集资产清单`
- outline.md 中不包含 `## 本集资产清单` → 状态：**资产清单缺失**
- 通过 → 继续检查

**检查 4 — 资产文件：** 资产清单中「新增资产」列出的每个资产
- 使用 Glob 检查 `assets/**/*.md`，对照清单中的新增资产名称
- 有缺失的资产文件 → 状态：**资产文件缺失**
- 通过 → 继续检查

**检查 4b — 资产图片待查任务（仅图像模型非 none 时）：**
- 读取 `config.md`，若图像模型为 `none` → 跳过检查 4b 和 4c
- 检查 `assets/images/pending.json` 是否存在且非空
- 若存在 → 逐个使用 Bash 调用 `dreamina query_result --submit_id={id} --download_dir=/tmp/dreamina-pending` 查询
  - `success` → 使用 Bash 将下载的图片 mv 到 `output_path`，从列表移除
  - `fail` → 从列表移除，记入缺失列表
  - `querying` → 保留（仍在排队）
- 更新或删除 `assets/images/pending.json`

**检查 4c — 资产图片完整性（仅图像模型非 none 时）：**
- 对照已有资产文件（使用 Glob 匹配 `assets/**/*.md`），检查对应的 `assets/images/{category}/{name}.png` 是否存在
- 有缺失的图片 → 状态：**资产图片缺失**
- 通过 → 继续检查

**检查 5 — 分镜：** `story/episodes/ep01/storyboard.md`
- 不存在 → 状态：**分镜缺失**
- 存在但镜头数明显不足（低于 config 每集分镜数的 50%）→ 状态：**分镜不完整**
- 通过 → 所有检查通过

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
3. 若"需修改"→ 使用 Skill tool 调用 `scriptwriter-fix-script` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）
4. 继续执行"从资产清单开始恢复"

**从资产清单开始恢复：**
1. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`ep01`
2. 继续执行"从资产文件开始恢复"

**从资产文件开始恢复：**
1. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`
2. 若图像模型非 `none`：使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
3. 继续执行"从分镜开始恢复"

**从资产图片开始恢复（仅图像模型非 none 时）：**
1. 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
2. 继续执行"从分镜开始恢复"

**从分镜开始恢复：**
1. 使用 Skill tool 调用 `short-storyboard` skill，传递参数：`ep01`
2. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
3. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

### 阶段 6: 完成

1. 输出恢复摘要：从哪个步骤开始恢复、重新生成了哪些内容
2. 提示用户检查结果
