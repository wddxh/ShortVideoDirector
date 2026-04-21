# ShortVideoDirector

一个面向 AI 视频创作的 plugin，通过 5 个 AI 子代理协作，将故事创意转化为 AI 视频分镜提示词、资产参考图片和视频片段。

本仓库采用**单仓双 runtime**设计：以 [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) 为首发平台，并兼容 [opencode](https://opencode.ai/)。两端用户入口、命令与行为保持一致；底层只在加载机制上有差异。详见 [CLAUDE.md](CLAUDE.md)。

## 快速开始（双端）

仓库内同时维护了 Claude Code 与 opencode 两份等价产物（分别位于 `.claude/` 与 `.opencode/`），两端的 `/series-video`、`/short-video` 等用户命令完全一致。请按你使用的 runtime 选择安装方式。

### Claude Code

通过 `--plugin-dir` 加载（每次启动时指定路径）：

```bash
# 在你的项目工作目录中启动 Claude Code，并加载本仓库为 plugin
claude --plugin-dir /path/to/ShortVideoDirector
```

启动后即可在斜杠菜单中调用：

```bash
/series-video 一个穿越到异世界的少年，发现自己拥有操控时间的能力...
```

Claude Code 会在会话启动时自动加载仓库根的 [CLAUDE.md](CLAUDE.md)，无需额外操作。

### opencode

opencode 在当前工作目录下会自动读取 `.opencode/opencode.json` 与 `.opencode/{commands,skills,agents}/`。最简方式是把仓库目录作为工作目录（或将 `.opencode/` 拷贝/软链到你的项目根）：

```bash
# 方式一：在 ShortVideoDirector 仓库根目录下直接启动 opencode
cd /path/to/ShortVideoDirector
opencode

# 方式二：在你自己的项目目录下创建到 .opencode 的软链，再启动 opencode
cd /path/to/your-project
ln -s /path/to/ShortVideoDirector/.opencode .opencode
opencode
```

启动后调用方式与 Claude Code 一致：

```bash
/series-video 一个穿越到异世界的少年，发现自己拥有操控时间的能力...
```

> opencode 不会自动加载仓库根的 [CLAUDE.md](CLAUDE.md)。如需把项目背景注入首轮 prompt，可在会话开始时手动执行 `cat CLAUDE.md`，或在 system prompt 中粘贴关键章节。详见 [CLAUDE.md — opencode 章节](CLAUDE.md#opencode)。

### 双端能力对照

| 用户命令 | Claude Code | opencode |
| --- | --- | --- |
| `/series-video` | 可用 | 可用 |
| `/short-video` | 可用 | 可用 |
| `/series-edit-story` | 可用 | 可用 |
| `/short-edit-story` | 可用 | 可用 |
| `/series-repair-story` | 可用 | 可用 |
| `/short-repair-story` | 可用 | 可用 |
| `/generate-video` | 可用 | 可用 |
| `/check-video` | 可用 | 可用 |
| `/auto-video` | 原生支持（in-session sleep-loop） | 原生支持（in-session sleep-loop） |

> `/auto-video` 通过 LLM 会话内的 sleep-loop 实现，不再依赖宿主级调度（Cron / launchd / Task Scheduler）。轮询在当前会话内进行，关闭会话即终止；内置安全上限（最多 24 轮 / 8 小时）。如需脱离会话长时间后台运行，可改用 OS 级 cron 周期性触发 `/check-video --auto`，参见 [OS 调度（可选 advanced）](#os-调度可选-advanced)。

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
| **Storyboarder** | 分镜师 | 负责资产清单和分镜提示词生成 |
| **Creator** | 创意总监 | 识别并视觉化人物和资产，生成图像提示词和声音特征描述 |

## 使用

下列所有命令在 Claude Code 与 opencode 端调用方式与行为一致。

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
# 编辑系列视频已有内容
/series-edit-story ep01大纲的集尾钩子改成更有悬念的
/series-edit-story ep02分镜镜头3的台词太少，增加内心独白
/series-edit-story ep03主角的外貌描述改成短发
/series-edit-story 在ep01的资产清单中增加一个新角色"老王"
/series-edit-story 重新生成张三的参考图片
/series-edit-story 张三的头发改成红色，重新生成图片
```

```bash
# 编辑单集短视频已有内容
/short-edit-story 大纲的结局改成开放式结局
/short-edit-story 剧本场景2的台词太少，增加内心独白
/short-edit-story 主角的外貌描述改成短发
/short-edit-story 重新生成张三和李四的参考图片
```

```bash
# 修复系列视频中断的生成
/series-repair-story ep03
/series-repair-story          # 自动检测最新一集
```

```bash
# 修复单集短视频中断的生成
/short-repair-story
```

```bash
# 提交视频生成任务（异步，提交后自动启动定时监控）
/generate-video ep01                    # 整集所有镜头
/generate-video ep01 镜头3 镜头5        # 指定镜头

# 查询视频生成结果（交互模式，可处理失败任务）
/check-video ep01
/check-video ep01 --auto                # 自动模式，只重试可重试的失败
/check-video all --auto                 # 检查所有集

# 启动/管理视频生成在会话内自动监控（两端均原生支持）
/auto-video ep01                        # 监控 ep01，默认每 20 分钟检查
/auto-video ep01 300                    # 自定义间隔（秒）
/auto-video all                         # 监控所有集
```

> `/auto-video` 在两端都通过当前 LLM 会话内的 sleep-loop 实现自动轮询：每隔指定间隔起一个 sub-agent 调 `/check-video --auto`，全部完成或不可恢复错误时自动停止；内置安全上限 24 轮 / 8 小时。**关闭会话即终止**。如需脱离会话长时间运行，参考 [OS 调度（可选 advanced）](#os-调度可选-advanced)。

### OS 调度（可选 advanced）

`/auto-video` 已通过 in-session sleep-loop 在两端原生可用；**绝大多数场景下不需要 OS 级调度**。仅在以下情形可考虑用 OS 级 cron 直接周期性触发 `/check-video <ep> --auto`：

- 需要长时间（>8 小时）后台轮询，且不希望保持 LLM 会话窗口开启
- 无人值守批量处理多个项目目录
- CI / 服务器环境，无法保留 interactive 会话

完整 cron / launchd / Task Scheduler 示例见 [CLAUDE.md — 可选：OS 级周期触发](CLAUDE.md#可选os-级周期触发)。注意 OS 调度无法替代 `/auto-video` 的"全部完成自动停止"语义，需自己根据 `/check-video --auto` 输出的 JSON 摘要（`all_complete=true`）判断停止条件并手动 disable。

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
│       │   ├── script.md       # 本集剧本（单集短视频）
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
│   └── images/                 # 生成的参考图片（按类型分子目录）
│       ├── characters/
│       ├── items/
│       ├── locations/
│       └── buildings/
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
| 单镜头资产上限 | 5 | 每个分镜镜头中引用资产的最大数量 |
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

### New Story（新故事）

1. 创建目录结构 + 交互式配置引导
2. 用户提供输入或让 Director 生成主题选项（default mode 下用户选择；full-auto mode 下 Director 自动选择）
3. Director 生成结构化确认说明供用户确认（default mode 下用户确认；full-auto mode 下自动确认）
4. （可选）若指定总集数且 arc.md 不存在 → Director 生成剧情弧线
5. Director 生成本集剧情大纲（参考 arc 如有）
6. Writer 生成小说原文
7. Director 审核小说原文，若需修改则 Writer 定向修正（最多 2 轮）
8. Storyboarder 生成资产清单（写入 ep outline.md）
9. Creator 创建新资产
10. **并行执行**：Creator 生成资产参考图片（若配置了图像模型）+ Storyboarder 生成分镜
11. Director 审核分镜，若需修改则 Storyboarder 定向修正（最多 2 轮）

### Continue Story（续写）

1. 检测最新集数，创建新集目录
2. 用户提供输入或让 Director 生成剧情走向选项（default mode 下用户选择；full-auto mode 下 Director 自动选择）
3. Director 生成结构化确认说明供用户确认（default mode 下用户确认；full-auto mode 下自动确认）
4. （可选）若指定总集数且 arc.md 不存在 → Director 生成剧情弧线
5. Director 生成新集大纲（append-only 追加到总大纲，参考 arc 如有）
6. Writer 生成小说原文（参考最近 M 集小说和角色资产）
7. Director 审核小说原文，若需修改则 Writer 定向修正（最多 2 轮）
8. Storyboarder 生成资产清单（写入 ep outline.md，含新增和已有资产）
9. **并行执行**：Creator 创建新资产 + Creator 更新已有资产出场记录
10. **并行执行**：Creator 生成资产参考图片（若配置了图像模型）+ Storyboarder 生成分镜
11. Director 审核分镜，若需修改则 Storyboarder 定向修正（最多 2 轮）

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

## 仓库结构

仓库采用「**源 + 产物**」分离布局。**唯一手工编辑的目录是 `src/` 与 `tools/`**；`.claude/` 与 `.opencode/` 是构建产物，由 `tools/build.py` 自动生成，不应手动修改。

```
ShortVideoDirector/
├── src/                            # ★ canonical 源（唯一手工编辑目录）
│   ├── skills/                     # 28 个业务 skill 源（按 skill 名分目录）
│   ├── agents/                     # 5 个角色 agent 源
│   └── workflows/                  # 11 个 workflow 源（含用户入口与 internal）
├── tools/                          # ★ 构建与校验工具
│   ├── build.py                    # 从 src/ 编译生成 .claude/ 与 .opencode/
│   ├── check-structure.py          # 结构与一致性校验
│   ├── runtime-config.yml          # owner 映射、双端变换规则、invoke 模板
│   └── tests/                      # pytest 测试
├── .claude/                        # Claude Code 产物（构建生成，勿手改）
│   ├── skills/
│   └── agents/
├── .claude-plugin/
│   └── plugin.json                 # Claude Code plugin 描述（构建生成）
├── .opencode/                      # opencode 产物（构建生成，勿手改）
│   ├── skills/
│   ├── commands/                   # opencode 端用户入口 workflow
│   ├── agents/
│   └── opencode.json               # opencode 配置
├── scripts/                        # 通用脚本（批量生成、即梦 CLI 包装等）
├── docs/
│   └── plans/2026-04-20-16-32/     # 双 runtime 改造的设计与实施文档
├── .github/
│   ├── pull_request_template.md
│   └── workflows/build-check.yml   # CI：跑 build.py 并 diff 产物
├── CLAUDE.md                       # 项目权威指令文档（双 runtime 架构、ADR、贡献流程）
├── README.md                       # 本文件
├── .gitattributes                  # 把构建产物标记为 linguist-generated，减少 PR diff 噪音
└── LICENCE
```

## 贡献者快速指南

1. **fork & clone** 本仓库，新建 feature 分支。
2. **只在 `src/` 与 `tools/runtime-config.yml` 中编辑源文件**。**不要直接改 `.claude/` 或 `.opencode/`**——这两个目录是构建产物，手改会在 CI 中被覆盖并导致 PR 报错。
3. **重新生成产物：**

   ```bash
   uv run tools/build.py
   ```

4. **跑结构与一致性校验：**

   ```bash
   uv run tools/check-structure.py
   ```

5. **跑测试：**

   ```bash
   uv run pytest tools/tests
   ```

6. **提交并发起 PR**：commit 必须同时包含**源**（`src/`、`tools/`）与**产物**（`.claude/`、`.opencode/`、`.claude-plugin/plugin.json`）双端变更。

   - 仓库的 [`.gitattributes`](.gitattributes) 已把产物目录标为 `linguist-generated`，PR diff 视图会默认折叠，减少 review 噪音。
   - 仓库提供 [`.github/pull_request_template.md`](.github/pull_request_template.md) 模板，按项填写即可。
   - CI（`.github/workflows/build-check.yml`）会重新跑 `build.py` 并对比 `.claude/`、`.opencode/` 的 git diff，**不一致直接拒绝**。

更详细的贡献规范、双 runtime 架构与 ADR 列表，请阅读 [CLAUDE.md](CLAUDE.md)。

## 进一步阅读

- [CLAUDE.md](CLAUDE.md) — 项目权威指令文档：双 runtime 架构、用户入口、内部 workflow、跨 runtime 调用约定、auto-video sleep-loop 与可选 OS 级周期触发、贡献规范、常见问题。
- [docs/plans/2026-04-20-16-32/opencode-compat-technical-design.md](docs/plans/2026-04-20-16-32/opencode-compat-technical-design.md) — 双 runtime 改造的完整技术设计与 ADR 列表。
- [docs/plans/2026-04-20-16-32/opencode-compat-implementation-plan.md](docs/plans/2026-04-20-16-32/opencode-compat-implementation-plan.md) — 实施计划与 task 拆分。
- [tools/runtime-config.yml](tools/runtime-config.yml) — owner 映射、双端变换规则、invoke 模板的权威配置。
