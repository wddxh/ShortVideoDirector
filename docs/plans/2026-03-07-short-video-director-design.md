# ShortVideoDirector 设计文档

## 概述

ShortVideoDirector 是一个独立的 Claude Code skill plugin，通过 3 个 subagent 协作，将故事创意转化为 AI 视频分镜提示词和资产图像提示词。支持持续创作，保持人物和资产在整个故事中的一致性。每集短视频时长约 1-2 分钟。

## 架构

### Skill Plugin 文件结构

```
short-video-director/
├── skill.md                    # 主skill文件，处理invocation和orchestration
├── agents/
│   ├── director.md             # Director agent system prompt
│   ├── writer.md               # Writer agent system prompt
│   └── creator.md              # Creator agent system prompt
└── templates/
    └── config.md               # config.md 模板，首次运行时复制到用户项目
```

### 用户项目目录结构（生成内容）

```
project/
├── story/
│   ├── outline.md              # 整体故事大纲（append-only）
│   └── episodes/
│       ├── ep01/
│       │   ├── outline.md      # 本集剧情大纲
│       │   ├── novel.md        # 本集小说原文
│       │   └── storyboard.md   # 本集分镜提示词
│       └── ep02/
│           └── ...
├── assets/
│   ├── characters/             # 人物提示词
│   ├── items/                  # 重要物品提示词
│   ├── locations/              # 场景提示词
│   └── buildings/              # 建筑提示词
└── config.md                   # 项目配置
```

## 三个 Subagent

### Director Agent（总导演）

- **角色：** 经验丰富的短视频导演，全局统筹
- **职责：**
  - 根据用户输入生成本集剧情大纲
  - 维护 outline.md（append-only）
  - 将小说原文转化为分镜提示词
  - 为 Creator 提供新资产清单
  - Review mode 下审核 Writer 输出（最多2轮修改）
- **输入（new mode）：** 用户原始输入 + config
- **输入（continue mode）：** 用户新输入 + outline.md + 最近N集 novel.md
- **输出：** 本集 outline.md、追加到 story/outline.md、storyboard.md、Creator 指令
- **关键要求：** 每集剧情跌宕起伏，结尾设置悬念

### Writer Agent（网络小说作家）

- **角色：** 热门网络小说作家，文笔精良
- **职责：** 根据 Director 的剧情大纲生成小说原文
- **输入：** 本集剧情大纲 + outline.md（整体背景）
- **输出：** 本集 novel.md
- **关键要求：** 擅长从零碎信息拼凑完整故事，悬念设置，人物描写细腻

### Creator Agent（创意总监）

- **角色：** 经验丰富的创意总监，资产视觉化
- **职责：** 识别并视觉化人物和资产，生成图像提示词
- **输入：** 本集 novel.md + Director 提供的资产清单 + 已有 assets/ 文件
- **输出：** assets/ 下的新建 .md 文件
- **关键要求：** 已有资产核心视觉描述不可修改（只可追加），新资产风格与已有资产保持一致

## 资产文件格式

每个 assets/ 下的 .md 文件：

```markdown
# 角色名/物品名

## 基本信息
- 首次出场：EP01
- 类型：主角/配角/道具/场景/建筑

## 视觉描述
（自然语言的外观描述，作为一致性基准）

## 图像生成提示词
（针对目标图像模型的提示词）

## 出场记录
- EP01: 简要描述在该集中的表现
```

## 分镜提示词格式（Rich模式）

每个镜头包含：
- 镜头编号
- 镜头类型（特写/全景/中景等）
- 视觉描述提示词
- 时长估计
- 镜头运动说明
- 对白/旁白文本
- 背景音乐/音效说明
- 转场类型

分镜文件顶部包含引用列表（列出本集使用的所有角色/资产及对应 assets/ 文件链接），镜头内使用短描述保持可读性。

## 工作流

### 调用方式

- `/short-video` — 主命令，自动检测 new/continue 模式
- `/short-video config` — 打开/编辑 config.md
- 输入方式：inline text / file path / interactive（自动fallback）

### New Story Flow

1. `/short-video [input]`
2. 检测无 story/ 文件夹 → new story mode
3. 创建目录结构 + config.md
4. 询问：review mode 或 fast mode
5. Director Agent：读取 input → 生成 EP01 剧情大纲，创建 outline.md
6. [Review] Director 展示大纲 → 用户确认/修改
7. Writer Agent：根据大纲 → 生成 EP01 小说原文
8. [Review] Director 审核原文 → 可要求 Writer 修改（最多2轮）
9. 并行执行：
   - Director Agent：原文 → 分镜提示词
   - Creator Agent：原文 + Director 资产清单 → 人物/资产提示词
10. [Review] 展示分镜和资产 → 用户确认
11. 输出完成，展示本集摘要

### Continue Story Flow

1. `/short-video [input]`
2. 检测 story/ 存在 → continue mode，检测最新集数
3. Director Agent：读取 input + outline.md + 最近N集 novel.md → 生成新集大纲，append 到 outline.md
4. [Review] Director 展示大纲 → 用户确认/修改
5. Writer Agent：根据大纲 + outline.md → 生成新集小说原文
6. [Review] Director 审核原文 → 可要求 Writer 修改（最多2轮）
7. Director 判断是否需要新资产，并行执行：
   - Director Agent：原文 → 分镜提示词
   - Creator Agent（如需要）：读取已有 assets/ → 仅创建新资产
8. [Review] 展示分镜和新资产 → 用户确认
9. 输出完成，展示本集摘要

## 配置

```markdown
# ShortVideoDirector 配置

## 模型配置
- 视频模型: generic          # generic / kling / runway / pika
- 图像模型: generic          # generic / midjourney / flux / dall-e

## 创作配置
- 语言: auto                 # auto(跟随输入语言) / zh / en
- 每集分镜数: 15             # 建议10-20
- 每集时长目标: 1-2分钟
- 上下文集数: 3              # continue mode时Director读取前N集novel.md
- 默认模式: review           # review / fast
```

## 一致性规则

1. **outline.md 是 append-only** — 新集只追加，不修改已有内容
2. **已有资产文件的核心视觉描述不可修改** — Creator 只能追加出场记录和补充信息
3. **分镜引用资产时必须与 assets/ 中的描述一致** — Hybrid 模式：分镜内短描述 + 顶部引用列表
4. **新资产创建前，Creator 必须检查已有 assets/ 避免重复**
5. **Director 读取最近N集 novel.md** — N 由 config 中 `上下文集数` 控制

## Agent 调度方式

- 每个 subagent 通过 Claude Code 的 Agent tool 调用
- 对应的 agents/*.md 内容作为 system prompt 传给 Agent
- Agent 输出由 skill.md 主流程接收、校验后写入对应文件
- Review mode 下关键节点暂停等待用户确认
- Fast mode 跳过所有 review 步骤直通执行
