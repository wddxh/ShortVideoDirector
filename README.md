# ShortVideoDirector

以 Claude Code 为主要目标，提供 OpenCode/Codex 适配的短视频创作插件。`skills/` 是唯一人工维护的知识源；OpenCode 转换到 cache，Codex 使用生成 wrappers。源码契约不等于 live-host 验证。

## 角色与所有权

| 角色 | 所有权 |
| --- | --- |
| Director | 诊断委托、协调创作与独立审核，对材料整体连贯性负责 |
| Writer | 小说/散文叙事、人物动机与声音 |
| Scriptwriter | 可拍剧本、改编和本集资产清单 |
| Storyboarder | 七字段 shot、摄影、动作意图与时长 |
| Creator | 作品美术、资产身份图、本地参考与 manifest、provider 能力和授权执行 |

主 AI/general 负责用户沟通、授权、仓库工程、宿主配置和测试。Director 不接管工程任务。Skill 只加载知识；实际角色委托使用 Task，提供成果、路径、范围、约束与决策余地，不指定固定技能链。

嵌套可用时直接委托；明确工具/深度拒绝后记住限制，由主 AI 忠实转交专家并恢复同一 Director task。普通失败不代表深度拒绝。不自动提高宿主深度。缺必要角色或独立上下文时阻塞，不同上下文冒充或自审。

## 安装

```bash
claude --plugin-dir /path/to/ShortVideoDirector
```

OpenCode 配置 `~/.config/opencode/opencode.json`：

```json
{"$schema":"https://opencode.ai/config.json","plugin":["short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"]}
```

详见 [OpenCode](.opencode/README.md) 与 [Codex](.codex/INSTALL.md)。源码更新后退出重启宿主，核对实际插件与 cache 路径。需要 Bash、Node.js、Python 3；图像 helper 需要 Pillow，本地 MP4 按方法需要 Blender/FFmpeg；付费生成需要可用 Dreamina CLI。安装/升级仍须实际授权。Claude 模型提示按源 frontmatter；OpenCode inherit，Codex 使用当前活动模型。
## 使用与授权

```text
/short-video 一个外卖员送错餐发现客户是自己的前女友
/series-video story-idea.txt
/short-video config
/edit-story ep01 镜头3的动作不清楚，请局部修正
/repair-story ep03
/generate-video ep01 镜头3 镜头5
/check-video ep01
/auto-video ep01
```

七个入口整体理解自然语言、文件和范围，不是位置参数协议。目标歧义不默认最新/全部。short 固定 ep01；series 每次一集，新系列确认总集数，明确续作才选择下一集。配置查看不初始化、不生成。

short/series 请求包含所需新增资产图和本地参考，intake/当前审核满足后连续执行，始终停在付费视频提交前。后续手动 generate-video 的实际请求和条件登记为 initial_authorization，无额外批准握手。仅准备任务不提交；重试需真实 retry_authorization，仅用户指定次数时设上限。不从监控、review pass 或生成意图推断无限重试。

用户关键选择尽量前置；原角色给齐完整问题计划与条件分支，主 AI 沿题界完整展示当前题后原生单选，相关原始答复和全部条件批量回原角色。已定/继承/明确委托项不重问。范围内修复和独立重审无需逐轮批准；仅缺权限、关键冲突或用户检查点升级。细则见 [决策转交](skills/_meta/rules/user-decision-relay.md)。

outline/novel/arc 按用途采用。用户要求预审时，在 canonical config 的 `制作前确认 epNN` 保存材料范围、真实 approval 与指纹；缺失、未批准或变化则先停正式制作。独立质量验收不替代用户批准。缺 script 资产清单请 Scriptwriter 接纳已有剧本补齐，不重做故事。

## 镜头输入

每个实际 shot 都有 `story/episodes/{ep}/shot-inputs/shotNN.json`：

```json
{"references":[{"kind":"local","media":"video","path":"references/shot/motion.mp4","use":"Control camera, layout, positions and whole-box trajectories with timing","sources":["references/shot/scene.blend"]}]}
```

顶层仅 references，条目仅 local PNG/MP4；每镜至少一个本地 MP4，可辅以 PNG。固定相机/布局可渲染静态 clip。资产图提供身份与外观，BOX MP4 控制相机、取景、尺度、位置/布局及整体轨迹，详细动作、姿态、表情与声音保留在完整 prompt。作品级美术基线在每条请求中表达一次，use 只说明控制权限与占位边界。

Sources 是真实可编辑工程/脚本及所需输入，只作编辑/审核，不上传；路径限定项目 references/。Creator 按需直接使用 Blender/2D/FFmpeg，不建立固定几何 DSL。基础/衍生资产卡可选本地 PNG 参考，见 [卡片契约](skills/_meta/rules/local-reference.md) 和 [工具知识](skills/creator-local-reference/tools.md)。

Converter `--json` 返回 `{prompt,duration,references,assetCards,sources,inputPath}`。Header 身份图先按声明去重，再追加 manifest 有序媒体，图片/视频独立槽位；保留完整七字段和 prose。Task 保存 prompt/duration/references，submission 保存四元组及 references:[{media,path,sha256}]。字段、路径和执行接口见 [精确契约](skills/_meta/rules/shot-inputs.md)。

## 审核与连续性

证据 kind 仅 script、storyboard、asset-prompt、asset-visual、shot-input。最终就绪要求 script/storyboard/asset-visual/shot-input；新生图另须当前 asset-prompt。整集覆盖 script 清单全部资产与实际镜头，局部 scope 包含所选 header 资产。使用同一 canonical SVD_CONFIG：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" ep01
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check ep01
```

整集编号有序、唯一、连续 1..N；选镜允许缺号，保留递增唯一的源编号且每个请求目标须存在。submitted 按 recorded ID/provider 取回，缺 ID 人工核实并保留状态。接口缺失/不相容报告工程阻塞。

独立 shot-input 审核聚焦实际 prompt/media 集成、变化细节及故事必要相邻/非相邻/跨集边界；无具体冲突时复用当前 storyboard 判断。比较位置、轨迹、状态、轴线与身份，实际依赖存 inputs 指纹。源码/记账变更且渲染媒体未变可独立 scoped 兼容性评估，说明依据后续签新轮，不盲刷哈希或自动全量重审。缺必要输入或时序证据为 unknown。

每次视觉操作（渲染、查看、修订、审核、采样/crop）使用全新 task、helper 缩略图和最小必要图集/配对。只 Read review-image.py 返回 preview，原媒体用于上传与指纹。必要 crop 另开任务，披露 MP4 查看方法、采样时刻与覆盖限制。原图不直接 Read；首尾静帧不证明完整轨迹。见 [visual-context](skills/_meta/rules/visual-context.md)。审核者只写指定记录及临时预览；生产 Director 不聚合写 pass，无独立上下文则阻塞。

独立 singleton 直接写受托 review 轮次；相干小批纯文本提示可单个独立任务逐 target 判断并落盘。协调者串行安排同 review 文件写入，仅实际分开的 reviewer 结果需合并时使用独立汇总者。asset-prompt 只覆盖授权新增/重生集合，复用库存仅作必要 inputs；图片操作仍逐次新任务、缩略图优先。

## 配置与执行

配置相关操作先用 `review-evidence.mjs config-path` 规范化 SVD_CONFIG，未设才用 config.md；只支持项目内配置。命令、Task/relay、approval 与指纹使用同一路径。纯 recorded-ID 取回不经过配置/readiness gate。

Creator 只读当前 CLI version/help，核实操作组合和已接入能力，不维护模型表、不付费探测或自动升级。技术选择仅 images/video 的 provider/model/ratio/resolution；固定值绑定，空值/auto 不授予选择权，任务选择不升为默认。用户选定模型后不额外检查账号权益/余额，不为省钱降级；实际失败和用户明确限制仍处理。

Series 从全部 canonical episode tasks 的一致 submission 继承视频四元组；short 共用整集 ratio/resolution。缺项/冲突阻止准备与付费，不阻止取回；不补造快照。系列准备串行，本集锁不保证跨集事务。系列沿用用户初始集时长目标，不按前集实际漂移；单值初次确认 ±10%，严格值/范围优先。

```text
image-gen-dreamina.sh [--force] PROMPT OUTPUT RATIO RESOLUTION MODEL REFS SOURCE
generate-images-dreamina.mjs [--force] [--concurrency N] JOBS.json
storyboard-to-prompt.sh --json STORYBOARD SHOT
video-gen-dreamina.sh --references-json PROMPT OUTPUT REFERENCES_JSON DURATION RATIO MODEL RESOLUTION
video-check-dreamina.sh ID OUTPUT
```

接口只供已授权角色调用，不是绕过证据的指令。image2image 实际 API 的 `--images` 仍接收逗号分隔路径。视频 flag 后七参数，使用 typed refs 上传原始有序 PNG/MP4；capture 保存四元组及媒体 SHA-256。重试保留原输入，不静默 resolve/capture。Wrapper reserve 原子持久化 inflight，settle 保存实际结果；未知 intent/锁人工核实，不按年龄删除，submitted/done 不刷新或自动重提。

## 恢复与监控

资产图片批次使用 runner，jobs 含 source/output/prompt/images/settings。默认本地并发 5，由 Creator 按实际接入限制调整；只等待真实引用依赖，不 shell 并行 raw 调用绕过保护。首次失败/pending 停止新启动并排空 active，保留全部成功、IDs 和未启动旧图。Force 只作用于明确授权 target，调用方不预删图。

Pending/receipt 按已登记 provider/ID/settings 恢复，先 settle 再移除匹配 pending；未知结果或取回失败不重提。普通图片同范围质量修复无默认轮数上限，明确用户限制优先。基础资产提交丢 ID 的有限恢复规则须经过 owner 核实，见 [图像执行](skills/creator-provider-dreamina/image.md)。

| 视频查询结果 | 行为 |
| --- | --- |
| success / 0 | 同一 ID 下载成功，记 done |
| querying / 1 | 正常等待，保留 submitted/id |
| fail:reason / 0 | 记录实际生成失败 |
| error:reason / 2 | 保留 ID 重试取回，不付费重生 |

Done 仅表示下载，不表示质量通过；已有 MP4 不能证明当前任务完成。监控只在用户要求或已同意默认时启动；首次/周期均保留真实 Creator relay、grants 和 inflight 保护。仅有效、目标匹配的末行 JSON 决定停止；all_complete 可含 human_needed，不代表全部成功。监控不创作修复、自动授权或审片。视频仅提交/查询/下载，由用户判断成片，不自动剪辑合成。

首次和周期 checker payload 均显式携带 canonical config_path 或 UNRESOLVED，并沿 Creator relay 保留。UNRESOLVED 只允许取回并报告 human_needed，空值是传输错误，不选择默认配置；配置操作显式验证绑定路径并共用 SVD_CONFIG。

## 维护与验证

源角色在 agents/，知识在 skills/，工程接口在 scripts/。修改后运行 Codex 生成器及 --check，核对 git diff --check；生成层不手改。Mechanical checks 不证明艺术质量、任务隔离或 live-host E2E。当前安装的接口、provider、relay 与监控行为须单独验证；退出重启宿主后确认实际源与 cache。未满足契约的代码问题留给主 AI/general 工程处理，不让创作角色绕过门禁。
