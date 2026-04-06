# 编辑/修复 Skill 重命名及短视频版设计

## 概述

将现有 `edit-story` 和 `repair-story` 重命名为系列视频专属（`series-edit-story`、`series-repair-story`），并新增短视频版本（`short-edit-story`、`short-repair-story`）。同时新增 `short-fix-outline` skill 用于短视频大纲修正。

## 重命名

| 现有名称 | 重命名为 |
|----------|---------|
| `skills/edit-story/` | `skills/series-edit-story/` |
| `skills/repair-story/` | `skills/series-repair-story/` |

SKILL.md 内的 `name` 字段同步更新。README 和其他 skill 中引用 `/edit-story`、`/repair-story` 的地方同步更新为 `/series-edit-story`、`/series-repair-story`。

## short-edit-story

用户可调用 skill。参数：`[自然语言修改意见]`

### 阶段 1: 解析用户意图

与系列版一致，但目标类型关键词调整：
- 剧本/台词 → **script**（替代系列版的 小说/原文 → novel）
- 资产/角色/物品/场景/建筑 → **asset**
- 资产清单 → **asset-list**
- 大纲 → **outline**
- 分镜/镜头 → **storyboard**

集数固定为 ep01（单集短视频只有一集）。

### 阶段 2: 级联规则

#### 修改分镜（无下游）

1. `short-fix-storyboard` skill，参数：`ep01 "{修改意见}"`

#### 修改剧本（级联资产清单 + 资产 + 分镜）

1. `scriptwriter-fix-script` skill，参数：`ep01 "{修改意见}"`
2. `storyboarder-asset-list` skill，参数：`ep01`
3. `creator-create-assets` skill，参数：`ep01`
4. `short-storyboard` skill，参数：`ep01`

#### 修改大纲（级联剧本 + 审核 + 资产清单 + 资产 + 分镜）

1. `short-fix-outline` skill，参数：`ep01 "{修改意见}"`
2. `scriptwriter-script` skill，参数：`ep01`
3. `director-review-script` skill，参数：`ep01`
4. 若"需修改"→ `scriptwriter-fix-script` skill，参数：`ep01 "{修改意见}"`（最多 2 轮）
5. `storyboarder-asset-list` skill，参数：`ep01`
6. `creator-create-assets` skill，参数：`ep01`
7. `short-storyboard` skill，参数：`ep01`

#### 修改资产文件（级联分镜中该资产描述）

1. `creator-fix-asset` skill，参数：`{资产文件路径} "{修改意见}"`
2. `short-fix-storyboard` skill，参数：`ep01 "资产 {资产名} 的描述已更新，请根据最新资产文件更新分镜中引用该资产的所有相关描述"`

#### 修改资产清单

1. 使用 Edit 工具直接编辑 `story/episodes/ep01/outline.md` 中的「本集资产清单」部分
2. `creator-create-assets` skill，参数：`ep01`

### 与系列版的区别

- 无 `creator-update-records`（单集无续集）
- 剧本相关用 scriptwriter 系列 skill（替代 writer 系列）
- 分镜用 short 系列 skill（替代系列版 storyboarder 系列）
- 大纲修正用 `short-fix-outline`（不碰 story/outline.md）
- 集数固定 ep01

## short-repair-story

用户可调用 skill。参数：`[无参数]`

### 检查项（按生成顺序）

| 检查 | 文件 | 通过标准 | 失败状态 |
|------|------|---------|---------|
| 1. 大纲 | `story/episodes/ep01/outline.md` | 存在 + 包含 `## 结局设计` | 大纲缺失/不完整 |
| 2. 剧本 | `story/episodes/ep01/script.md` | 存在 + 包含至少一个 `## 场景` | 剧本缺失/不完整 |
| 3. 资产清单 | `story/episodes/ep01/outline.md` 中 `## 本集资产清单` | 存在 | 资产清单缺失 |
| 4. 资产文件 | 清单中新增资产对应的 `assets/**/*.md` | 全部存在 | 资产文件缺失 |
| 5. 分镜 | `story/episodes/ep01/storyboard.md` | 存在 + 镜头数 ≥ config 每集分镜数的 50% | 分镜缺失/不完整 |

### 恢复流程

**大纲缺失/不完整：** 无法自动恢复（需要剧情方向输入），提示用户使用 `/short-video` 重新生成。

**从剧本恢复：**
1. `scriptwriter-script` skill，参数：`ep01`
2. `director-review-script` skill，参数：`ep01`
3. 若"需修改"→ `scriptwriter-fix-script` skill，参数：`ep01 "{修改意见}"`（最多 2 轮）
4. 继续"从资产清单恢复"

**从资产清单恢复：**
1. `storyboarder-asset-list` skill，参数：`ep01`
2. 继续"从资产文件恢复"

**从资产文件恢复：**
1. `creator-create-assets` skill，参数：`ep01`
2. 继续"从分镜恢复"

**从分镜恢复：**
1. `short-storyboard` skill，参数：`ep01`
2. `short-review-storyboard` skill，参数：`ep01`
3. 若"需修改"→ `short-fix-storyboard` skill，参数：`ep01 "{修改意见}"`（最多 2 轮）

### 与系列版的区别

- 集数固定 ep01（无需检测最新集数）
- 大纲完整性检查标志为 `## 结局设计`（替代 `## 集尾钩子`）
- 检查剧本（script.md + `## 场景`）替代小说（novel.md + 字数）
- 恢复时调用 scriptwriter/short 系列 skill
- 无 `creator-update-records`

## 新增 short-fix-outline skill

| 字段 | 值 |
|------|---|
| name | short-fix-outline |
| agent | director |
| context | fork |
| 读取 | `story/episodes/$ARGUMENTS[0]/outline.md`、`config.md`、`skills/short-outline/rules.md` |
| 参数 | `$ARGUMENTS[0]` 集数、`$ARGUMENTS[1]` 修改意见 |
| 输出 | 使用 Write 重写 `story/episodes/$ARGUMENTS[0]/outline.md`（不写 `story/outline.md`） |
| 规则 | 仅修改指出的问题，不改动未提及的内容。严格遵循 `short-outline/rules.md` |

## 新增/变更文件汇总

| 操作 | 文件 |
|------|------|
| git mv | `skills/edit-story/` → `skills/series-edit-story/` |
| git mv | `skills/repair-story/` → `skills/series-repair-story/` |
| 修改 | `skills/series-edit-story/SKILL.md`（name 字段） |
| 修改 | `skills/series-repair-story/SKILL.md`（name 字段） |
| 修改 | README.md（更新引用） |
| 修改 | 其他引用 `/edit-story` 或 `/repair-story` 的 skill 文件 |
| 新建 | `skills/short-edit-story/SKILL.md` |
| 新建 | `skills/short-repair-story/SKILL.md` |
| 新建 | `skills/short-fix-outline/SKILL.md` |
