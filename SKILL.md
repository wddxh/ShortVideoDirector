---
name: short-video
description: 将故事创意转化为AI视频分镜提示词和资产图像提示词。支持持续创作，自动检测新故事/续写模式。输入故事点子、原文或概述，输出完整的分镜和资产提示词。使用 /short-video 启动，/short-video config 编辑配置。
---

## 概述

本技能将故事创意转化为 AI 视频分镜提示词和资产图像提示词。

工作流程由 3 个子代理协作完成：
- **Director（总导演）**：统筹全局，生成剧情大纲和分镜提示词，审核 Writer 输出
- **Writer（小说作家）**：根据剧情大纲生成小说原文，擅长悬念设置和人物描写
- **Creator（创意总监）**：识别并视觉化人物和资产，生成图像提示词

支持两种模式：
- **新故事模式**：从零开始创建故事、大纲、分镜和资产
- **续写模式**：基于已有故事继续创作新的集数

系统根据当前目录中是否存在 `story/` 文件夹自动检测模式。

## 输入解析

根据用户输入 `args` 的内容进行分流：

1. **`args` 为 `"config"`**：使用 Read 工具打开当前目录下的 `config.md`，展示给用户，询问是否需要编辑。
2. **`args` 看起来像文件路径**（以 `.txt` 或 `.md` 结尾）：使用 Read 工具读取该文件内容，作为故事输入。
3. **`args` 包含内联文本**：直接将该文本作为故事输入。
4. **无 `args`**：交互式询问用户，提供两个选项：
   - **A. 自己提供故事输入**：用户输入故事点子/原文/概述
   - **B. 让 Director 生成剧情选项**：Director 生成 3 个方向供用户选择（新故事模式下为热门主题，续写模式下为剧情走向）

## 模式检测

使用 Glob 工具检查当前工作目录下是否存在 `story/` 文件夹：

- **未找到 `story/`** → 进入**新故事模式**
- **找到 `story/`** → 进入**续写模式**，使用 Glob 匹配 `story/episodes/ep*/` 找到最新集数编号，从下一集继续

## 配置加载

1. 使用 Read 工具检查当前工作目录下是否存在 `config.md`
2. 若已存在 → 读取并解析配置值
3. 若不存在 → 进入**交互式配置引导**（仅首次运行）：
   a. 询问视频模型，提供选项：generic / kling / runway / pika / 自定义输入（用户可输入任意模型名称）
   b. 询问图像模型，提供选项：generic / midjourney / flux / dall-e / 自定义输入（用户可输入任意模型名称）
   c. 询问视频风格，提供选项：2D动漫 / 3D动漫 / 3D写实 / 2D手绘 / 自定义输入（用户可输入任意风格描述）
   d. 询问语言，提供选项：auto / zh / en
   e. 询问每集分镜数（默认 15，建议 10-20）
   f. 询问上下文集数（默认 1，建议 1-5；说明：续写时 Director 读取前 N 集 novel.md 作为剧情上下文）
   g. 询问默认模式：review / fast
   h. 告知用户其余配置使用默认值（每集时长目标: 1-2分钟、单镜头时长范围: 5-10秒），可通过 `/short-video config` 随时修改
   i. 根据用户选择生成 `config.md` 写入项目根目录
4. 解析以下配置值：
   - **视频模型**：用于生成视频的 AI 模型
   - **图像模型**：用于生成资产图像的 AI 模型
   - **视频风格**：视频的视觉风格（2D动漫/3D动漫/3D写实/2D手绘等）
   - **语言**：提示词输出语言
   - **每集分镜数**：每集包含的分镜数量
   - **每集时长目标**：每集目标时长
   - **单镜头时长范围**：每个分镜镜头的时长约束
   - **上下文集数**：续写时回顾的历史集数
   - **默认模式**：默认工作模式

## 目录结构

创建以下项目目录结构：

```
project/
├── story/
│   ├── outline.md
│   └── episodes/
│       └── ep01/
├── assets/
│   ├── characters/
│   ├── items/
│   ├── locations/
│   └── buildings/
└── config.md
```

## New Story 工作流

### Step 0: 初始化

1. 使用 Bash 创建目录结构：`story/`、`story/episodes/ep01/`、`assets/characters/`、`assets/items/`、`assets/locations/`、`assets/buildings/`
2. 执行**配置加载**流程（见上方"配置加载"章节）：若 `config.md` 不存在则进入交互式配置引导，逐项询问用户
3. 询问用户选择 **review mode** 或 **fast mode**（展示 config 中 `默认模式` 的值作为默认选项）

### Step 0.5: Director 生成主题选项（可选）

仅在用户选择"让 Director 生成剧情选项"时执行：

1. 使用 Read 读取 `agents/director.md`
2. 使用 **Agent tool** 调用 Director 子代理，指令：生成 3 个经典/热门的网络小说主题方向（含主题名称、核心设定、开篇钩子、卖点分析）
3. 展示选项给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过]**
   - **A/B/C** — 选择对应的主题方向
   - **D. 重新生成** — Director 直接生成全新的 3 个方向
   - **E. 告诉 Director 你的偏好** — 用户描述偏好方向后，Director 据此生成新的 3 个选项
4. 若用户选择 D → 重新调用 Director Agent 生成全新 3 个选项，回到步骤 3
5. 若用户选择 E → 收集用户偏好描述，将偏好传给 Director Agent 生成新的 3 个选项，回到步骤 3
6. 若用户选择 A/B/C → 将用户选择的主题作为故事输入，继续 Step 1

### Step 0.6: Director 生成输入确认说明（可选）

仅在用户选择"自己提供故事输入"时执行（即未走 Step 0.5）：

1. 使用 Read 读取 `agents/director.md`
2. 使用 **Agent tool** 调用 Director 子代理，指令：基于用户提供的故事输入，生成一份结构化说明（含主题名称、核心设定、开篇钩子、卖点分析），格式与 Step 0.5 的选项一致
3. 展示说明给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过]**
   - **A. 确认** — 以此说明为基础继续 Step 1
   - **B. 重新生成** — Director 基于同样的用户输入重新诠释
   - **C. 补充说明** — 用户描述不满意的地方，Director 据此调整后重新生成
4. 若用户选择 B → 重新调用 Director Agent，回到步骤 3
5. 若用户选择 C → 收集用户反馈，传给 Director Agent 重新生成，回到步骤 3
6. 若用户选择 A → 继续 Step 1

### Step 1: Director 生成剧情大纲

1. 使用 Read 读取 `agents/director.md`
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - `agents/director.md` 的内容
   - 用户的故事输入（或 Step 0.5 中用户选择的主题，或 Step 0.6 中用户确认的结构化说明）
   - `config.md` 的配置内容
   - 指令：生成 EP01 剧情大纲
3. 使用 Write 将本集大纲写入 `story/episodes/ep01/outline.md`
4. 使用 Write 将整体故事大纲写入 `story/outline.md`
5. **[仅 review mode]** 展示大纲给用户确认；若用户不满意，根据反馈重新调用 Director Agent 修改

### Step 2: Writer 生成小说原文

1. 使用 Read 读取 `agents/writer.md`、`story/episodes/ep01/outline.md`、`story/outline.md`
2. 使用 **Agent tool** 调用 Writer 子代理，提供本集大纲 + 整体大纲
3. 使用 Write 将输出写入 `story/episodes/ep01/novel.md`
4. **[仅 review mode]** 使用 Agent tool 调用 Director Agent 审核 `novel.md`，将修改意见反馈给 Writer Agent 进行修改（最多 2 轮）

### Step 3: Creator 生成资产 → Director 生成分镜（串行）

**注意：以下子任务必须串行执行，Creator 先完成资产创建，Director 再基于实际资产文件生成分镜。**

**3a. Director Agent — 输出资产清单：**
1. 使用 Read 读取 `story/episodes/ep01/novel.md`
2. 使用 Agent tool 调用 Director 子代理，指令：根据 novel.md 分析需要新建的资产（包括角色造型变体），输出资产清单
3. 将资产清单传递给 Creator

**3b. Creator Agent — 生成资产：**
1. 使用 Read 读取 `story/episodes/ep01/novel.md` + Director 输出的资产清单
2. 使用 Agent tool 调用 Creator 子代理，指令：为每个资产生成描述文件（包括角色造型变体文件）
3. 使用 Write 在 `assets/` 对应子目录（`characters/`、`items/`、`locations/`、`buildings/`）下创建每个资产的 `.md` 文件

**3c. Director Agent — 生成分镜：**
1. 使用 Glob 读取 `assets/` 目录下所有实际存在的 `.md` 文件列表
2. 使用 Read 读取 `story/episodes/ep01/novel.md`
3. 使用 Agent tool 调用 Director 子代理，prompt 中包含：
   - novel.md 的内容
   - `assets/` 下所有实际文件的完整路径列表
   - 指令：根据 novel.md 生成分镜提示词，资产引用必须且只能使用上述文件列表中的实际路径
4. 使用 Write 将分镜写入 `story/episodes/ep01/storyboard.md`

**3d. Director 台词密度自检与补充（最多 3 轮）：**
1. Director 自检每个分镜的台词数量（含对白、自白、角色声音反应），并检查是否存在超过 3 秒无角色声音的空窗
2. 如果所有分镜均达到 5-8 句 → 通过，进入下一步
3. 如果有分镜台词不足 5-8 句：
   a. 将不足的分镜列表和对应的小说原文段落传给 Writer Agent，请求补充对白/自白
   b. Writer Agent 返回补充的台词
   c. Director 将补充的台词融入对应分镜，重新生成这些分镜的画面与声音描述
   d. 使用 Write 更新 `story/episodes/ep01/storyboard.md`
   e. 回到步骤 1 重新自检
4. 如果已循环 3 轮仍有不足，接受当前结果，不再继续循环

**[仅 review mode]** 展示分镜内容和新建资产列表给用户确认

### Step 4: 完成

1. 输出本集摘要：集数编号、场景数（分镜数量）、新建资产列表
2. 提示用户可以使用 `/short-video` 继续创作下一集

## Continue Story 工作流

### Step 0: 上下文收集

1. 使用 Read 读取 `story/outline.md`
2. 使用 Glob 匹配 `story/episodes/ep*/` 检测最新集数 N
3. 使用 Read 读取 `config.md`，获取 `上下文集数` 配置值 M
4. 使用 Read 读取最近 M 集的 `novel.md`（如 `ep{N-2}/novel.md`、`ep{N-1}/novel.md`、`ep{N}/novel.md`）
5. 使用 Glob 列出 `assets/` 下所有已有资产文件
6. 使用 Bash 创建新集目录 `story/episodes/ep{N+1}/`
7. 询问用户选择 **review mode** 或 **fast mode**

### Step 0.5: Director 生成剧情走向选项（可选）

仅在用户选择"让 Director 生成剧情选项"时执行：

1. 使用 Read 读取 `agents/director.md`
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - `agents/director.md` 的内容
   - `story/outline.md` 的内容
   - 最近 M 集的 `novel.md` 内容
   - 指令：根据已有剧情，生成 3 个不同的剧情走向选项（稳健/激进/拓展），每个含关键转折、涉及角色、悬念预设、对整体剧情的影响
3. 展示选项给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过]**
   - **A/B/C** — 选择对应的剧情走向
   - **D. 重新生成** — Director 直接生成全新的 3 个走向
   - **E. 告诉 Director 你的偏好** — 用户描述偏好方向后，Director 据此生成新的 3 个走向
4. 若用户选择 D → 重新调用 Director Agent 生成全新 3 个走向，回到步骤 3
5. 若用户选择 E → 收集用户偏好描述，将偏好传给 Director Agent 生成新的 3 个走向，回到步骤 3
6. 若用户选择 A/B/C → 将用户选择的走向作为本集创作方向，继续 Step 1

### Step 0.6: Director 生成输入确认说明（可选）

仅在用户选择"自己提供故事输入"时执行（即未走 Step 0.5）：

1. 使用 Read 读取 `agents/director.md`
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - `agents/director.md` 的内容
   - 用户提供的故事输入
   - `story/outline.md` 的内容
   - 最近 M 集的 `novel.md` 内容
   - 指令：基于用户输入和已有剧情上下文，生成一份结构化说明（含剧情走向名称、关键转折、涉及角色、悬念预设、对整体剧情的影响），格式与 Step 0.5 的选项一致
3. 展示说明给用户，提供以下选择：**[即使 fast mode 也必须等待用户确认，不可跳过]**
   - **A. 确认** — 以此说明为基础继续 Step 1
   - **B. 重新生成** — Director 基于同样的用户输入重新诠释
   - **C. 补充说明** — 用户描述不满意的地方，Director 据此调整后重新生成
4. 若用户选择 B → 重新调用 Director Agent，回到步骤 3
5. 若用户选择 C → 收集用户反馈，传给 Director Agent 重新生成，回到步骤 3
6. 若用户选择 A → 继续 Step 1

### Step 1: Director 生成新集大纲

1. 使用 Read 读取 `agents/director.md`
2. 使用 **Agent tool** 调用 Director 子代理，prompt 中包含：
   - 用户的新输入（或 Step 0.5 中用户选择的剧情走向，或 Step 0.6 中用户确认的结构化说明）
   - `story/outline.md` 的内容
   - 最近 M 集的 `novel.md` 内容
   - `config.md` 的配置内容
   - 指令：生成 EP{N+1} 剧情大纲，保持与前文的剧情连续性
3. 使用 Write 写入 `story/episodes/ep{N+1}/outline.md`
4. 使用 Edit 工具 **追加** 新内容到 `story/outline.md`（append-only，不修改已有内容）
5. **[仅 review mode]** 展示大纲给用户确认；若用户不满意，根据反馈重新调用 Director Agent 修改

### Step 2: Writer 生成小说原文

1. 使用 Read 读取 `agents/writer.md`、`story/episodes/ep{N+1}/outline.md`、`story/outline.md`
2. 使用 **Agent tool** 调用 Writer 子代理，提供本集大纲 + 整体大纲
3. 使用 Write 将输出写入 `story/episodes/ep{N+1}/novel.md`
4. **[仅 review mode]** 使用 Agent tool 调用 Director Agent 审核 `novel.md`，将修改意见反馈给 Writer Agent 进行修改（最多 2 轮）

### Step 3: Creator 生成资产 → Director 生成分镜（串行）

**注意：以下子任务必须串行执行，Creator 先完成资产创建（如需要），Director 再基于实际资产文件生成分镜。**

**3a. Director Agent — 输出资产清单：**
1. 使用 Read 读取 `story/episodes/ep{N+1}/novel.md`
2. 使用 Agent tool 调用 Director 子代理，指令：根据 novel.md 判断是否需要新资产（包括角色造型变体），输出资产清单

**3b. Creator Agent — 仅在需要新资产时调用：**
1. 如果不需要新资产，跳过此步骤
2. 使用 Read 读取 `assets/` 下所有已有资产文件，确保与已有资产一致
3. 使用 Agent tool 调用 Creator 子代理，指令：仅创建新资产文件（包括角色造型变体文件），不修改已有资产的核心内容
4. 对已出场的已有角色/资产，仅使用 Edit 工具追加"出场记录"条目
5. 使用 Write 在 `assets/` 对应子目录下创建新资产的 `.md` 文件

**3c. Director Agent — 生成分镜：**
1. 使用 Glob 读取 `assets/` 目录下所有实际存在的 `.md` 文件列表
2. 使用 Read 读取 `story/episodes/ep{N+1}/novel.md`
3. 使用 Agent tool 调用 Director 子代理，prompt 中包含：
   - novel.md 的内容
   - `assets/` 下所有实际文件的完整路径列表
   - 指令：根据 novel.md 生成分镜提示词，资产引用必须且只能使用上述文件列表中的实际路径
4. 使用 Write 将分镜写入 `story/episodes/ep{N+1}/storyboard.md`

**3d. Director 台词密度自检与补充（最多 3 轮）：**
1. Director 自检每个分镜的台词数量（含对白、自白、角色声音反应），并检查是否存在超过 3 秒无角色声音的空窗
2. 如果所有分镜均达到 5-8 句 → 通过，进入下一步
3. 如果有分镜台词不足 5-8 句：
   a. 将不足的分镜列表和对应的小说原文段落传给 Writer Agent，请求补充对白/自白
   b. Writer Agent 返回补充的台词
   c. Director 将补充的台词融入对应分镜，重新生成这些分镜的画面与声音描述
   d. 使用 Write 更新 `story/episodes/ep{N+1}/storyboard.md`
   e. 回到步骤 1 重新自检
4. 如果已循环 3 轮仍有不足，接受当前结果，不再继续循环

**[仅 review mode]** 展示分镜内容和新资产列表给用户确认

### Step 4: 完成

1. 输出本集摘要：集数编号、场景数（分镜数量）、新建资产列表（如有）
2. 提示用户可以继续使用 `/short-video` 创作下一集

### 与 New Story 的关键差异

- `story/outline.md` 严格遵守 **append-only** 规则，只追加不修改已有内容
- Director 读取最近 M 集 `novel.md` 提供剧情连续性上下文
- Creator 必须检查已有资产避免重复创建，已有资产只追加出场记录
