# Continue Story 工作流

> **术语说明：** 本文档中"阶段"指工作流的主要阶段（如阶段 1、阶段 2a），"步骤"指阶段内部的执行项（如步骤 1、步骤 2）。

### 阶段 1: 上下文收集

1. 使用 Read 读取 [story/outline.md](story/outline.md)
2. 使用 Glob 匹配 `story/episodes/ep*/` 检测最新集数 N
3. 使用 Read 读取 [config.md](config.md)，获取 `上下文集数` 配置值 M
4. 使用 Read 读取最近 M 集的 novel.md
5. 使用 Glob 列出 [assets/](assets/) 下所有已有资产文件
6. 使用 Bash 创建新集目录 `story/episodes/ep{N+1}/`
7. 若 config 中 `默认模式` 为 `full-auto`，则直接使用 full-auto mode，不询问用户；否则询问用户选择 **review mode**、**fast mode** 或 **full-auto mode**（展示默认值作为默认选项）

### 阶段 2a: Director 生成剧情走向选项（可选）

仅在用户选择"让 Director 生成剧情选项"时执行：

1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - [agents/director.md](../agents/director.md) 的内容
   - [story/outline.md](story/outline.md) 的内容
   - 最近 M 集的 novel.md 内容
   - 指令：根据已有剧情，生成 3 个不同的剧情走向选项（稳健/激进/拓展），每个含关键转折、涉及角色、悬念预设、对整体剧情的影响
3. 展示选项给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过；full-auto mode 下 Director 自动选择最能吸引观众的选项，不等待用户]**
   - **A/B/C** — 选择对应的剧情走向
   - **D. 重新生成** — Director 直接生成全新的 3 个走向
   - **E. 告诉 Director 你的偏好** — 用户描述偏好方向后，Director 据此生成新的 3 个走向
4. 若用户选择 D → 重新调用 Director Agent 生成全新 3 个走向，回到步骤 3
5. 若用户选择 E → 收集用户偏好描述，将偏好传给 Director Agent 生成新的 3 个走向，回到步骤 3
6. 若用户选择 A/B/C → 将用户选择的走向作为本集创作方向，继续阶段 3

### 阶段 2b: Director 生成输入确认说明（可选）

仅在用户选择"自己提供故事输入"时执行（即未走阶段 2a）：

1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - [agents/director.md](../agents/director.md) 的内容
   - 用户提供的故事输入
   - [story/outline.md](story/outline.md) 的内容
   - 最近 M 集的 novel.md 内容
   - 指令：基于用户输入和已有剧情上下文，生成一份结构化说明（含剧情走向名称、关键转折、涉及角色、悬念预设、对整体剧情的影响），格式与 阶段 2a 的选项一致
3. 展示说明给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过；full-auto mode 下 Director 自动确认，不等待用户]**
   - **A. 确认** — 以此说明为基础继续阶段 3
   - **B. 重新生成** — Director 基于同样的用户输入重新诠释
   - **C. 补充说明** — 用户描述不满意的地方，Director 据此调整后重新生成
4. 若用户选择 B → 重新调用 Director Agent，回到步骤 3
5. 若用户选择 C → 收集用户反馈，传给 Director Agent 重新生成，回到步骤 3
6. 若用户选择 A → 继续阶段 3

### 阶段 3: Director 生成新集大纲

1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - 用户的新输入（或 阶段 2a 中用户选择的剧情走向，或阶段 2b 中用户确认的结构化说明）
   - [story/outline.md](story/outline.md) 的内容
   - 最近 M 集的 novel.md 内容
   - [config.md](config.md) 的配置内容
   - 指令：生成 EP{N+1} 剧情大纲，保持与前文的剧情连续性
3. 使用 Write 写入 [story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)
4. 使用 Edit 工具 **追加** 新内容到 [story/outline.md](story/outline.md)（append-only，不修改已有内容）
5. **[仅 review mode]** 展示大纲给用户确认；若用户不满意，根据反馈重新调用 Director Agent 修改

### 阶段 4: Writer 生成小说原文

1. 使用 Read 读取 [agents/writer.md](../agents/writer.md)、[story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)、[story/outline.md](story/outline.md)
2. 使用 **Agent tool** 调用 Writer 子代理，提供本集大纲 + 整体大纲
3. 使用 Write 将输出写入 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
4. **[仅 review mode]** 使用 Agent tool 调用 Director Agent 审核 [novel.md](story/episodes/ep{N+1}/novel.md)，将修改意见反馈给 Writer Agent 进行修改（最多 2 轮）

### 阶段 5: Creator 生成资产 → Storyboarder 生成分镜（串行）

**注意：以下子任务必须串行执行，Creator 先完成资产创建（如需要），Storyboarder 再基于实际资产文件生成分镜。**

**5a. Storyboarder Agent — 生成资产清单：**
1. 使用 Read 读取 [agents/storyboarder.md](../agents/storyboarder.md)
2. 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
3. 使用 Agent tool 调用 Storyboarder 子代理，指令：根据 novel.md 判断是否需要新资产（包括角色造型变体），输出资产清单

**5b. Creator Agent — 仅在需要新资产时调用：**
1. 如果不需要新资产，跳过此步骤
2. 使用 Read 读取 [assets/](assets/) 下所有已有资产文件，确保与已有资产一致
3. 使用 Agent tool 调用 Creator 子代理，指令：仅创建新资产文件（包括角色造型变体文件），不修改已有资产的核心内容
4. 对已出场的已有角色/资产，仅使用 Edit 工具追加"出场记录"条目
5. 使用 Write 在 [assets/](assets/) 对应子目录下创建新资产的 `.md` 文件

**5c. Storyboarder Agent — 生成分镜提示词：**
1. 使用 Glob 读取 [assets/](assets/) 目录下所有实际存在的 `.md` 文件列表
2. 使用 Read 读取 [agents/storyboarder.md](../agents/storyboarder.md)
3. 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)
4. 使用 Agent tool 调用 Storyboarder 子代理，prompt 中包含：
   - novel.md 的内容
   - [assets/](assets/) 下所有实际文件的完整路径列表
   - 指令：根据 novel.md 生成分镜提示词，资产引用必须且只能使用上述文件列表中的实际路径
5. 使用 Write 将分镜写入 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)

**5d. Storyboarder 台词密度自检与补充（最多 3 轮）：**
1. Storyboarder 自检每个分镜的台词数量（含对白、自白、旁白、角色声音反应），并检查是否存在超过 2 秒无声音（角色声音或环境音效）的空窗
2. 如果所有分镜均达到 5-8 句 → 通过，进入下一步
3. 如果有分镜台词不足 5-8 句：
   a. 将不足的分镜列表和对应的小说原文段落传给 Writer Agent，请求补充对白/自白
   b. Writer Agent 返回补充的台词
   c. Storyboarder 将补充的台词融入对应分镜，重新生成这些分镜的画面与声音描述
   d. 使用 Write 更新 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)
   e. 回到步骤 1 重新自检
4. 如果已循环 3 轮仍有不足，接受当前结果，不再继续循环

**5e. Director Agent — 审核分镜：**
1. 使用 Read 读取 [agents/director.md](../agents/director.md)
2. 使用 Read 读取 [story/episodes/ep{N+1}/novel.md](story/episodes/ep{N+1}/novel.md)、[story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)、[story/episodes/ep{N+1}/outline.md](story/episodes/ep{N+1}/outline.md)
3. 使用 Glob 读取 [assets/characters/](assets/characters/) 目录下所有 `.md` 文件
4. 使用 Agent tool 调用 Director 子代理，指令：执行职责 4 场景 B — 审核 Storyboarder 分镜，检查分镜与大纲/原文的一致性，参考角色资产确保一致
5. 如果审核结果为"需修改"：
   a. 将 Director 的修改意见传给 Storyboarder Agent 进行修正
   b. Storyboarder 修正后重新提交给 Director 审核（最多 2 轮）
6. 使用 Write 更新 [story/episodes/ep{N+1}/storyboard.md](story/episodes/ep{N+1}/storyboard.md)

**[仅 review mode]** 展示分镜内容和新资产列表给用户确认

### 阶段 6: 完成

1. 输出本集摘要：集数编号、场景数（分镜数量）、新建资产列表（如有）
2. 提示用户可以继续使用 `/short-video` 创作下一集

### 与 New Story 的关键差异

- [story/outline.md](story/outline.md) 严格遵守 **append-only** 规则，只追加不修改已有内容
- Director 读取最近 M 集 novel.md 提供剧情连续性上下文
- Creator 必须检查已有资产避免重复创建，已有资产只追加出场记录
