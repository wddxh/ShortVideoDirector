---
name: short-edit-story
description: 对单集短视频的任意内容（资产、大纲、剧本、分镜）提出修改意见，自动修正并级联更新下游内容。使用 /short-edit-story 加自然语言描述触发。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "[自然语言修改意见]"
---

## 使用示例

```
/short-edit-story 大纲的结局改成开放式结局
/short-edit-story 剧本场景2的台词太少，增加内心独白
/short-edit-story 分镜镜头5的节奏太快，拆分成两个镜头
/short-edit-story 主角的外貌描述改成短发
/short-edit-story 在资产清单中增加一个新角色"老王"
```

## 流程

### 阶段 1: 解析用户意图

1. 读取 `config.md` 获取配置
2. 从 `$ARGUMENTS` 中解析：
   - **目标类型**：根据关键词判断
     - 资产/角色/物品/场景/建筑 + 具体名称 → **asset**
     - 资产清单 → **asset-list**
     - 大纲 → **outline**
     - 剧本/台词 → **script**
     - 分镜/镜头 → **storyboard**
     - 图片/参考图/重新生成图片 + 资产名称 → **asset-image**
   - **修改意见**：用户的具体要求
3. 集数固定为 ep01（单集短视频只有一集）
4. 若目标类型为 **asset**：使用 Glob 搜索 `assets/**/*.md`，从用户输入中提取资产名称进行匹配
   - 匹配到 1 个 → 确定目标文件路径
   - 匹配到多个 → 列出让用户选择
   - 未匹配 → 询问用户澄清
5. 若无法确定目标类型 → 询问用户澄清

### 阶段 2: 执行修正 + 级联

根据目标类型执行对应流程：

#### 重新生成资产图片

1. 读取 `config.md`，若图像模型为 `none` → 提示用户需要先在 config 中配置图像模型（使用 `/short-video config`），结束
2. 使用 Glob 在 `assets/**/*.md` 中查找匹配的资产文件
3. 若用户附带了修改建议（如"头发改成红色"）→ 使用 Skill tool 调用 `creator-fix-asset` skill，传递参数：`{资产文件路径} "{修改建议，请更新图像生成提示词}"`
4. 读取 `config.md` 获取图像模型值，使用 Skill tool 调用 `creator-image-{图像模型值}` skill，传递参数：资产路径列表（覆盖已有图片）
5. 若用户附带了修改建议 → 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "资产 {资产名} 的描述已更新，请根据最新资产文件更新分镜中引用该资产的所有相关描述"`
6. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
7. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

#### 修改分镜（无下游）

1. 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`
2. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
3. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

#### 修改剧本（级联资产清单 + 资产 + 分镜）

1. 使用 Skill tool 调用 `scriptwriter-fix-script` skill，传递参数：`ep01 "{修改意见}"`
2. 使用 Skill tool 调用 `director-review-script` skill，传递参数：`ep01`
3. 若"需修改"→ 使用 Skill tool 调用 `scriptwriter-fix-script` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）
4. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`ep01`
5. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`
6. 若 config 图像模型非 `none` → 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
7. 使用 Skill tool 调用 `short-storyboard` skill，传递参数：`ep01`
8. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
9. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

#### 修改大纲（级联剧本 + 审核 + 资产清单 + 资产 + 分镜）

1. 使用 Skill tool 调用 `short-fix-outline` skill，传递参数：`ep01 "{修改意见}"`
2. 使用 Skill tool 调用 `scriptwriter-script` skill，传递参数：`ep01`
3. 使用 Skill tool 调用 `director-review-script` skill，传递参数：`ep01`
4. 若"需修改"→ 使用 Skill tool 调用 `scriptwriter-fix-script` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）
5. 使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`ep01`
6. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`
7. 若 config 图像模型非 `none` → 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`
8. 使用 Skill tool 调用 `short-storyboard` skill，传递参数：`ep01`
9. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
10. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

#### 修改资产文件（级联分镜中该资产描述 + 重新生成图片）

1. 使用 Skill tool 调用 `creator-fix-asset` skill，传递参数：`{资产文件路径} "{修改意见}"`
2. 若 config 图像模型非 `none` → 读取 `config.md` 获取图像模型值，使用 Skill tool 调用 `creator-image-{图像模型值}` skill，传递参数：`"{资产文件路径}"`
3. 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "资产 {资产名} 的描述已更新，请根据最新资产文件更新分镜中引用该资产的所有相关描述"`
4. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
5. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

#### 修改资产清单

1. 根据用户意见，使用 Edit 工具直接编辑 `story/episodes/ep01/outline.md` 中的「本集资产清单」部分
2. 使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`
3. 若 config 图像模型非 `none` → 使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`

### 阶段 3: 完成

1. 输出修改摘要：修改了什么、级联更新了哪些内容
2. 提醒用户检查修改结果
