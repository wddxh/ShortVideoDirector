# Workflow Agent 调用标准化设计

## 背景

agent 文件已完成职责重构（职责卡片式结构），但 workflow 文件中 agent 调用的描述方式不统一：
- 未标注调用的是哪个职责
- 输入和文件操作混在一起
- 期望输出不明确

## 设计目标

将两个 workflow 文件中的每次 agent 调用改为统一的结构化列表格式，明确职责、输入、期望输出、文件操作。

## 文件变更

```
workflows/
├── new-story.md        # 重写 agent 调用部分
└── continue-story.md   # 重写 agent 调用部分
```

## 标准化格式

每次 agent 调用统一采用以下结构：

```markdown
**X.N {Agent名} — {职责名}（{agent文件} 职责 N）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/xxx.md](../agents/xxx.md)
2. **读取输入：**
   - 使用 Read 读取 [file1](path1)
   - 使用 Read 读取 [file2](path2)
3. **调用 Agent：** 使用 Agent tool 调用 {Agent名} 子代理
   - **职责：** 职责 N — {职责名}
   - **工作流：** new-story / continue-story
   - **输入：**
     - {输入1}
     - {输入2}
   - **期望输出：** {agent文件中定义的输出格式}
4. **文件操作：**
   - 使用 Write 将{内容}写入 [file](path)
5. **[仅 review mode]** {用户确认逻辑}
```

### 格式规则

- 不涉及 agent 调用的阶段（初始化、完成）保持当前格式不变
- 重试循环（如阶段 2a 用户选 D/E）首次调用写完整格式，重试时简写"重新调用同一职责"
- 每次调用都显式写出"读取 agent 文件"步骤
- 两个 workflow 保持独立文件，各自完整描述所有阶段

---

## New Story 工作流 — 所有 Agent 调用

### 阶段 1: 初始化

不涉及 agent 调用，保持现状。

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

不涉及 agent 调用，保持现状。

---

## Continue Story 工作流 — 所有 Agent 调用

### 阶段 1: 上下文收集

不涉及 agent 调用，保持现状。

### 阶段 2a: Director 生成剧情走向选项

**2a.1 Director — 生成剧情选项（director.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [config.md](config.md)
   - 使用 Read 读取 [story/outline.md](story/outline.md)
   - 使用 Read 读取最近 M 集的 novel.md
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 1 — 生成剧情选项
   - **工作流：** continue-story
   - **输入：**
     - config.md 的配置内容
     - outline.md 的内容
     - 最近 M 集的 novel.md 内容
   - **期望输出：** 3 个剧情走向选项（稳健/激进/拓展，每个含走向名称、关键转折、涉及角色、悬念预设、对整体剧情的影响）
4. **文件操作：** 无（输出展示给用户选择）
5. 展示选项给用户：
   - **A/B/C** — 选择对应剧情走向
   - **D. 重新生成** — 重新调用同一职责
   - **E. 告诉 Director 你的偏好** — 收集用户偏好，重新调用同一职责
   - **[即使 fast mode 也必须等待用户确认；full-auto mode 下 Director 自动选择]**
6. 用户选择 A/B/C → 继续阶段 3

### 阶段 2b: Director 生成输入确认说明

**2b.1 Director — 生成输入确认说明（director.md 职责 2）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [config.md](config.md)
   - 使用 Read 读取 [story/outline.md](story/outline.md)
   - 使用 Read 读取最近 M 集的 novel.md
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 2 — 生成输入确认说明
   - **工作流：** continue-story
   - **输入：**
     - config.md 的配置内容
     - 用户故事输入
     - outline.md 的内容
     - 最近 M 集的 novel.md 内容
   - **期望输出：** 结构化说明（含走向名称、关键转折、涉及角色、悬念预设、对整体剧情的影响）
4. **文件操作：** 无（输出展示给用户确认）
5. 展示说明给用户：
   - **A. 确认** — 继续阶段 3
   - **B. 重新生成** — 重新调用同一职责
   - **C. 补充说明** — 收集用户反馈，重新调用同一职责
   - **[即使 fast mode 也必须等待用户确认；full-auto mode 下 Director 自动确认]**
6. 用户选择 A → 继续阶段 3

### 阶段 3: Director 生成新集大纲

**3.1 Director — 生成剧情大纲（director.md 职责 3）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [config.md](config.md)
   - 使用 Read 读取 [story/outline.md](story/outline.md)
   - 使用 Read 读取最近 M 集的 novel.md
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 3 — 生成剧情大纲
   - **工作流：** continue-story
   - **输入：**
     - config.md 的配置内容
     - 选定的剧情方向（来自阶段 2a 或 2b）
     - outline.md 的内容
     - 最近 M 集的 novel.md 内容
   - **期望输出：** 两段内容 — 本集大纲 + outline.md 追加内容
4. **文件操作：**
   - 使用 Write 将本集大纲写入 [story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)
   - 使用 Edit **追加**新内容到 [story/outline.md](story/outline.md)（append-only）
5. **[仅 review mode]** 展示大纲给用户确认；若不满意，根据反馈重新调用同一职责修改

### 阶段 4: Writer 生成小说原文

**4.1 Writer — 生成小说原文（writer.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/writer.md](../agents/writer.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)
   - 使用 Read 读取 [story/outline.md](story/outline.md)
   - 使用 Read 读取 [config.md](config.md)
   - 使用 Read 读取 [assets/characters/](assets/characters/) 下所有已有角色资产文件
3. **调用 Agent：** 使用 Agent tool 调用 Writer 子代理
   - **职责：** 职责 1 — 生成小说原文
   - **工作流：** continue-story
   - **输入：**
     - 本集大纲（story/episodes/ep{N+1}/outline.md）
     - 整体大纲（story/outline.md）
     - config.md 的配置内容
     - 已有角色资产文件（assets/characters/*.md）
   - **期望输出：** 小说原文（不低于 3000 字）
4. **文件操作：**
   - 使用 Write 将小说原文写入 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)

**4.2 [仅 review mode] Director — 审核 Writer 小说原文（director.md 职责 4 场景 A）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)
   - 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
   - 使用 Read 读取 [assets/characters/](assets/characters/) 下所有已有角色资产文件
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 4 场景 A — 审核 Writer 小说原文
   - **工作流：** continue-story
   - **输入：**
     - 本集大纲（outline.md）
     - 小说原文（novel.md）
     - 已有角色资产文件（assets/characters/*.md）
   - **期望输出：** 审核结果（通过 / 需修改 + 修改意见列表）
4. **文件操作：** 无（审核结果传递给 Writer）
5. 若"需修改"→ 将修改意见反馈给 Writer Agent 修改（最多 2 轮），使用 Write 更新 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)

### 阶段 5: Creator 生成资产 → Storyboarder 生成分镜（串行）

**注意：以下子任务必须串行执行。**

**5a. Storyboarder — 生成资产清单（storyboarder.md 职责 1）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/storyboarder.md](../agents/storyboarder.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
3. **调用 Agent：** 使用 Agent tool 调用 Storyboarder 子代理
   - **职责：** 职责 1 — 生成资产清单
   - **工作流：** continue-story
   - **输入：**
     - 本集小说原文（novel.md）
   - **期望输出：** 资产清单（分类列出：新角色/角色造型变体/新物品/新场景/新建筑）
4. **文件操作：** 无（资产清单传递给 Creator）

**5b. Creator — 创建新资产 + 更新出场记录（creator.md 职责 1 + 职责 2）：**

仅在资产清单中有新资产或已有资产出场时调用。

1. **读取 agent 文件：** 使用 Read 读取 [agents/creator.md](../agents/creator.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
   - 使用 Read 读取 [assets/](assets/) 下所有已有资产文件
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Creator 子代理
   - **职责：** 职责 1 — 创建新资产 + 职责 2 — 更新出场记录
   - **工作流：** continue-story
   - **输入：**
     - Storyboarder 输出的资产清单
     - 本集小说原文（novel.md）
     - 已有 assets/ 文件内容（参考风格一致性）
     - config.md（目标图像模型）
     - 本集集数编号
   - **期望输出：** 新资产文件内容 + 已有资产的出场记录追加内容
4. **文件操作：**
   - 使用 Write 在 [assets/](assets/) 对应子目录下创建新资产的 `.md` 文件
   - 使用 Edit 对已有资产文件追加出场记录条目

**5c. Storyboarder — 生成分镜提示词（storyboarder.md 职责 2）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/storyboarder.md](../agents/storyboarder.md)
2. **读取输入：**
   - 使用 Glob 读取 [assets/](assets/) 目录下所有 `.md` 文件路径列表
   - 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
   - 使用 Read 读取 [config.md](config.md)
3. **调用 Agent：** 使用 Agent tool 调用 Storyboarder 子代理
   - **职责：** 职责 2 — 生成分镜提示词
   - **工作流：** continue-story
   - **输入：**
     - 本集小说原文（novel.md）
     - config.md 的配置内容
     - assets/ 下所有实际文件的完整路径列表
   - **期望输出：** 完整分镜提示词（含视频风格、资产引用、所有镜头）
4. **文件操作：**
   - 使用 Write 将分镜写入 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)

**5d. Storyboarder 台词密度自检与补充（最多 3 轮）：**

Storyboarder 内部自检循环，不单独调用 agent：
1. 自检每个分镜的台词数量和声音空窗
2. 全部达标 → 进入 5e
3. 不达标 → 向 Writer 请求补充对白/自白 → 融入分镜 → 使用 Write 更新 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md) → 重新自检
4. 3 轮后仍有不足 → 接受当前结果

**5e. Director — 审核分镜（director.md 职责 4 场景 B）：**

1. **读取 agent 文件：** 使用 Read 读取 [agents/director.md](../agents/director.md)
2. **读取输入：**
   - 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
   - 使用 Read 读取 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)
   - 使用 Read 读取 [story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)
   - 使用 Glob 读取 [assets/characters/](assets/characters/) 下所有 `.md` 文件
3. **调用 Agent：** 使用 Agent tool 调用 Director 子代理
   - **职责：** 职责 4 场景 B — 审核 Storyboarder 分镜
   - **工作流：** continue-story
   - **输入：**
     - 小说原文（novel.md）
     - 分镜（storyboard.md）
     - 本集大纲（outline.md）
     - 已有角色资产文件（assets/characters/*.md）
   - **期望输出：** 审核结果（通过 / 需修改 + 修改意见列表）
4. **文件操作：** 无（审核结果传递给 Storyboarder）
5. 若"需修改"→ 将修改意见传给 Storyboarder 修正，重新提交审核（最多 2 轮），使用 Write 更新 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)

**[仅 review mode]** 展示分镜内容和新资产列表给用户确认

### 阶段 6: 完成

不涉及 agent 调用，保持现状。

### 与 New Story 的关键差异

- story/outline.md 严格遵守 append-only 规则，阶段 3 使用 Edit 追加而非 Write 覆写
- Director 职责 1/2/3 传入 outline.md 和最近 M 集 novel.md 作为 continue-story 额外输入
- Writer 和 Director 审核时传入已有角色资产文件
- Creator 同时执行职责 1（创建新资产）和职责 2（更新出场记录），已有资产只追加出场记录
- Director 审核分镜时传入已有角色资产文件
