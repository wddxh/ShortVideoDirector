# ShortVideoDirector

把一个想法、小说片段或已有剧本，发展成可用于 AI 视频生成的完整制作材料。

ShortVideoDirector 是面向 **Claude Code、OpenCode 和 Codex** 的多代理短视频创作工作流。它协同完成故事、剧本、分镜、角色与场景资产、可编辑本地参考、生成任务装组和最终提示词，并通过独立审核检查材料质量。支持单集短视频，也支持逐集推进、复用资产的系列创作。

**制作入口交付审核就绪的材料，停在付费视频提交前。** 交付后，直接告诉 AI 要提交、查询或下载哪个 task，AI 会读取本地任务记录处理；也可以使用交付的提示词与参考素材，在 provider 界面手动提交。两种用法见[视频生成与取回](#视频生成与取回)。

## 安装

选择你使用的宿主：

### Claude Code

从本地仓库加载插件：

```bash
git clone https://github.com/wddxh/ShortVideoDirector.git
claude --plugin-dir /absolute/path/to/ShortVideoDirector
```

将绝对路径替换为实际克隆位置，在你的故事项目目录启动 Claude Code。插件入口见 [Claude Code manifest](.claude-plugin/plugin.json)。

### OpenCode

在 `~/.config/opencode/opencode.json` 的 `plugin` 数组中加入：

```json
"short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"
```

本地加载、重启与发现检查见 [OpenCode 安装说明](.opencode/README.md)。

### Codex

通过 Codex 的插件加载入口加载本仓库的 [.codex-plugin/plugin.json](.codex-plugin/plugin.json)，技能目录为 `.codex/skills/`。宿主适配与使用说明见 [Codex 安装说明](.codex/INSTALL.md)。

基础运行需要 Bash、Node.js、Python 3，以及宿主的子任务与文件工具。图像预览需要 Pillow；本地视频制作按选用路线使用 FFmpeg/ffprobe、字体、SVG 库或 Blender。生成执行需要可用的 Dreamina CLI。具体依赖和检查方法见 [本地制作工具指南](skills/creator-local-reference/tools.md)。

## 快速开始

在故事项目目录打开已加载插件的宿主，直接描述目标：

```text
帮我做一个 60–66 秒的短视频：夜班便利店店员收到一封来自明天的信。
温暖、略带悬念，先给我三个完整故事候选。
```

也可以带上已有材料：

```text
/short-video 根据 drafts/story.md 制作一集，保留原结局，时长 90–100 秒。
```

Director 会复用你已经给出的要求，补齐必要的时长、风格和技术选择。你可以指定参数，也可以明确委托 Creator 在本次范围内选择。需要你决定时，会展示完整选项并逐题询问；明确授权范围内的制作、修复和重审会连续推进。想先看大纲再制作，也可以在请求中说明。

只想查看配置：

```text
/short-video config
/series-video config
```

查看配置是只读操作，缺失时会如实报告。制作初始化时才根据实际选择建立项目配置，默认路径为 `config.md`，也可通过 `SVD_CONFIG` 指定项目内路径。字段说明见 [单集配置模板](skills/short-video/config-template.md) 与 [系列配置模板](skills/series-video/config-template.md)。

### 四个公开入口

以下示例使用入口短名；也可直接用自然语言表达相同意图。

| 入口 | 用途 | 示例 |
| --- | --- | --- |
| `short-video` | 开始单集，采用想法或已有材料 | `/short-video 一个关于错过末班车的故事，60–66 秒` |
| `series-video` | 开始系列或继续下一集，每次制作一集 | `/series-video 做一个三集系列，每集 90–100 秒，主题是失物招领` |
| `edit-story` | 修改故事、剧本、分镜或视觉资产 | `/edit-story ep01 镜头3的动作不清楚，请修正` |
| `repair-story` | 检查中断现状并补齐制作材料与审核 | `/repair-story 恢复 ep01 的制作` |

单集模式使用 `ep01`；系列续作沿用已有设置和资产。请求可混合文件路径、集数、镜头范围和修改意见，目标含糊时先澄清。

交付后的提交与查询直接用自然语言表达目标，AI 按实际请求与授权加载内部能力，无需输入额外的斜杠命令。

## Director 与四位专家

| 角色 | 负责什么 |
| --- | --- |
| **Director（主 AI）** | 与你沟通，统筹故事方向、范围、授权、创作协调与整体交付 |
| **Scriptwriter（编剧）** | 原创、改编或接纳已有剧本，落实对白、可拍动作与制作资产清单 |
| **Storyboarder（摄影／分镜师）** | 设计机位、取景、调度、镜头时长、切点与完整视听描述 |
| **Creator（视觉创意总监）** | 统一美术与资产身份，选择本地参考方法，装组并编写最终 prompt，执行获准的生成 |
| **Reviewer（独立审核者）** | 在全新受托上下文检查当前材料，记录证据、问题与验收结果 |

Director 直接担任主会话的制作负责人。四位专家通过独立子任务协作；审核任务与制作上下文隔离。

## 从故事到生成输入

1. **确定意图与范围**：采用已有故事，或发展完整候选；按需要使用单集大纲、系列人物弧与阶段规划。
2. **形成可拍材料**：编剧完成剧本和资产清单，分镜师将叙事落实为镜头与声音设计。
3. **建立视觉依据**：Creator 复用或生成角色、道具、场景等资产图，制作可编辑的本地构图、运动与时序参考。
4. **装组并写最终 prompt**：将连续镜头组成生成任务，交付完整参考媒体，并结合源材料、实际引用和 provider 语法编写任务级提示词。
5. **独立审核与修订**：检查剧本、分镜、资产及最终输入的忠实度与集成，解决问题后交付就绪材料。

这些是成果之间的依赖关系；Director 按当前材料安排工作，就绪且无依赖冲突的任务可并行，修订由对应专家更新受影响内容。

### 镜头、任务与源时钟

摄影镜头按叙事设计，生成任务则可以包含多个连续镜头，甚至跨场景。Creator 按实际模型时长能力装组，保留源镜头时长、对白原词、动作先后和切点；任务时间从成员镜头推导，局部片段的零点统一映射到完整任务时钟。

最终 `task-inputs/taskNN.json` 保存 `shots`、`references` 和 Creator 编写的 `prompt`。提示词覆盖完整任务时间线、声音与引用身份，并说明粗参考控制什么。转换和提交工具原样传递已审核的 prompt。详细格式见 [生成任务输入契约](skills/_meta/rules/shot-inputs.md)。

### 轻量混合参考

Creator 根据镜头需要与已验证的工具能力自行选材：复用 PNG、分层图像和视频，使用可编辑 SVG、有限 2D 动画或有界的 3D 投影；复杂旋转、深度遮挡、跟拍或接触关系需要时，再采用最小充分的 Blender 场景。静态空间设计与时间合成可以分别选用合适工具。

资产图提供人物与物件身份；粗块状参考（BOX）表达相机、取景、布局、切点和整体轨迹，详细动作与自然表演由源描述和最终 prompt 表达。参考里的实际持有、接触、揭示顺序与关键时序仍需符合故事。

每个任务交付两份覆盖**整组完整时间线**的本地视频：

- **clean MP4**：作为生成参考，无内部调试标注；可保留故事正式使用的 UI、片中文字或转场图像。
- **caption review MP4**：从对应 clean 视频派生，带对白／旁白、时间码和内部切点标记，方便人工核对节奏，保持相同源时长与切点，仅用于内部审阅。

可编辑工程与真实依赖保存在 `references/`，供后续修订；上传使用选定 PNG／clean MP4。详见 [选材与工具指南](skills/creator-local-reference/tools.md) 和 [SVG 素材、混合组装与完整字幕审阅示例](examples/svg-animatic/README.md)。

### 一次初始化，共享环境依据

获准制作初始化时，Director 协调 Creator 检查当前支持的本地路线：Python/Pillow、SVG、Blender 各引擎、FFmpeg/ffprobe、字幕与假音频预演工具。每条路线以真实小样输出或不可用证据记录 `pass`／`unavailable`，连同命令、版本、路径、backend 和限制，写入固定文件：

```text
story/work/shared/environment/environment.md
```

后续 Creator 自行读取并跨任务、跨集复用；需要预览工具的 Reviewer 也可查询。只有实际故障、已知环境变化或新增需求尚无能力证据时，才定向补验更新。某路线不可用只影响依赖它的工作；工具可用也由 Creator 判断是否适合当前镜头。

### 独立审核检查什么

审核覆盖剧本、分镜、资产提示与图像，以及最终任务输入。输入审核同时核对完整 prompt、实际 clean 媒体、任务时钟、内部切点和必要跨任务接点；视觉查看由全新审核任务提供事实，独立负责人判断整体集成。

结构检查确认路径、覆盖和记录；独立 Reviewer 判断叙事与视觉质量；你指定的制作前确认保留你的决定权。材料就绪表示输入已验收，生成视频的实际效果仍由你观看判断。

## 视频生成与取回

当前图像与视频生成执行接入 **Dreamina**。Creator 读取实际安装 CLI 的版本和相关操作帮助，核实已接入的模型、比例、分辨率、时长与引用组合，再按你的固定设置或明确委托选型。系列视频沿用一致的 provider、model、ratio、resolution；单集各任务共用视频比例与分辨率。能力说明见 [Dreamina 指南](skills/creator-provider-dreamina/capabilities.md)。

`short-video`／`series-video` 制作请求包含所需资产图生成和本地参考。材料就绪后，由你决定何时提交付费视频，可选择以下两种用法。

### 用自然语言请 AI 操作

先单独请求提交，再按需查询与下载，例如：

```text
帮我提交 ep01 的 task03。
帮我下载 ep01 的 task03。
查一下 ep01 的 task03 到哪了。
```

AI 会读取本地任务输入、设置与状态记录，使用已登记的 provider 和任务 ID 操作，无需你重复提供。只有记录缺失或范围不明时，才补问必要信息。当前集已明确时，也可直接说“帮我下载 task03。”

也可明确要求“只准备任务，不提交”。局部生成按完整任务组选择；如果指定镜头只覆盖组内一部分，会说明完整成员与额外镜头，由你确定范围。

AI 辅助操作由内部流程维护授权、输入一致性与任务状态，提交及重试均按实际授权执行。

### 在 provider 界面手动提交

在所选 provider 自身界面中，使用已交付的最终提示词（final prompt）、对应的实际资产 PNG 和 clean 参考 MP4，按已选模型、比例、分辨率与任务时长提交生成。字幕审阅版（caption review MP4）仅供核对，不上传。

手动生成后，也可请 AI 协助查询与下载。已在本地登记的任务可直接用 `ep01` 和 `task03` 指定；只有在外部生成且未登记到本地的任务，才需要你提供 provider 任务 ID 及对应 provider。

工作流交付各任务的视频，成片观看、剪辑与合成由你安排。

你可以明确请求启动或停止持续监控；监控不默认开启，能否持续运行取决于宿主能力。

## 制作文件在哪里

以下路径相对**故事项目根目录**，按实际需要创建：

```text
config.md                            项目配置与实际选择
story/
  planning/plot-options.md            当前故事候选
  arc.md                             可选系列规划
  episodes/epNN/
    script.md                        剧本与资产清单
    storyboard.md                    分镜与完整视听描述
    task-inputs/taskNN.json           最终任务参考与 prompt
    videos/tasks.json                视频执行记录
    videos/taskNN.mp4                下载的视频
  decisions/                         需要留存的决定依据
  work/shared/environment/environment.md
                                     共享本地环境报告
  work/epNN/                         临时交接与制作工作文件
assets/
  <category>/<name>.md                共享资产卡
  images/<category>/<name>.png        资产身份图
references/                          可编辑源、依赖、clean／字幕审阅媒体
reviews/epNN/                        独立审核记录
```

资产分类包含 characters、items、locations、buildings。已有小说与剧本输入保留在提供的位置；采用范围与当前制作文件明确关联。更完整的导航见 [项目布局](skills/_meta/rules/project-layout.md)。

## 开发与进一步阅读

- [agents/](agents/)：四位专家的角色定义。
- [skills/](skills/)：人工维护的工作流与专业知识源；OpenCode 转换到 cache，Codex 使用生成的 wrappers。
- [scripts/](scripts/)：材料解析、结构检查、审核证据、生成执行及本地预演工具。
- [本地制作工具指南](skills/creator-local-reference/tools.md)：选材、环境验证、Blender／2D、音频预演与字幕审阅。
- [可运行示例](examples/svg-animatic/README.md)：合成的六秒 SVG 素材与字幕审阅流程，另含 FFmpeg 混合组装模板。SVG 渲染器输出素材片段，混合时间线由合成工具组装。

在仓库根目录运行工程检查：

```bash
npm test
python3 .codex/build-codex-skills.py --check
git diff --check
```

修改源技能集合、元数据或运行时映射后，先运行 `python3 .codex/build-codex-skills.py` 更新 Codex wrappers，再检查同步。媒体工具测试需要相应本地依赖；机械测试验证代码契约，宿主加载、任务隔离与监控行为在对应宿主中验证。

## 许可

[MIT License](LICENCE)
