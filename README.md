# ShortVideoDirector

一个 Claude Code Plugin，通过 4 个 AI 子代理协作，将故事创意转化为 AI 视频分镜提示词和资产图像提示词。

## 功能

- 将故事点子/原文/概述转化为短视频分镜提示词（1-2 分钟/集）
- 自动生成人物、物品、场景、建筑的图像提示词
- 支持持续创作，保持人物、资产和声音在整个故事中的一致性
- 可配置目标 AI 模型（视频模型：Kling/Runway/Pika，图像模型：Midjourney/FLUX/DALL-E）
- 可配置视频风格（2D动漫/3D动漫/3D写实/2D手绘/自定义）
- 首次运行交互式引导配置，支持自定义模型和风格输入
- 支持 Director 自动生成剧情选项供选择，不满意可重新生成或提供偏好
- 用户自行输入时 Director 生成结构化确认说明（即使 fast mode 也不跳过）
- 支持角色换装（独立造型变体文件，需对剧情有实质影响的视觉区分）
- 人物基础资产基于角色气质和世界观设定，剥离职业/场景特定装束
- 分镜采用时间线连贯叙事格式，画面动作、对白、音效自然融合
- 每集开场强力钩子 + 结尾悬念钩子，最大化观众留存
- 高角色台词密度（对白、自白、旁白、角色声音反应），丰富短视频内容表现力
- 支持角色旁白快速补充背景知识（人物介绍、世界观等），加速观众理解
- 丰富的环境音效设计，2 秒内必须有声音（台词或音效）
- 角色声音特征一致性保障
- 版权规避：不使用现实中的明星/公众人物名字、真实地名、商标名
- 资产创建完成后再生成分镜，确保分镜师可引用完整资产信息
- 支持 full-auto 批量生成脚本（`scripts/run-batch.ps1`）

## 四个子代理

| 子代理 | 角色 | 职责 |
|--------|------|------|
| **Director** | 总导演 | 全局统筹、生成剧情大纲、审核 Writer 和 Storyboarder 输出 |
| **Writer** | 网络小说作家 | 根据剧情大纲生成小说原文，擅长悬念设置和人物描写 |
| **Storyboarder** | 分镜师 | 负责资产清单和分镜提示词生成 |
| **Creator** | 创意总监 | 识别并视觉化人物和资产，生成图像提示词和声音特征描述 |

## 安装

```bash
# 通过 --plugin-dir 加载（每次启动时指定）
claude --plugin-dir /path/to/ShortVideoDirector
```

## 使用

```bash
# 开始新故事（提供输入）
/short-video 一个穿越到异世界的少年，发现自己拥有操控时间的能力...

# 开始新故事（从文件读取）
/short-video story-idea.txt

# 开始新故事（指定总集数 + 故事材料，自动生成剧情弧线）
/short-video 30 一个穿越到异世界的少年...
/short-video 30 story-idea.txt

# 开始新故事（仅指定总集数，交互式选择剧情方向）
/short-video 30

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
│   ├── arc.md                  # 剧情弧线（可选，指定总集数时生成）
│   └── episodes/
│       ├── ep01/
│       │   ├── outline.md      # 本集剧情大纲（含资产清单）
│       │   ├── novel.md        # 本集小说原文
│       │   └── storyboard.md   # 本集分镜提示词
│       └── ep02/
│           └── ...
├── assets/
│   ├── characters/             # 人物提示词（含性格特征、声音特征、造型变体）
│   ├── items/                  # 重要物品提示词
│   ├── locations/              # 场景提示词
│   └── buildings/              # 建筑提示词
└── config.md                   # 项目配置
```

## 配置项

首次运行时会交互式引导配置，模型和风格支持自定义输入。

| 配置 | 默认值 | 说明 |
|------|--------|------|
| 视频模型 | generic | generic / kling / runway / seedance2.0 / 自定义 |
| 图像模型 | generic | generic / midjourney / flux / nanobanana / 自定义 |
| 视频风格 | 3D写实 | 2D动漫 / 3D动漫 / 3D写实 / 2D手绘 / 自定义 |
| 语言 | auto | auto / zh / en / 自定义 |
| 每集分镜数 | 15 | 建议 10-20 |
| 每集时长目标 | 1-2分钟 | — |
| 单镜头时长范围 | 10-15秒 | 每个分镜镜头的时长范围 |
| 单镜头资产上限 | 5 | 每个分镜镜头中引用资产的最大数量 |
| 上下文集数 | 1 | 续写时 Director 读取前 N 集 novel.md |
| 默认模式 | review | review（逐步确认）/ fast（直通执行）/ full-auto（全自动） |
| 每集小说字数 | 4000-5000 | 范围格式；单个数字视为上限，下限自动取 80% |

## 工作模式

- **Review mode**：用户审核关键产出（大纲、分镜），Director 审核小说原文（最多 2 轮），Director 始终审核分镜
- **Fast mode**：用户仅在阶段 2a/2b 选择剧情方向和确认输入，其余步骤自动执行，Director 始终审核分镜
- **Full-auto mode**：全自动执行，所有决策由 Director 自主做出（自动选择最能吸引观众的剧情方向），无需任何用户交互。Director 始终审核分镜

## 工作流程

### New Story（新故事）

1. 创建目录结构 + 交互式配置引导
2. 用户提供输入或让 Director 生成主题选项（review/fast 下用户选择；full-auto 下 Director 自动选择）
3. Director 生成结构化确认说明供用户确认（review/fast 下用户确认；full-auto 下自动确认）
4. （可选）若指定总集数且 arc.md 不存在 → Director 生成剧情弧线
5. Director 生成本集剧情大纲（参考 arc 如有）
6. Writer 生成小说原文（review mode 下 Director 审核）
7. Storyboarder 生成资产清单（写入 ep outline.md）
8. Creator 创建新资产
9. Storyboarder 生成分镜
10. Director 审核分镜（最多 2 轮修改反馈）

### Continue Story（续写）

1. 检测最新集数，创建新集目录
2. 用户提供输入或让 Director 生成剧情走向选项（review/fast 下用户选择；full-auto 下 Director 自动选择）
3. Director 生成结构化确认说明供用户确认（review/fast 下用户确认；full-auto 下自动确认）
4. （可选）若指定总集数且 arc.md 不存在 → Director 生成剧情弧线
5. Director 生成新集大纲（append-only 追加到总大纲，参考 arc 如有）
6. Writer 生成小说原文（参考最近 M 集小说和角色资产）
7. Storyboarder 生成资产清单（写入 ep outline.md，含新增和已有资产）
8. **并行执行**：Creator 创建新资产 + Creator 更新已有资产出场记录
9. Storyboarder 生成分镜
10. Director 审核分镜（最多 2 轮修改反馈）

## 分镜格式

每个镜头包含：引用资产、镜头类型、镜头运动、视频风格、时长、转场，以及按时间线组织的连贯叙事描述：

```
[0s-3s] 阴暗的石室内，火把在墙上摇曳，低沉的风声回荡。张三（低沉沙哑男声）站在
石门前，眉头紧锁，双手握拳，低声说："这扇门后面，就是答案。"
[3s-9s] 他深吸一口气，猛地抬手推开石门，门轴发出刺耳的摩擦声，碎石从门框上簌簌
掉落。张三（低沉沙哑男声）旁白道："三年了……终于走到这里。那一刻我才明白，这里
不只是一个墓穴——它是一整个被遗忘的世界。"
[9s-12s] 他向前迈出一步，靴底踩在碎石上咔嚓作响，眼睛猛然睁大。远处传来悠扬的
古琴旋律，画面渐暗。
```

> 画面动作、角色台词、音效必须融合为连贯叙事段落，禁止分离列举。时间段划分根据叙事节奏灵活调整。

## 一致性规则

- `outline.md` 是 append-only，新集只追加不修改已有内容
- 已有资产的核心视觉描述和声音特征不可修改，只能追加出场记录
- 角色换装通过独立造型变体文件实现（`角色名-造型名.md`）
- 角色说话时声音特征必须与资产文件中的描述一致
- Director 只规划当前集，不预设后续剧情
- 不使用现实中的明星/公众人物名字、真实地名、商标名，必要时使用虚构替代
- 资产文件名必须与资产名称完全一致，不得翻译或转写
- 所有输出内容（含视觉描述提示词）语言严格遵循 config.md 语言设置

## 批量生成

使用 `scripts/run-batch.ps1` 在 full-auto 模式下批量生成多集内容：

```powershell
# 新故事，30集规划，本次生成5集
.\scripts\run-batch.ps1 -WorkDir "C:\projects\my-story" -PluginDir "C:\path\to\ShortVideoDirector" -TotalEpisodes 30 -NewEpisodes 5 -StoryInput "一个外卖小哥穿越到古代的故事"

# 续写10集
.\scripts\run-batch.ps1 -WorkDir "C:\projects\my-story" -PluginDir "C:\path\to\ShortVideoDirector" -TotalEpisodes 30 -NewEpisodes 10

# 纯续写3集，生成后推送 GitHub
.\scripts\run-batch.ps1 -WorkDir "C:\projects\my-story" -PluginDir "C:\path\to\ShortVideoDirector" -NewEpisodes 3 -Push
```

**参数：**
- `-WorkDir`（必填）— 项目工作目录
- `-PluginDir`（必填）— ShortVideoDirector 插件目录路径
- `-TotalEpisodes`（可选）— 总集数，仅当 arc.md 不存在时传给 claude
- `-NewEpisodes`（必填）— 本次新增集数
- `-StoryInput`（可选）— 故事材料（文本或文件路径），仅第一集传入
- `-Push`（可选）— 每集生成后自动 git commit + push

**退出条件（满足任一）：** 新增集数达标 或 总集数达标

## 插件结构

```
ShortVideoDirector/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── director.md              # Director（总导演）
│   ├── writer.md                # Writer（小说作家）
│   ├── storyboarder.md          # Storyboarder（分镜师）
│   └── creator.md               # Creator（创意总监）
├── skills/
│   ├── short-video/             # 主入口 skill
│   │   ├── SKILL.md
│   │   └── config-template.md
│   ├── new-story/               # 新故事工作流
│   │   └── SKILL.md
│   ├── continue-story/          # 续写工作流
│   │   └── SKILL.md
│   ├── director-plot-options/   # Director 生成剧情选项
│   ├── director-input-confirm/  # Director 确认用户输入
│   ├── director-outline/        # Director 生成大纲
│   ├── director-arc/            # Director 生成弧线
│   ├── director-review-novel/   # Director 审核小说
│   ├── director-review-storyboard/ # Director 审核分镜
│   ├── writer-novel/            # Writer 生成小说
│   ├── storyboarder-asset-list/ # Storyboarder 生成资产清单
│   ├── storyboarder-storyboard/ # Storyboarder 生成分镜
│   ├── creator-create-assets/   # Creator 创建资产
│   └── creator-update-records/  # Creator 更新出场记录
├── scripts/
│   └── run-batch.ps1            # 批量生成脚本
└── README.md
```
