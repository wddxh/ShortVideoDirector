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
2. 若 `$ARGUMENTS[0]` 为空 → 使用 Glob 匹配 `story/episodes/ep*/` 找到最新集数
3. 若无任何集目录 → 提示用户先用 `/series-video` 开始新故事，流程结束

### 阶段 2: 读取配置

1. 读取 `config.md` 获取配置（每集小说字数、每集分镜数等）

### 阶段 3: 逐项检测完整性

按生成顺序检查目标集目录下的文件：

**检查 1 — 大纲：** `story/episodes/{集数}/outline.md`
- 不存在 → 状态：**大纲缺失**
- 存在但不包含 `## 集尾钩子` → 状态：**大纲不完整**
- 通过 → 继续检查

**检查 2 — 小说：** `story/episodes/{集数}/novel.md`
- 不存在 → 状态：**小说缺失**
- 存在 → 使用 Bash 调用 `python3 scripts/word-count.py story/episodes/{集数}/novel.md` 统计字数，若低于 config 字数范围下限的 50% → 状态：**小说不完整**
- 通过 → 继续检查

**检查 3 — 资产清单：** `story/episodes/{集数}/outline.md` 中的 `## 本集资产清单`
- outline.md 中不包含 `## 本集资产清单` → 状态：**资产清单缺失**
- 通过 → 继续检查

**检查 4 — 资产文件：** 资产清单中「新增资产」列出的每个资产
- 使用 Glob 检查 `assets/**/*.md`，对照清单中的新增资产名称
- 有缺失的资产文件 → 状态：**资产文件缺失**
- 通过 → 继续检查

**检查 5 — 分镜：** `story/episodes/{集数}/storyboard.md`
- 不存在 → 状态：**分镜缺失**
- 存在但镜头数明显不足（低于 config 每集分镜数的 50%）→ 状态：**分镜不完整**
- 通过 → 所有检查通过

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
3. 继续执行"从分镜开始恢复"

**从分镜开始恢复：**
1. 使用 Skill tool 调用 `storyboarder-storyboard` skill，传递参数：`{集数}`
2. 使用 Skill tool 调用 `director-review-storyboard` skill，传递参数：`{集数}`
3. 若"需修改"→ 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，传递参数：`{集数} "{修改意见}"`（最多 2 轮）

### 阶段 6: 完成

1. 输出恢复摘要：从哪个步骤开始恢复、重新生成了哪些内容
2. 提示用户检查结果
