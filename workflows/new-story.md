# New Story 工作流

### Step 0: 初始化

1. 使用 Bash 创建目录结构：`story/`、`story/episodes/ep01/`、`assets/characters/`、`assets/items/`、`assets/locations/`、`assets/buildings/`
2. 执行**配置加载**流程（见 [SKILL.md](../SKILL.md) "配置加载"章节）：若 [config.md](config.md) 不存在则进入交互式配置引导，逐项询问用户
3. 若 config 中 `默认模式` 为 `full-auto`，则直接使用 full-auto mode，不询问用户；否则询问用户选择 **review mode**、**fast mode** 或 **full-auto mode**（展示默认值作为默认选项）

### Step 0.5: Director 生成主题选项（可选）

仅在用户选择"让 Director 生成剧情选项"时执行：

1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 **Agent tool** 调用 Director 子代理，指令：生成 3 个经典/热门的网络小说主题方向（含主题名称、核心设定、开篇钩子、卖点分析）
3. 展示选项给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过；full-auto mode 下 Director 自动选择最能吸引观众的选项，不等待用户]**
   - **A/B/C** — 选择对应的主题方向
   - **D. 重新生成** — Director 直接生成全新的 3 个方向
   - **E. 告诉 Director 你的偏好** — 用户描述偏好方向后，Director 据此生成新的 3 个选项
4. 若用户选择 D → 重新调用 Director Agent 生成全新 3 个选项，回到步骤 3
5. 若用户选择 E → 收集用户偏好描述，将偏好传给 Director Agent 生成新的 3 个选项，回到步骤 3
6. 若用户选择 A/B/C → 将用户选择的主题作为故事输入，继续 Step 1

### Step 0.6: Director 生成输入确认说明（可选）

仅在用户选择"自己提供故事输入"时执行（即未走 Step 0.5）：

1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 **Agent tool** 调用 Director 子代理，指令：基于用户提供的故事输入，生成一份结构化说明（含主题名称、核心设定、开篇钩子、卖点分析），格式与 Step 0.5 的选项一致
3. 展示说明给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过；full-auto mode 下 Director 自动确认，不等待用户]**
   - **A. 确认** — 以此说明为基础继续 Step 1
   - **B. 重新生成** — Director 基于同样的用户输入重新诠释
   - **C. 补充说明** — 用户描述不满意的地方，Director 据此调整后重新生成
4. 若用户选择 B → 重新调用 Director Agent，回到步骤 3
5. 若用户选择 C → 收集用户反馈，传给 Director Agent 重新生成，回到步骤 3
6. 若用户选择 A → 继续 Step 1

### Step 1: Director 生成剧情大纲

1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - [agents/director.md](../agents/director.md) 的内容
   - 用户的故事输入（或 Step 0.5 中用户选择的主题，或 Step 0.6 中用户确认的结构化说明）
   - [config.md](config.md) 的配置内容
   - 指令：生成 EP01 剧情大纲
3. 使用 Write 将本集大纲写入 [story/episodes/ep01/outline.md](story/episodes/ep01/outline.md)
4. 使用 Write 将整体故事大纲写入 [story/outline.md](story/outline.md)
5. **[仅 review mode]** 展示大纲给用户确认；若用户不满意，根据反馈重新调用 Director Agent 修改

### Step 2: Writer 生成小说原文

1. 使用 Read 读取 [agents/writer.md](../agents/writer.md)、[story/episodes/ep01/outline.md](story/episodes/ep01/outline.md)、[story/outline.md](story/outline.md)
2. 使用 **Agent tool** 调用 Writer 子代理，提供本集大纲 + 整体大纲
3. 使用 Write 将输出写入 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
4. **[仅 review mode]** 使用 Agent tool 调用 Director Agent 审核 [novel.md](story/episodes/ep01/novel.md)，将修改意见反馈给 Writer Agent 进行修改（最多 2 轮）

### Step 3: Creator 生成资产 → Director 生成分镜（串行）

**注意：以下子任务必须串行执行，Creator 先完成资产创建，Director 再基于实际资产文件生成分镜。**

**3a. Director Agent — 输出资产清单：**
1. 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
2. 使用 Agent tool 调用 Director 子代理，指令：根据 novel.md 分析需要新建的资产（包括角色造型变体），输出资产清单
3. 将资产清单传递给 Creator

**3b. Creator Agent — 生成资产：**
1. 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md) + Director 输出的资产清单
2. 使用 Agent tool 调用 Creator 子代理，指令：为每个资产生成描述文件（包括角色造型变体文件）
3. 使用 Write 在 [assets/](assets/) 对应子目录（[characters/](assets/characters/)、[items/](assets/items/)、[locations/](assets/locations/)、[buildings/](assets/buildings/)）下创建每个资产的 `.md` 文件

**3c. Director Agent — 生成分镜：**
1. 使用 Glob 读取 [assets/](assets/) 目录下所有实际存在的 `.md` 文件列表
2. 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
3. 使用 Agent tool 调用 Director 子代理，prompt 中包含：
   - novel.md 的内容
   - [assets/](assets/) 下所有实际文件的完整路径列表
   - 指令：根据 novel.md 生成分镜提示词，资产引用必须且只能使用上述文件列表中的实际路径
4. 使用 Write 将分镜写入 [story/episodes/ep01/storyboard.md](story/episodes/ep01/storyboard.md)

**3d. Director 台词密度自检与补充（最多 3 轮）：**
1. Director 自检每个分镜的台词数量（含对白、自白、旁白、角色声音反应），并检查是否存在超过 2 秒无声音（角色声音或环境音效）的空窗
2. 如果所有分镜均达到 5-8 句 → 通过，进入下一步
3. 如果有分镜台词不足 5-8 句：
   a. 将不足的分镜列表和对应的小说原文段落传给 Writer Agent，请求补充对白/自白
   b. Writer Agent 返回补充的台词
   c. Director 将补充的台词融入对应分镜，重新生成这些分镜的画面与声音描述
   d. 使用 Write 更新 [story/episodes/ep01/storyboard.md](story/episodes/ep01/storyboard.md)
   e. 回到步骤 1 重新自检
4. 如果已循环 3 轮仍有不足，接受当前结果，不再继续循环

**[仅 review mode]** 展示分镜内容和新建资产列表给用户确认

### Step 4: 完成

1. 输出本集摘要：集数编号、场景数（分镜数量）、新建资产列表
2. 提示用户可以使用 `/short-video` 继续创作下一集
