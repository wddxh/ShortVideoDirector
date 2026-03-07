# ShortVideoDirector

一个 Claude Code Skill 插件，通过 3 个 AI 子代理协作，将故事创意转化为 AI 视频分镜提示词和资产图像提示词。

## 功能

- 将故事点子/原文/概述转化为短视频分镜提示词（1-2 分钟/集）
- 自动生成人物、物品、场景、建筑的图像提示词
- 支持持续创作，保持人物和资产在整个故事中的一致性
- 可配置目标 AI 模型（视频模型：Kling/Runway/Pika，图像模型：Midjourney/FLUX/DALL-E）
- 支持 Director 自动生成剧情选项供选择

## 三个子代理

| 子代理 | 角色 | 职责 |
|--------|------|------|
| **Director** | 总导演 | 全局统筹、生成剧情大纲和分镜提示词、审核 Writer 输出 |
| **Writer** | 网络小说作家 | 根据剧情大纲生成小说原文，擅长悬念设置和人物描写 |
| **Creator** | 创意总监 | 识别并视觉化人物和资产，生成图像提示词 |

## 安装

将本项目目录复制到 Claude Code 的 skills 目录：

```bash
cp -r ShortVideoDirector ~/.claude/skills/short-video-director
```

## 使用

```bash
# 开始新故事（提供输入）
/short-video 一个穿越到异世界的少年，发现自己拥有操控时间的能力...

# 开始新故事（从文件读取）
/short-video story-idea.txt

# 开始新故事（交互式，可让 Director 生成主题选项）
/short-video

# 续写故事（自动检测已有 story/ 目录）
/short-video 主角发现了隐藏在古城下的秘密通道...

# 编辑配置
/short-video config
```

## 生成的目录结构

```
your-project/
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

## 配置项

| 配置 | 默认值 | 说明 |
|------|--------|------|
| 视频模型 | generic | generic / kling / runway / pika |
| 图像模型 | generic | generic / midjourney / flux / dall-e |
| 语言 | auto | auto / zh / en |
| 每集分镜数 | 15 | 建议 10-20 |
| 每集时长目标 | 1-2分钟 | — |
| 上下文集数 | 3 | 续写时 Director 回顾的历史集数 |
| 默认模式 | review | review（逐步确认）/ fast（直通执行） |

## 工作模式

- **Review mode**：每个关键步骤暂停展示给用户确认，Director 审核 Writer 输出（最多 2 轮）
- **Fast mode**：跳过所有确认步骤，直通执行完整流程

## 一致性规则

- `outline.md` 是 append-only，新集只追加不修改已有内容
- 已有资产的核心视觉描述不可修改，只能追加出场记录
- 分镜引用资产时使用 Hybrid 模式（短描述 + 顶部引用列表）
