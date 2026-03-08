# New Story 工作流

> **术语说明：** 本文档中"阶段"指工作流的主要阶段（如阶段 1、阶段 2a），"步骤"指阶段内部的执行项（如步骤 1、步骤 2）。

### 阶段 1: 初始化

1. 使用 Bash 创建目录结构：`story/`、`story/episodes/ep01/`、`assets/characters/`、`assets/items/`、`assets/locations/`、`assets/buildings/`
2. 执行**配置加载**流程（见 [SKILL.md](../SKILL.md) "配置加载"章节）：若 [config.md](config.md) 不存在则进入交互式配置引导，逐项询问用户
3. 若 config 中 `默认模式` 为 `full-auto`，则直接使用 full-auto mode，不询问用户；否则询问用户选择 **review mode**、**fast mode** 或 **full-auto mode**（展示默认值作为默认选项）

### 阶段 2a: Director 生成主题选项

**2a.1 Director — 生成剧情选项（director.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 1 — 生成剧情选项
   - **工作流：** new-story
   - **输入：**
     - config.md 的配置内容
   - **期望输出：** 3 个主题选项（每个含主题名称、核心设定、开篇钩子、卖点分析）
4. **文件操作：** 无（输出展示给用户选择）
5. 展示选项给用户：
   - **A/B/C** — 选择对应主题方向
   - **D. 重新生成** — 重新调用同一职责，生成全新 3 个方向
   - **E. 告诉 Director 你的偏好** — 收集用户偏好，重新调用同一职责
   - **[即使 fast mode 也必须等待用户确认；full-auto mode 下 Director 自动选择]**
6. 用户选择 A/B/C → 继续阶段 3

### 阶段 2b: Director 生成输入确认说明

**2b.1 Director — 生成输入确认说明（director.md 职责 2）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 2 — 生成输入确认说明
   - **工作流：** new-story
   - **输入：**
     - config.md 的配置内容
     - 用户故事输入
   - **期望输出：** 结构化说明（含主题名称、核心设定、开篇钩子、卖点分析）
4. **文件操作：** 无（输出展示给用户确认）
5. 展示说明给用户：
   - **A. 确认** — 继续阶段 3
   - **B. 重新生成** — 重新调用同一职责
   - **C. 补充说明** — 收集用户反馈，重新调用同一职责
   - **[即使 fast mode 也必须等待用户确认；full-auto mode 下 Director 自动确认]**
6. 用户选择 A → 继续阶段 3

### 阶段 3: Director 生成剧情大纲

**3.1 Director — 生成剧情大纲（director.md 职责 3）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 3 — 生成剧情大纲
   - **工作流：** new-story
   - **输入：**
     - config.md 的配置内容
     - 选定的剧情方向（来自阶段 2a 用户选择的主题，或阶段 2b 用户确认的结构化说明）
   - **期望输出：** 两段内容 — 本集大纲 + outline.md 追加内容
4. **文件操作：**
   - 使用 Write 将本集大纲写入 [story/episodes/ep01/outline.md](story/episodes/ep01/outline.md)
   - 使用 Write 将整体故事大纲写入 [story/outline.md](story/outline.md)
5. **[仅 review mode]** 展示大纲给用户确认；若不满意，根据反馈重新调用同一职责修改

### 阶段 4: Writer 生成小说原文

**4.1 Writer — 生成小说原文（writer.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/writer.md](../agents/writer.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep01/outline.md](story/episodes/ep01/outline.md)
   - 使用 Read 读取 [story/outline.md](story/outline.md)
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Writer 子代理
   - **职责：** 职责 1 — 生成小说原文
   - **工作流：** new-story
   - **输入：**
     - 本集大纲（story/episodes/ep01/outline.md）
     - 整体大纲（story/outline.md）
     - config.md 的配置内容
   - **期望输出：** 小说原文（不低于 3000 字）
4. **文件操作：**
   - 使用 Write 将小说原文写入 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)

**4.2 [仅 review mode] Director — 审核 Writer 小说原文（director.md 职责 4 场景 A）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep01/outline.md](story/episodes/ep01/outline.md)
   - 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 4 场景 A — 审核 Writer 小说原文
   - **工作流：** new-story
   - **输入：**
     - 本集大纲（outline.md）
     - 小说原文（novel.md）
   - **期望输出：** 审核结果（通过 / 需修改 + 修改意见列表）
4. **文件操作：** 无（审核结果传递给 Writer）
5. 若"需修改"→ 将修改意见反馈给 Writer Agent 修改（最多 2 轮），使用 Write 更新 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)

### 阶段 5: Creator 生成资产 → Storyboarder 生成分镜（串行）

**注意：以下子任务必须串行执行。**

**5a. Storyboarder — 生成资产清单（storyboarder.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/storyboarder.md](../agents/storyboarder.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
3. **调用 Agent：** 使用 Agent tool 调用 Storyboarder 子代理
   - **职责：** 职责 1 — 生成资产清单
   - **工作流：** new-story
   - **输入：**
     - 本集小说原文（novel.md）
   - **期望输出：** 资产清单（分类列出：新角色/角色造型变体/新物品/新场景/新建筑）
4. **文件操作：** 无（资产清单传递给 Creator）

**5b. Creator — 创建新资产（creator.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/creator.md](../agents/creator.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Creator 子代理
   - **职责：** 职责 1 — 创建新资产
   - **工作流：** new-story
   - **输入：**
     - Storyboarder 输出的资产清单
     - 本集小说原文（novel.md）
     - config.md（目标图像模型）
   - **期望输出：** 每个资产的完整 Markdown 文件内容（标准资产/造型变体格式）
4. **文件操作：**
   - 使用 Write 在 [assets/](assets/) 对应子目录（characters/、items/、locations/、buildings/）下创建每个资产的 `.md` 文件

**5c. Storyboarder — 生成分镜提示词（storyboarder.md 职责 2）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/storyboarder.md](../agents/storyboarder.md)
2. **读取输入：**
   - 使用 Glob 读取 [assets/](assets/) 目录下所有 `.md` 文件路径列表
   - 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Storyboarder 子代理
   - **职责：** 职责 2 — 生成分镜提示词
   - **工作流：** new-story
   - **输入：**
     - 本集小说原文（novel.md）
     - config.md 的配置内容
     - assets/ 下所有实际文件的完整路径列表
   - **期望输出：** 完整分镜提示词（含视频风格、资产引用、所有镜头）
4. **文件操作：**
   - 使用 Write 将分镜写入 [story/episodes/ep01/storyboard.md](story/episodes/ep01/storyboard.md)

**5d. Storyboarder 台词密度自检与补充（最多 3 轮）：**

Storyboarder 内部自检循环，不单独调用 agent：
1. 自检每个分镜的台词数量和声音空窗
2. 全部达标 → 进入 5e
3. 不达标 → 向 Writer 请求补充对白/自白 → 融入分镜 → 使用 Write 更新 [story/episodes/ep01/storyboard.md](story/episodes/ep01/storyboard.md) → 重新自检
4. 3 轮后仍有不足 → 接受当前结果

**5e. Director — 审核分镜（director.md 职责 4 场景 B）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep01/novel.md](story/episodes/ep01/novel.md)
   - 使用 Read 读取 [story/episodes/ep01/storyboard.md](story/episodes/ep01/storyboard.md)
   - 使用 Read 读取 [story/episodes/ep01/outline.md](story/episodes/ep01/outline.md)
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 4 场景 B — 审核 Storyboarder 分镜
   - **工作流：** new-story
   - **输入：**
     - 小说原文（novel.md）
     - 分镜（storyboard.md）
     - 本集大纲（outline.md）
   - **期望输出：** 审核结果（通过 / 需修改 + 修改意见列表）
4. **文件操作：** 无（审核结果传递给 Storyboarder）
5. 若"需修改"→ 将修改意见传给 Storyboarder 修正，重新提交审核（最多 2 轮），使用 Write 更新 [story/episodes/ep01/storyboard.md](story/episodes/ep01/storyboard.md)

**[仅 review mode]** 展示分镜内容和新建资产列表给用户确认

### 阶段 6: 完成

1. 输出本集摘要：集数编号、场景数（分镜数量）、新建资产列表
2. 提示用户可以使用 `/short-video` 继续创作下一集
