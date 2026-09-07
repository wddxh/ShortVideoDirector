# ShortVideoDirector

以 Claude Code 为主要目标、提供 OpenCode 与 Codex 适配的短视频创作插件。主 AI 负责用户沟通和授权，Director 对最终制作材料负责，五个专业角色按实际需要协作，而非执行固定创作顺序。

`skills/` 是唯一人工维护的技能内容层；Claude Code 直接加载，OpenCode 转换到运行时 cache，Codex 加载生成的轻量 wrapper。当前代码契约不等于宿主实测通过，见下文「验证边界」。

## 角色与协作

| 角色 | 所有权与专业判断 |
| --- | --- |
| Director | 诊断委托、评估已有材料、协调专家与独立审核，对材料整体叙事、视觉和情感连贯性负责。 |
| Writer | 小说与散文叙事、人物动机和声音；按需要发展或修订文本，不强制写小说。 |
| Scriptwriter | 可拍摄剧本、改编和 script breakdown（从剧本识别制作所需元素），拥有剧本资产清单。 |
| Storyboarder | shot（镜头）设计、人物与动作的空间调度、表达场景所需的镜头组合及连续性；保留七字段分镜。 |
| Creator | 人物、环境与道具的视觉设计，基础资产卡/图和 storyboard sheet（每镜头一张多画格分镜板）的画格、卡片与图片。 |

所有角色浏览 skill description，选择性加载方法。Skill 是当前上下文中的知识加载，不是角色切换或独立审核。跨所有者建议交 Director 协调，不静默修改他人材料。

主 AI 委托成果、材料路径、范围、约束、决策余地和升级条件，不指定技能调用链。宿主允许嵌套任务时 Director 直接委托；明确深度拒绝后记住限制，由主 AI 忠实转交专家请求，再恢复原 Director 任务传回结果。主 AI 不另排创作流程，也不自动提高宿主深度。缺少必要角色或独立审核上下文时报告阻塞。

## 安装

Claude Code：

```bash
claude --plugin-dir /path/to/ShortVideoDirector
```

OpenCode：在 `~/.config/opencode/opencode.json` 添加：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"
  ]
}
```

重启宿主后核对当前角色和技能，详见 [OpenCode 安装与维护](.opencode/README.md)。Codex 使用 `.codex-plugin/plugin.json` 和 `.codex/skills/`，见 [Codex 安装说明](.codex/INSTALL.md)。

本地工具需要 Bash、Node.js（测试使用 Node 18+）、Python 3；实际即梦生成还需已安装且可用的 `dreamina` CLI。本任务不安装或升级 provider。

Claude 的模型提示以源 frontmatter 为准，常用 Opus/Sonnet；使用对应模型需账号权限。仅有 Sonnet 时可选择：

```bash
CLAUDE_CODE_SUBAGENT_MODEL=sonnet claude --plugin-dir /path/to/ShortVideoDirector
```

Codex 使用当前活动模型，Claude 模型字段仅作提示；OpenCode 的角色 `model: inherit` 由宿主继承。

## 使用

```text
/short-video 一个外卖小哥送错餐发现客户是自己的前女友
/short-video story-idea.txt
/short-video config
/series-video story-idea.txt
/series-video 主角发现了隐藏在古城下的秘密通道
/series-video config
/edit-story ep01 分镜镜头3的动作不清楚，请局部修正
/edit-story 张三的头发改成红色，重新生成图片
/repair-story ep03
/repair-story 恢复最新一集
```

七个入口整体理解自然语言，可混合文件、集/镜头范围和意见；`ep01` 等短写仍可理解，不是位置参数协议。配置查看只读，缺失不自动初始化。目标遗漏、歧义或冲突先澄清，不默认 latest/all；监控仅支持明确 epNN/all，部分镜头需先确认范围。系列每次委托一集；新系列确认总集数，明确续作请求才选择下一集，已有集恢复不另开集。

编辑与恢复由 Director 诊断实际影响，复用有效材料和任务，不因缺少可选规划文件重做故事。缺资产清单时请 Scriptwriter 接纳现有剧本并补齐，不默认重写。可选的 [制作情境参考](skills/director-outline/reference-workflows.md) 保留有用的整合方法、依据与取舍，不恢复固定技能链。

## 材料与确认

完整制作交付需要当前相容的剧本、分镜、本集实际使用的基础资产卡与图片、每 shot 的 sheet 卡与图片，以及有效独立审核。必需不等于重新生成；可以复用合适材料。有效作用域的图像提供方 `none` 只禁用新提交，不阻断已有任务取回，也不豁免必需图片。缺图、授权不足或审核未决应报告部分交付/阻塞；局部委托完成不代表整集就绪。

`outline.md`、`novel.md`、`arc.md` 是按用途选择的规划材料，不是统一前置。系列仍需评估人物弧（人物随事件发生的变化）、铺垫回收及跨集连续性，结合已有规划决定工作。

用户要求先看规划材料时，主 AI 在实际配置的 `## 制作前确认 epNN` 段记录所需 outline/novel/arc 和用户批准及输入身份。只交约定材料，等待实际批准后再正式制作；缺失、空白、未批准或材料已变化均阻塞。质量审核不能代替用户批准。

独立材料审核另开全新 Director 上下文，不继承制作历史，也不只看生产者的有利总结。审核者只写受托 review 记录，可做只读 Bash 检查，不改材料或接管修复。逐图通常分别隔离审核；跨图只看最小必要比较集，另设独立汇总上下文聚合原始结论，制作 Director 不代写汇总 pass。分歧由制作 Director 协调修正、重审或升级用户；没有“两轮后自动通过”。

六类证据覆盖 script、storyboard、基础资产 prompt/visual、sheet prompt/visual。现有 `.review-*.md` 保存 scope、逐目标 `pass|needs_revision|unknown`、阻塞和真实输入 SHA-256；最新声明范围优先，未完成审核不能回退旧 pass。哈希只证明版本，不证明独立性或艺术质量。输入变化需评估影响，不等于自动重生所有材料。

配置相关工作先从故事项目根运行 `node /path/to/ShortVideoDirector/scripts/review-evidence.mjs config-path [PATH]`。未显式传 PATH 时用 SVD_CONFIG，未设才用 config.md；结果为 canonical 项目相对路径。项目内绝对路径/./ 可规范化，外部或 symlink 越界配置不支持，不静默回退。每次相关命令显式传同一 SVD_CONFIG，委托、配置/批准写入和指纹也使用该路径；纯已登记任务取回不经过配置门禁。

使用默认配置时，在故事项目根目录运行：

```bash
bash /path/to/ShortVideoDirector/scripts/check-episode.sh ep01
node /path/to/ShortVideoDirector/scripts/review-evidence.mjs check ep01 1 3
```

整集检查覆盖 script 清单中的新增/复用资产和所有镜头；选镜头提交仍要求 script/storyboard 验收，并检查所选引用。就绪为 exit 0，阻塞为 1；`check-episode.sh` 保留旧 KF 格式阻塞 exit 2。

## 视频执行

```text
/generate-video ep01
/generate-video ep01 镜头3 镜头5
/check-video ep01
/check-video ep01 无人值守检查，返回监控摘要
/check-video 查询所有已登记任务
/auto-video ep01
/auto-video ep01 300
/auto-video all
```

视频仅提交、查询和下载，成片质量由用户判断，不自动审片、剪辑或合成。short/series 制作包含所需图片并停在视频提交前；用户随后调用视频生成入口的实际请求即为对应范围的提交依据，不另问生成授权。`done` 仅表示当前任务下载成功。

`generate-video` 按实际请求范围准备任务，保持 sheet 图片第一、基础参考随后。`tasks.json` 记录 prompt/images/duration 和 `submission` 中的 provider/model/ratio/resolution 及有序图片 path/SHA-256。首次请求原文、解析范围和真实条件写入 `initial_authorization`，不需要另一条同意消息。原输入重试使用已有 `retry_authorization`；不在首次提交前例行询问重试许可。仅用户要求自动重试或实际失败缺少必要决定时处理该问题，未答复不推断无限重试；只有用户明确限制次数才记录 max_attempts/attempts。

提交 wrapper 核对登记输入、身份、授权结构、保护状态和当前范围审核；授权条件的语义仍由调用方判断。调用 provider 前，`reserve` 加锁并原子持久化 `inflight`，有限额的重试在此预扣次数；`settle` 记录明确提交 ID/失败并清除 intent。未知结果保留 inflight，必须人工核实，不能按超时清除或重复付费。首次提交、查询下载和 gate 拒绝不扣重试次数。

限流后未调用的 pending 保留原输入和初始授权，监控可继续首次提交；真正生成失败才走重试授权。重试使用原登记模型/比例和图片身份，不偷偷套用当前配置。输入漂移需授权准备和当前材料验收；submitted/done 不刷新或自动重提。

| 查询输出 / exit | 含义 |
| --- | --- |
| `success` / 0 | 本次 submit_id 已下载，记 done。 |
| `querying` / 1 | 正常等待，保留 submitted/id。 |
| `fail:reason` / 0 | 实际生成失败，记 failed。 |
| `error:reason` / 2 | 查询或取回错误，保留 submitted/id，重试同一任务取回，不付费重生。 |

查询下载不受创作就绪检查阻挡；历史 submitted 仍可取回。任意已有 MP4 不能证明当前任务完成。监控不做创作修复或扩大授权；`all_complete` 表示可停止监控，可能仍有 `human_needed`，不代表全部下载或质量通过。用户反馈需修正时，由 Director 接收授权成果委托。

## 图像与接口

Sheet 卡 `## 基本信息` 保存四项：`已解析图像提供方`、`已解析图像模型版本`、`已解析图片比例`、`已解析图片分辨率`。它们是执行选择，不是用户锁；画布比例与 panel/视频比例分开。修改设置需获准 card 准备和当前 prompt 审核。

以下是脚本接口参考，不是绕过角色、审核或付费授权的调用建议。相对材料路径以故事项目根为准：

```text
image-gen-dreamina.sh [--force] PROMPT OUTPUT RATIO RESOLUTION MODEL REFS SOURCE
generate-images-dreamina.mjs [--force] [--concurrency N] JOBS.json
storyboard-sheet-to-prompt.sh [--json] CARD
generate-storyboard-sheets-dreamina.sh [--force] [--concurrency N] CARD...
video-gen-dreamina.sh PROMPT OUTPUT IMAGES DURATION RATIO MODEL RESOLUTION
video-check-dreamina.sh ID OUTPUT
```

图片和视频 wrapper 均要求七个位置参数，图片空引用仍占第六位；不接收任意额外 CLI flags。当前图片每 job 单输出，不支持自定义宽高/多输出。Sheet JSON 返回 `{images,prompt,settings,sourcePath}`；默认保留 `IMAGES:`、分隔线、prompt。Coordinator 使用每卡设置和共同并发 runner，数字排序仅确定 ready-job 选择，不要求 sheets 全部串行；不接收旧的批次模型/分辨率参数。

Sheet card 不复制源 shot：转换器现读完整源分镜，拼接完整 `Panel 规划` 与仅含格式/阅读顺序/比例/风格/labels 的 `图像生成提示`。对白与声音帮助表情姿态，不自动绘成字幕；refs 合并源 header 与 sheet 补充，人物优先稳定去重、previous 最后。解析不依赖 PNG，执行检查实际图片依赖。旧卡冗余提示不自动改写，缺唯一非空 Panel 或实际源 shot 的卡不兼容；不迁移用户项目。详见 [完整请求与兼容边界](docs/evaluations/full-shot-sheet.md)。

新图执行在 PNG 旁记录同名 `.generation.json`，含 source/output、实际四元组、status、可用 submit_id 和成功 output_sha256。取回按保存的 receipt settle 后才移除 pending，不以当前配置重选。普通跳过、外来或历史图片不补造 receipt；receipt 是执行证据，不是审核通过或必填的导入历史。

普通图片批次使用 runner，不 shell 并行 raw CLI/wrapper。`JOBS.json` 是数组，每项仅 `{source,output,prompt,images,settings:{provider,model,ratio,resolution}}`，来自授权目标和当前已审核提示；refs 为全量有序真实图片。默认本地并发 5，Creator 按当前接入限制/用户约束用 `--concurrency N` 覆盖，不反复询问，不代表账号总配额。只等待实际基础/衍生/previous-sheet 依赖，无关 jobs 不设阶段屏障；当前依赖证据仍须满足。

首次失败/pending 停止新启动、排空 active 并保留所有成功/IDs；命中 target/ref pending 的批次预检即整体阻塞。冲突 output 拒绝，非 force completed skip 在 claim 内复查；force 仅限全批明确替换目标，未启动旧图不删除。pending helper 互斥更新；stale output claims/locks 和未知 receipt 人工核实恢复，无自动过期。调度器不盲重试或代替角色规定质量轮次。

CLI 仅全成功时给 `OK generated N skipped M`；非零不能推断无成功，须结合落盘 PNG/receipts/pending 核对排空后的全批结果。实际成功集合排除 skip，既有 accepted evidence 与 outstanding review scope 不因成功子集而清空；完整协议见 [图像执行说明](skills/creator-provider-dreamina/image.md)。

## 项目文件

```text
your-project/
  config.md
  story/
    outline.md                     # 可选总体规划
    arc.md                         # 可选剧情弧规划
    episodes/ep01/
      outline.md                   # 按需本集大纲
      novel.md                     # 按需小说
      script.md                    # 剧本及本集资产清单
      storyboard.md                # 七字段 shot 及完整视听描述
      .review-*.md                 # 独立材料审核证据
      videos/
        tasks.json                 # 异步任务、授权与提交意图
        shot01.mp4
  assets/
    characters/                    # 人物卡，含声音和造型变体
    items/                         # 物品卡
    locations/                     # 场景卡
    buildings/                     # 建筑卡
    storyboard-sheets/ep01/shot01.md
    images/                        # 与卡对应的分类/名称 PNG
      storyboard-sheets/ep01/shot01.png
```

`script.md` 的 `## 本集资产清单` 含 `### 新增资产` 和 `### 已有资产（本集出场）`，引用四类基础资产路径。资产按实际需要列出，不为填分类凭空创建。人物身份、视觉基线和声音保持一致；换装可用独立造型变体，已建立资产不随意改写。内容语言遵循配置，资产文件名与资产名一致。沿用角色规则中的虚构命名约束，不使用现实明星/公众人物名字、真实地名或商标名。

分镜保留引用资产、镜头类型、镜头运动、视频风格、时长、转场、画面与声音描述七字段。时间线描述把动作、对白、音效组织成连贯视听段落；Storyboarder 设计镜头，Creator 决定 sheet 画格。结局按用户意图和作品需要处理，不一律强制续集悬念。

## 配置

获准初始化时交互配置。Creator 根据当前 CLI 版本和操作 help 解释能力及已接入限制，不维护静态模型表，不付费探测或自动升级。完整模板见 [series](skills/series-video/config-template.md) 与 [short](skills/short-video/config-template.md)。

| 配置 | 默认值 / 说明 |
| --- | --- |
| mode | series / short，显式记录，不根据 arc 是否存在猜测。 |
| 总集数 | 模板 1；新系列询问 N≥2，short 固定 1。 |
| 视频提供方 / 图像提供方 | 模板 none；当前仅接入 dreamina，新提交需用户明确选择或授权选择。 |
| 视频风格 / 语言 | 3D写实 / auto，可选其他风格、zh、en 或自定义。 |
| 每集分镜数 | 15，建议 10-20。 |
| 每集时长目标 / 单镜头时长范围 | 集目标无默认，开始时由用户决定；模板单镜头参考 10-15秒不用于反推集目标。 |
| 上下文集数 | series 模板为 1；按连续性需要选择现有材料，不强制补小说。 |
| 默认模式 | series 模板保留 default / full-auto；不替代实际用户确认或付费授权。 |
| 图像模型版本 / 图片比例 / 图片分辨率 | 无执行默认；固定值或明确委托 Creator 解析的当前支持组合。 |
| 分镜板图像提供方 / 分镜板图像模型版本 / 分镜板图片比例 / 分镜板图片分辨率 | 可选独立覆盖，须明确授权；空值不解除共享固定值。 |
| 视频模型版本 / 视频比例 / 视频分辨率 | 无执行默认；wrapper 转发登记值，不再固定 720p。 |

`## 参数选择授权` 的 JSON 保存真实 `decision` 与 `delegated`：作用域 images/sheets/video，字段 provider/model/ratio/resolution。缺失、空值、auto 均不授予选择权；任务选择不升为项目默认。共享图像设置默认约束 sheets，共享模型需覆盖所需 text2image/image2image 操作。仅有明确作用域授权时 sheet override 可在共享 none 下启用，或单独禁用 sheets。

系列视频从全部 canonical episode tasks 的一致 submission 继承 provider/model/ratio/resolution 四元组，包括本任务已有快照；无快照才首次解析。short 仅要求整集 ratio/resolution 一致。历史缺项、冲突或固定配置不符阻止新准备/付费，不阻止取回。profile 不继承镜头内容、时长或 grants；系列准备串行执行，本集锁不保证跨集原子性。

系列各集共用用户初始集时长目标/范围，不按前集实际时长漂移。单值初次设置说明并确认 ±10%，更严格限制优先；显式范围不再放宽。Director 核对场景目标和完整 shot 合计，Creator 不得改变集预算；这不等于测量编码视频片长。

`scripts/run-batch.ps1` 保留多集批处理工具，例如：

```powershell
.\scripts\run-batch.ps1 -WorkDir "C:\projects\story" -PluginDir "C:\tools\ShortVideoDirector" -TotalEpisodes 30 -NewEpisodes 5 -StoryInput "故事材料"
```

WorkDir/PluginDir/NewEpisodes 必填，TotalEpisodes/StoryInput 可选，`-Push` 会提交并推送故事项目。脚本达到新增或总集数目标时退出，但按目录计数，不代表材料验收。它在缺 arc 时仍把 TotalEpisodes 拼成入口前置数字，与当前入口解析不一致；并使用 `--dangerously-skip-permissions`。因此此处仅保留旧工具参考，不保证当前可无人值守运行；本次不修脚本、不实测，不能以此绕过批准或视频授权。

## 维护与验证

源角色在 `agents/`，方法在 `skills/`，确定性检查和执行在 `scripts/`。插件内路径统一使用 `${CLAUDE_PLUGIN_ROOT}`：Claude 原生解析，OpenCode 转换时替换并通过 shell.env 兜底，Codex 按环境变量解析。项目 story/assets/config 路径仍相对故事工作区。

```bash
npm test
python3 .codex/build-codex-skills.py --check
git diff --check
```

修改源元数据或 Codex 映射后才运行 `python3 .codex/build-codex-skills.py` 更新生成层，不手改 wrapper。当前文档任务只检查，不重建。

## 验证边界

历史 OpenCode 记录包含深度 1 嵌套拒绝、主 AI 转交/原 Director 恢复及局部独立审核；cache `a68637a1939665f7` 另有两项重启后探测。这些是旧版本的限定证据，不验证本次 provider/autonomy 源码或新 cache。需要退出重启并核对实际加载路径，再验证当前委托与审核；工具可见不等于深度可用。

Claude Code、Codex 及当前适配器的完整 live-host 行为尚未验证。自动测试不证明创作质量、审核隔离或真实监控成功。详见本地 [审计索引](docs/evaluations/skill-autonomy-audit.md)、[Provider 记录](docs/evaluations/creator-provider.md) 与 [历史评估](docs/evaluations/role-led-creation.md)；`docs/` 按仓库规则忽略，未强制加入 Git，发行副本可能不包含这些记录。
