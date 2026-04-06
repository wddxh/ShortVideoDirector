---
name: series-edit-story
description: 对任意一集的任意内容（资产、大纲、小说、分镜）提出修改意见，自动修正并级联更新下游内容。使用 /series-edit-story 加自然语言描述触发。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "[自然语言修改意见]"
---

## 使用示例

```
/series-edit-story ep03的主角外貌描述改成短发
/series-edit-story ep01大纲的集尾钩子不够吸引人，改成悬念更强的
/series-edit-story ep02分镜镜头5的台词太少，增加内心独白
/series-edit-story 在ep01的资产清单中增加一个新角色"老王"
```

## 流程

### 阶段 1: 解析用户意图

1. 读取 `config.md` 获取配置
2. 从 `$ARGUMENTS` 中解析：
   - **目标集数**：识别 epXX 格式或"第X集"等自然语言，转换为 epXX 格式
   - **目标类型**：根据关键词判断
     - 资产/角色/物品/场景/建筑 + 具体名称 → **asset**
     - 资产清单 → **asset-list**
     - 大纲 → **outline**
     - 小说/原文 → **novel**
     - 分镜/镜头 → **storyboard**
   - **修改意见**：用户的具体要求
3. 若目标类型为 **asset**：使用 Glob 搜索 `assets/**/*.md`，从用户输入中提取资产名称进行匹配
   - 匹配到 1 个 → 确定目标文件路径
   - 匹配到多个 → 列出让用户选择
   - 未匹配 → 询问用户澄清
4. 若目标类型为 **asset** 且未指定集数 → 询问用户：修改该资产后需要更新哪一集的分镜？
5. 若无法确定目标类型或集数 → 询问用户澄清

### 阶段 2: 执行修正 + 级联

根据目标类型执行对应流程：

#### 修改分镜（无下游）

1. 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，传递参数：`{集数} "{修改意见}"`

#### 修改小说（级联资产清单 + 资产 + 分镜）

1. 使用 Skill tool 调用 `writer-fix-novel` skill，传递参数：`{集数} "{修改意见}"`
2. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`{集数}`
3. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`{集数}`
4. 使用 Skill tool 调用 `storyboarder-storyboard` skill，传递参数：`{集数}`

#### 修改大纲（级联小说 + 资产清单 + 资产 + 分镜）

1. 使用 Skill tool 调用 `director-fix-outline` skill，传递参数：`{集数} "{修改意见}"`
2. 使用 Skill tool 调用 `writer-novel` skill，传递参数：`{集数}`
3. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`{集数}`
4. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`{集数}`
5. 若非 ep01：使用 Skill tool 调用 `creator-update-records` skill，传递参数：`{集数}`
6. 使用 Skill tool 调用 `storyboarder-storyboard` skill，传递参数：`{集数}`

#### 修改资产文件（级联分镜中该资产描述）

1. 使用 Skill tool 调用 `creator-fix-asset` skill，传递参数：`{资产文件路径} "{修改意见}"`
2. 使用 Skill tool 调用 `storyboarder-fix-storyboard` skill，传递参数：`{集数} "资产 {资产名} 的描述已更新，请根据最新资产文件更新分镜中引用该资产的所有相关描述"`

#### 修改资产清单

1. 根据用户意见，使用 Edit 工具直接编辑 `story/episodes/{集数}/outline.md` 中的「本集资产清单」部分
2. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`{集数}`

### 阶段 3: 完成

1. 输出修改摘要：修改了什么、级联更新了哪些内容
2. 提醒用户检查修改结果

## v1 范围限定

本 skill 仅支持**单集单内容类型**的编辑。以下场景不在 v1 范围内：
- 跨多集的批量修改
- 修改 `story/arc.md`（剧情弧线）
- 修改全局 `story/outline.md`（通过修改单集大纲间接同步）
