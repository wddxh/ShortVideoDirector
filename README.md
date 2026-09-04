# ShortVideoDirector

一个以 Claude Code 为主体的插件，通过 5 个 AI 子代理协作，将故事创意转化为 AI 视频分镜提示词、资产参考图片和视频片段。Codex 与 OpenCode 支持以兼容层形式提供。

本仓库只维护一套事实上的 skill 内容层：`skills/`。Claude Code 直接加载这套源 skills；Codex 通过 `.codex/` 下生成的轻量适配层执行同一套 skill 内容；OpenCode 通过 `.opencode/` 下的运行时插件加载（启动时把 skills 转换缓存到 `~/.cache/short-video-director/<hash>/`，不污染源仓库）。

## 功能

- 将故事点子/原文/概述转化为短视频分镜提示词（1-2 分钟/集）
- 自动生成人物、物品、场景、建筑的图像提示词
- 支持持续创作，保持人物、资产和声音在整个故事中的一致性
- 支持即梦CLI（Dreamina）自动生成资产参考图片，与分镜流程并行执行
- 支持即梦CLI（Dreamina）异步生成视频片段，分镜自动转化为 multimodal2video prompt，资产图片作为全能参考
- 视频生成定时任务（`/auto-video`），自动查询状态、下载完成视频、重试因并行限制失败的任务
- 视频生成失败智能判断：LLM 分析 fail_reason，可重试的自动重试，需人工介入的交互修复
- 可配置图像模型（none / dreamina）和视频模型（none / dreamina），选择 dreamina 后可配置模型版本、比例、分辨率
- 可配置视频风格（2D动漫/3D动漫/3D写实/2D手绘/自定义）
- 首次运行交互式引导配置，支持自定义模型和风格输入
- 支持 Director 自动生成剧情选项供选择，不满意可重新生成或提供偏好
- 用户自行输入时 Director 生成结构化确认说明（default mode 下等待用户确认；full-auto mode 下自动确认）
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
- 剧情弧线（arc）支持每集剧情规划，outline 严格遵循 arc 分集规划
- 支持 full-auto 批量生成脚本（`scripts/run-batch.ps1`）

## 五个子代理

| 子代理 | 角色 | 职责 |
|--------|------|------|
| **Director** | 总导演 | 全局统筹、生成剧情大纲、审核 Writer/Scriptwriter 和 Storyboarder 输出 |
| **Writer** | 网络小说作家 | 根据剧情大纲生成小说原文，擅长悬念设置和人物描写 |
| **Scriptwriter** | 短视频编剧 | 将大纲转化为剧本，擅长在极短篇幅内构建完整故事 |
| **Storyboarder** | 分镜师 | 把剧本翻译为七字段 shot 时间线和完整视听 prose，不规划 panel |
| **Creator** | 创意总监 | 创建基础视觉资产，并为每个 shot 规划和生成 storyboard sheet |

## 安装

```bash
# 通过 --plugin-dir 加载（每次启动时指定）
claude --plugin-dir /path/to/ShortVideoDirector
```

### For OpenCode users

本仓库同时支持 OpenCode（`.opencode/` 兼容层）。在 `~/.config/opencode/opencode.json` 添加：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"
  ]
}
```

启动 OC 即按 `agents/` 与 `skills/*/SKILL.md` 动态注册当前子代理和 skills。完整安装/升级/troubleshooting 说明见 [`.opencode/README.md`](./.opencode/README.md)。

## Codex

Codex 支持是对 Claude Code plugin 的兼容层，由 `.codex-plugin/plugin.json` 提供。

Claude Code 是主要运行目标，直接从 `skills/` 加载源 skills。Codex 从 `.codex/skills/` 加载生成的轻量适配层；每个适配层会应用 `.codex/tool-mapping.md`，并执行原始源 skill。

只维护 `skills/` 这一套事实上的 skill 内容层。修改 skill 行为时只改 `skills/`；修改源 skill 头部元数据或 Codex 映射后，重新生成 Codex 适配层：

```bash
python3 .codex/build-codex-skills.py
```

## 模型要求

本插件按任务复杂度分配模型：编排与 Director 审核通常使用 Opus，内容生成和机械执行通常使用 Sonnet；以各源 skill frontmatter 为准。

**前置条件**：账号需同时有 Opus 和 Sonnet 访问权限。

只有 Sonnet 配额时，可全局降级：

```bash
CLAUDE_CODE_SUBAGENT_MODEL=sonnet claude ...
```

env var 优先级最高，会覆盖所有 frontmatter 的 `model`，整个 session 全跑 Sonnet（编排稳定性可能受影响）。

## 使用

```bash
# 开始新故事（提供输入）
/series-video 一个穿越到异世界的少年，发现自己拥有操控时间的能力...

# 开始新故事（从文件读取）
/series-video story-idea.txt

# 开始新故事（指定总集数 + 故事材料，自动生成剧情弧线）
/series-video 30 一个穿越到异世界的少年...
/series-video 30 story-idea.txt

# 开始新故事（仅指定总集数，交互式选择剧情方向）
/series-video 30

# 开始新故事（交互式，可让 Director 生成主题选项）
/series-video

# 续写故事（自动检测已有 story/ 目录）
/series-video 主角发现了隐藏在古城下的秘密通道...

# 编辑配置
/series-video config
```

```bash
# 单集短视频（独立完整故事）
/short-video 一个外卖小哥送错餐发现客户是自己的前女友
/short-video story-idea.txt
/short-video
/short-video config
```

```bash
# 编辑已有内容（自然语言，自动判断系列/单集）
/edit-story ep01大纲的集尾钩子改成更有悬念的
/edit-story ep02分镜镜头3的台词太少，增加内心独白
/edit-story ep03主角的外貌描述改成短发
/edit-story 在ep01的资产清单中增加一个新角色"老王"
/edit-story 重新生成张三的参考图片
/edit-story 张三的头发改成红色，重新生成图片
/edit-story 大纲的结局改成开放式结局
/edit-story 剧本场景2的台词太少，增加内心独白
```

```bash
# 修复中断的生成（自动检测系列/单集 + 最新一集）
/repair-story ep03
/repair-story            # 自动检测最新一集
/repair-story            # 单集短视频项目自动定位 ep01
```

```bash
# 提交视频生成任务（异步，提交后自动启动定时监控）
/generate-video ep01                    # 整集所有镜头
/generate-video ep01 镜头3 镜头5        # 指定镜头

# 查询视频生成结果（交互模式，可处理失败任务）
/check-video ep01
/check-video ep01 --auto                # 自动模式，只重试可重试的失败
/check-video all --auto                 # 检查所有集

# 启动/管理视频生成定时监控
/auto-video ep01                        # 监控 ep01，默认每 20 分钟检查
/auto-video ep01 300                    # 自定义间隔（秒）
/auto-video all                         # 监控所有集
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
│       │   ├── novel.md        # 本集小说原文（系列视频）
│       │   ├── script.md       # 本集可拍摄剧本（series / short 均生成）
│       │   ├── storyboard.md   # 本集分镜提示词
│       │   ├── videos/
│       │   │   ├── tasks.json    # 视频生成任务跟踪
│       │   │   ├── shot01.mp4
│       │   │   └── ...
│       └── ep02/
│           └── ...
├── assets/
│   ├── characters/             # 人物提示词（含性格特征、声音特征、造型变体）
│   ├── items/                  # 重要物品提示词
│   ├── locations/              # 场景提示词
│   ├── buildings/              # 建筑提示词
│   ├── storyboard-sheets/      # 每 shot 的多 panel sheet 卡
│   └── images/                 # 生成的参考图片（按类型分子目录）
│       ├── characters/
│       ├── items/
│       ├── locations/
│       ├── buildings/
│       └── storyboard-sheets/  # 每 shot 的 16:9 sheet PNG
└── config.md                   # 项目配置
```

## 配置项

首次运行时会交互式引导配置，模型和风格支持自定义输入。

| 配置 | 默认值 | 说明 |
|------|--------|------|
| 视频模型 | none | none / dreamina |
| 图像模型 | none | none / dreamina |
| 视频风格 | 3D写实 | 2D动漫 / 3D动漫 / 3D写实 / 2D手绘 / 自定义 |
| 语言 | auto | auto / zh / en / 自定义 |
| 每集分镜数 | 15 | 建议 10-20 |
| 每集时长目标 | 1-2分钟 | — |
| 单镜头时长范围 | 10-15秒 | 每个分镜镜头的时长范围 |
| 上下文集数 | 1 | 续写时 Director 读取前 N 集 novel.md |
| 默认模式 | default | default（用户确认剧情方向）/ full-auto（全自动） |
| 每集小说字数 | 4000-5000 | 范围格式；单个数字视为上限，下限自动取 80% |
| 即梦模型版本 | 4.0 | 3.0-5.0（仅图像模型为 dreamina 时） |
| 图片比例 | 1:1 | 1:1 / 3:4 / 16:9 等（仅图像模型为 dreamina 时） |
| 图片分辨率 | 2k | 2k / 4k（仅图像模型为 dreamina 时） |
| 即梦视频模型版本 | seedance2.0fast | seedance2.0 / seedance2.0fast / seedance2.0_vip / seedance2.0fast_vip（仅视频模型为 dreamina 时） |
| 视频比例 | 16:9 | 16:9 / 9:16 / 1:1 等（仅视频模型为 dreamina 时） |
| 视频分辨率 | 720p | 当前仅支持 720p（仅视频模型为 dreamina 时） |

## 工作模式

- **Default mode**：用户在剧情方向选择和输入确认阶段参与决策，其余步骤自动执行。Director 审核小说原文和分镜（最多 2 轮修改反馈）
- **Full-auto mode**：全自动执行，所有决策由 Director 自主做出（自动选择最能吸引观众的剧情方向），无需任何用户交互。Director 审核小说原文和分镜（最多 2 轮修改反馈）

## 工作流程

### 统一管线（series & short 共用骨架）

```
plot-options → input-confirm → [arc (series only)] → outline
  → [novel (series only)] → script → 基础资产创建/生图
  → storyboard → 每 shot storyboard sheet 卡/图片 → 视频生成
```

差异点：
- **series-video**：包含 `arc`（多集时）与 `novel`（小说原文）两层；novel 由 Director 审核后再产出 script
- **short-video**：跳过 `arc` 与 `novel`，从 outline 直接生成 script（单集独立完整故事）
- **storyboard sheets**：每个 shot 固定一张多 panel 分镜板；图像模型为 `none` 时仍生成并审核卡片，跳过 PNG

### New Story（新故事，series）

1. 创建目录结构 + 交互式配置引导
2. 用户提供输入或让 Director 生成主题选项（default mode 下用户选择；full-auto mode 下 Director 自动选择）
3. Director 生成结构化确认说明供用户确认（default mode 下用户确认；full-auto mode 下自动确认）
4. （可选）若指定总集数且 arc.md 不存在 → Director 生成剧情弧线
5. Director 生成本集剧情大纲（参考 arc 如有）
6. Writer 生成小说原文 → Director 审核（最多 2 轮）
7. Scriptwriter 基于 outline + novel 生成剧本 → Director 审核（最多 2 轮）
8. Creator 创建基础资产并生成参考图，Director 完成 prompt/visual 审核
9. Storyboarder 生成分镜 → Director 审核（最多 2 轮）
10. Creator 为每 shot 规划 sheet，经过 prompt review 后串行生图并 visual review
11. （触发 `/generate-video` 时）提交视频任务并跟踪

### Continue Story（续写，series）

1. 检测最新集数，创建新集目录
2. 用户提供输入或让 Director 生成剧情走向选项
3. Director 生成结构化确认说明
4. （可选）arc 不存在且指定总集数 → 生成剧情弧线
5. Director 生成新集大纲（append-only 追加到总大纲）
6. Writer 生成小说原文 → Director 审核（最多 2 轮）
7. Scriptwriter 生成剧本 → Director 审核（最多 2 轮）
8. Creator 创建新资产、更新记录并生成基础图
9. Storyboarder 生成分镜并审核；Creator 再生成和审核每 shot storyboard sheet

### Short Story（单集短视频）

1. 创建目录结构 + 交互式配置引导
2. plot-options → input-confirm → outline（无 arc）
3. **跳过 novel** → Scriptwriter 基于 outline 直接生成剧本 → Director 审核
4. Creator 生成并审核基础资产图
5. Storyboarder 生成分镜并审核；Creator 生成并审核每 shot storyboard sheet
6. 视频生成同上

### 重大变更（vs 旧版本，clean break）

- **管线统一**：旧的 `new-story` / `continue-story` / `short-*` / `series-*` 分流 workflow 合并为单一 `generate-episode-pipeline`，由 `series-video` / `short-video` 入口透传 mode 参数（`series` / `short`）
- **命令简化**：9 → 7 个 user-invocable command；`series-edit-story` + `short-edit-story` → `edit-story`；`series-repair-story` + `short-repair-story` → `repair-story`
- **Skill 发现**：运行时从 `skills/*/SKILL.md` 动态发现，不维护手工总数
- **Storyboard sheets clean break**：每 shot 一张多 panel sheet，视频输入固定 sheet 第一、基础资产随后；旧项目由 detector 明确拒绝
- **mode-specific 内容外置**：管线 SKILL.md 主体保持通用，差异化指令拆到 sibling 文件（`series.md` / `short.md`），Phase 1 强制 Read 当前 mode 文件
- **不向后兼容**：旧 `episodes/` 目录若用新 skill 触发会报错——旧项目请固定到上一个 release tag 使用，或迁移到新结构

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
- 编辑场景下 `story/outline.md` 允许修改已有内容（正常生成流程中仍为 append-only）

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

## 源 skill 引用约定

源 `skills/` / `agents/` / `scripts/` 中**一律**用 `${CLAUDE_PLUGIN_ROOT}/...` 表达插件内绝对路径（bash 命令、文档引用、配置示例皆然），不要写相对路径，也不要使用任何自定义 env var。三种 runtime 各自的兼容方式：

- **Claude Code**：原生支持。CC 在 prompt 注入时把 `${CLAUDE_PLUGIN_ROOT}` inline 替换为插件根目录绝对路径；同时也作为 env var 暴露给 bash subprocess。
- **OpenCode**：plugin-side 模拟。`.opencode/` 兼容层在 transform-time 做 inline 替换（与 CC 行为对齐），同时通过 `shell.env` hook 注入同名 env var 给 bash 兜底。详见 `.opencode/README.md` 的「Inline 替换 `${CLAUDE_PLUGIN_ROOT}`」段。
- **Codex**：使用原生 `CLAUDE_PLUGIN_ROOT` env var。详见 `.codex/tool-mapping.md`。

零 adapter、零自定义 env var、零运行时 path-rewrite——单一约定贯穿三个 runtime。

## 插件结构

```
ShortVideoDirector/
├── .claude-plugin/
│   └── plugin.json
├── .codex-plugin/
│   └── plugin.json
├── .codex/
│   ├── INSTALL.md
│   ├── CODEX_COMPAT_IMPLEMENTATION_PLAN.md
│   ├── build-codex-skills.py
│   ├── skills/                  # Codex 适配层 skills
│   └── tool-mapping.md
├── agents/
│   ├── director.md              # Director（总导演）
│   ├── writer.md                # Writer（小说作家）
│   ├── scriptwriter.md          # Scriptwriter（短视频编剧）
│   ├── storyboarder.md          # Storyboarder（分镜师）
│   └── creator.md               # Creator（创意总监）
├── skills/                          # 源 skills，运行时动态发现
│   ├── series-video/                # 系列视频入口（user-invocable，含 series.md）
│   ├── short-video/                 # 单集短视频入口（user-invocable，含 short.md）
│   ├── generate-episode-pipeline/   # 统一管线（series/short 共用骨架）
│   ├── edit-story/                  # 编辑已有内容（user-invocable，自然语言）
│   ├── repair-story/                # 修复中断的生成（user-invocable）
│   ├── generate-video/              # 提交视频任务（user-invocable）
│   ├── check-video/                 # 查询视频结果（user-invocable）
│   ├── auto-video/                  # 视频生成定时监控（user-invocable）
│   ├── director-plot-options/       # Director 生成剧情选项
│   ├── director-input-confirm/      # Director 确认用户输入
│   ├── director-arc/                # Director 生成弧线
│   ├── director-review-arc/         # Director 审核弧线
│   ├── director-outline/            # Director 生成大纲
│   ├── director-review-outline/     # Director 审核大纲
│   ├── director-fix-outline/        # Director 修正大纲
│   ├── director-review-novel/       # Director 审核小说
│   ├── director-review-script/      # Director 审核剧本
│   ├── director-review-storyboard/  # Director 审核分镜
│   ├── director-review-assets-visual/         # Director 视觉审核汇总层
│   ├── director-review-asset-visual-single/   # Director 单资产视觉审核
│   ├── writer-novel/                # Writer 生成小说
│   ├── writer-fix-novel/            # Writer 修正小说
│   ├── scriptwriter-script/         # Scriptwriter 生成剧本
│   ├── scriptwriter-fix-script/     # Scriptwriter 修正剧本
│   ├── storyboarder-storyboard/     # Storyboarder 生成分镜
│   ├── storyboarder-fix-storyboard/ # Storyboarder 修正分镜
│   ├── creator-create-assets/       # Creator 创建资产
│   ├── creator-update-records/      # Creator 更新出场记录
│   ├── creator-fix-asset/           # Creator 修正资产
│   ├── creator-fix-asset-image/     # Creator 修订资产 prompt 并重抽图
│   ├── creator-storyboard-sheet-prompts/ # Creator 生成每 shot 的 sheet 卡
│   ├── creator-fix-storyboard-sheet-prompt/ # Creator 修订 sheet prompt
│   ├── creator-fix-storyboard-sheet-image/  # Creator 重生整张 sheet
│   ├── director-review-storyboard-sheet-prompts/ # Sheet prompt 审核
│   ├── director-review-storyboard-sheets-visual/ # Sheet 视觉审核汇总
│   ├── director-review-storyboard-sheet-visual-single/ # 单 sheet 视觉审核
│   ├── director-review-storyboard-sheet-impact/ # 下游连续性影响审核
│   ├── creator-generate-images/     # Creator 批量生成图片（路由层）
│   ├── creator-image-dreamina/      # Creator 即梦图片生成（模型编排层）
│   └── creator-video-dreamina/      # Creator 即梦视频生成（模型编排层）
├── scripts/
│   ├── run-batch.ps1            # 批量生成脚本
│   ├── image-gen-dreamina.sh    # 即梦单张图片生成脚本（支持参考图）
│   ├── video-gen-dreamina.sh    # 即梦单镜头视频提交脚本（异步）
│   ├── video-check-dreamina.sh  # 视频生成状态查询与下载
│   ├── read-config.sh           # config.md 键值提取
│   ├── check-episode.sh         # 集文件完整性入口
│   ├── check-storyboard-sheets.mjs # shot/card/PNG 完整性
│   ├── storyboard-sheet-to-prompt.sh # sheet 生图输入转换
│   ├── generate-storyboard-sheets-dreamina.sh # 串行 sheet 生图
│   ├── storyboard-to-prompt.sh  # sheet-first 视频输入转换
│   ├── asset-to-image-path.sh   # 资产路径转图片路径
│   ├── latest-episode.sh        # 最新集数检测
│   ├── word-count.sh            # 字数统计脚本
│   └── speech-rate.sh           # 台词语速检查脚本
└── README.md
```
