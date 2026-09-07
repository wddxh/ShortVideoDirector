---
name: creator-generate-images
description: 在已授权的基础资产需要生成、恢复或定向重生，或登记图像任务需要按 ID 取回时使用。
user-invocable: false
agent: creator
allowed-tools: Read, Write, Edit, Glob, Skill, Bash
model: sonnet
---

## 委托范围

本方法只生产授权基础/衍生资产图。最终 [输入包](../_meta/rules/shot-inputs.md) 由 Creator 组装，每镜至少一个本地 MP4，并做独立 shot-input 审核；本图像 runner 不创建视频任务。最终就绪接受当前 asset-visual；asset-prompt 只审核授权新增/重生集合，复用库存仅作必要参考。保留下述 pending/receipt/force 保护，按 recorded ID 恢复已提交图像任务。

short/series 请求包含本集所需新增基础资产图与本地参考；直接生成/重生请求表达目标操作，不另问生图许可。普通图片制作包含同范围可恢复失败重试、必要质量修复/重生与独立复审，无默认次数/轮次上限。生成一张不等于只许一次；用户明确次数、范围、检查点及费用限制优先。Director 转交实际请求，intake、设置、审核及依赖满足后执行。路径或纯诊断/取回不授权生成；超范围覆盖、固定值冲突和 pending/未知结果仍阻塞。

按 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md` 诊断失败与进展，不盲目无限尝试。参数不支持、账号/额度和其他不可恢复问题停止受影响工作；替代方案只在固定配置与实际裁量授权内执行，否则报告阻塞。pending/未知结果先按已有 id 恢复或核实，轮询超时不算生成失败，不重复提交。质量修订仍经当前 prompt 门禁和新建独立复审；视频授权与次数另行管理。

授权核对是读取实际请求/grants，不是每次生图再问一次。持续有效的生成、替换或重试许可在原目标与限制内复用；制作委托内已诊断必要的质量重生可作为下述目标替换/force 依据，不需另问，但普通 existing skip 不因此变成批量覆盖。缺当前 review 由 Director 自动协调独立审核、权限内修复和重审，不新增用户批准步骤。新问题先查配置、材料和授权，再用 owner 判断；只为真实缺权限、关键冲突或用户指定检查点提问，不扩大范围或绕过 pending。

从当前委托取得 ep、目标资产卡、生成/恢复/替换意图、固定设置及授权，不构造位置参数。basic/paths 描述范围，不是用户语法。写入/付费前确认 canonical 目标；缺失或冲突先澄清，不默认全部/最新。路径不授予 force。

### 无 ID 提交的有限例外

Dreamina 的 text2image/image2image 使用 `--poll=0`，先持久化 receipt 与 pending ID，再独立查询/下载。已有 ID 的 ret 1015、CLI 非零、轮询或下载失败只取回同一任务，不属于丢 ID，不重提。

仅资产图提交无可用 ID，且 owner 已检查 pending、receipt、邻接临时 receipt、日志/下载证据并确认无活跃 owner，才显式传 `--retry-missing-id`；wrapper/runner API 为 `retryMissingId:true`。每次仅追加一次，最多额外两次（原提交共三次），重试前持久化计数，重启/force/reprepare 不重置。prepared 也须确认无活跃 owner，不删活跃 claim/lock。发现 ID 即取回，耗尽停止；须提示远端重复风险。retrieval-only 类型不适用此例外。

这只是无 ID 不确定提交的例外，不是图片质量修复的统一次数上限。用户明确只许一次时不启动额外调用；只许两次时最多追加一次。普通调用不自动重试，纯取回不使用此选项。详细恢复与接口见 [图像接口](../creator-provider-dreamina/image.md)。

## 路由

先核对授权、目标路径和现有 pending。Skill 加载只是当前负责人的本地工具知识，不另行转移角色；不从生图请求推定其他 owner 已完成工作，也不自动委派审核。

纯恢复委托首先按范围筛选 pending 并取回，随后立即返回，不读取生成配置或进入生产门禁，也不顺便生成缺图。其他委托仍先恢复匹配 pending，只有新提交才需要下面的有效 provider 判断与当前生产证据；基础图提交必须执行「基础图生产门禁」。

新提交的配置读取/写入/evidence 前，从项目根运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，把 SVD_CONFIG（未设才 config.md）规范为 canonical 项目相对 config_path；项目内绝对路径/./ 支持，外部配置（含 symlink 越界）不支持，在相关副作用前报告。相关 Bash 显式 SVD_CONFIG，helper 位置参数、Task/relay、配置写入及 fingerprint 共用此路径。

基础/衍生资产使用 images scope 的 `图像提供方`。none 仅禁新提交，恢复已登记任务仍继续。固定值冲突且无明确授权时先澄清；缺值/空值/auto 不授予选择权，已解析值本身不构成覆盖授权。其余 tuple 同样遵守固定设置与实际参数选择授权。

恢复范围：`paths` 仅匹配明确路径；`basic` 匹配 script 清单内基础资产。缺清单而无法确定范围时请求明确路径，不扫描恢复整个项目。既有其他类型任务只按明确 recorded ID/source/output 取回，不要求当前卡片仍存在或审核通过；保留 pending 身份与输出路径。

既有任务按 recorded provider 取回。缺 provider 的 Dreamina-only 记录仅可取回；未知显式 provider 保留并报告，不猜测或重提。纯恢复空集合直接返回，新生产无 pending 则继续配置/证据/授权检查。下载后先按 receipt settle，再移除 matching pending，不重新 prepare 或选设置。纯恢复始终返回，不 force/续生成。none 报 `images:skipped` 仅指新生成，另列实际恢复成功项；缺必需图片仍 blocked，取回不等于验收。


缺证据或哈希过时返回 blocked 和具体目标，交由 Director 协调独立审核或兼容性评估；不自行写 pass、不自动重生所有依赖。`review-evidence.mjs check {ep} [SHOT...]` 用于完整交付检查，不要求待生成图片先有 visual pass。已提交 pending 的查询/下载不因新的创作门禁而中断；恢复不等于授权新提交。

新提交由 Creator 按当前能力与授权字段解析 provider/model/ratio/resolution，验证操作组合及接入限制。none 仅恢复；缺失、不支持或冲突阻塞，不静默 fallback 或覆盖固定值。以下是范围规则，不是固定创作链。
`basic`：从当前 script 的「本集资产清单」定位卡，再与实际授权新增/重生集合取交集作为生产及 prompt-review 目标；复用库存只作必要依赖。恢复/visual 就绪可用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all`，不因此扩大生产范围。缺清单交责任人补齐。普通生成由 wrapper 在 claim 内确认 completed skip，不凭已有 PNG 跳过 unresolved/failed receipt；明确替换授权才 force。
`paths`：新生产只接受明确基础/衍生资产卡，按原顺序去重。路径不默认 force；明确替换授权才让 wrapper 删除对应 output。按实际引用依赖执行。


基础资产显式替换同样仅删除授权 target output；provider failure leaves target missing，保持 dirty。普通生成不删除现有 PNG。

任何 scope 都不截断参考图。Provider 限制作为 provider 原始错误返回。

## 依赖与并发

卡片有 `## 本地制作参考` 时必读 [共享契约](../_meta/rules/local-reference.md)，从项目根运行 `local-reference.mjs parse|ready CARD`（脚本位于 `${CLAUDE_PLUGIN_ROOT}/scripts/`）。本地 PNG 和实际可编辑工程/脚本/输入须先就绪并进入当前 prompt 独立审核；该检查不要求普通未来生成 PNG 先存在。缺声明文件不可删引用降成 text2image。

基础 job.images 保留全部同实体/基础资产图，再按声明顺序追加本地 images 各一次，作为精确后缀。已审核完整 prompt 绑定实际参考及 narrative 的控制意图/占位边界；wrapper 不自动拼接。Sources 不上传。Runner/wrapper 检查本地声明及真实文件，不替代语义判断。

需要重新制作参考时，Creator 按 local craft 知识和原委托直接编辑 references/、渲染/看图/修订，再由 Director 协调受影响审核，不让 provider runner 变成本地生产脚本。当前 provider wrappers/evidence 是付费执行安全桥梁，不是艺术调度器；本 skill 的 manifest-only 编辑范围不扩张到其他 owner 文件或擅自改审核。

标准卡先读取基本信息可选「同实体参考」，按 canonical 直链声明顺序用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/asset-to-image-path.sh" "{ref_card}" ...` 映射为有序 `job.images`；只含直接 refs，不递归展开。声明多项须完整保留；无声明/其他必需引用才可空数组，有 refs 的标准卡走 image2image。提示仍自包容，写清参考绑定与当前目标。衍生资产继续提供其基础图，不用同实体视图替代状态衍生规则。

缺卡、缺图或前置未就绪报告具体 prerequisite blocked，不能丢引用退回 text2image。批内已授权前置图等待完成，批外须就绪；缺前置不自动扩目标、force 或覆盖参考图。基本信息到图片的映射完整性由 Creator 核对，runner 仅按实际 images 强制依赖、状态与有序传参，不推断同实体或验证标准卡声明。

Dreamina 批量用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/generate-images-dreamina.mjs" [--force] [--concurrency N] JOBS.json`。每项 `{source,output,prompt,images,settings:{provider,model,ratio,resolution}}` 只含审核提示、解析设置及授权资产。Write/Edit 仅写此临时 manifest，每次不超过 2000 字符，不改卡片/review/pending。

默认本地最多 5 个 active jobs，不是账号总配额。Creator 按接入限制与用户约束用 `--concurrency N` 覆盖，不反复问。images 完整有序；同实体及基础/衍生实际引用形成等待边，批内前置完成后供下游使用，批外须就绪。无关目标不加依赖或阶段屏障，待审依赖先满足证据门禁。

禁止用 shell 后台并行 raw provider/单图 wrapper 绕过 runner。重复相同 output 去重，冲突请求拒绝；命中 target/ref pending 的批次整体阻塞。output claim 内复查 pending/receipt 与非 force completed skip，不凭旧 PNG 推定已完成。force 作用于全批，只传明确替换目标；缺少授权的前置不得借入批覆盖。

调度发现首次失败/pending 即停止新启动并等待 active 全部结束；保留所有成功、IDs、原始错误与未启动输出，不另开批绕过停止。pending 状态只经 mutex helper 更新；claim 冲突不排队、不自动过期，stale claim/lock 或未知 receipt 先人工核实恢复。调度器不盲重试，也不设置质量轮次上限，后续诊断/修复/复审仍由责任角色决定。具体 CLI/API 输出及整批部分成功恢复见 [图像接口](../creator-provider-dreamina/image.md)。

## 基础图生产门禁

此门禁在调用 provider、单图 wrapper 或执行任何 force 删除之前生效，覆盖 `basic` 与 `paths` 中所有待新提交的基础/衍生卡，不区分 new、reused 或修正来源。普通 existing skip 不触发付费生成，也不由此取得验收；已有 job 的 recovery-only 查询/下载不受此门禁阻断。

读取 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` 和本集 `.review-asset-prompts.md`。授权新增/重生集合内每个待提交 target 须有独立 Director 当前 `asset-prompt` pass：取最新声明目标的轮次，核对 kind/scope/results、footer、唯一结果和空 blockers。singleton 或相干纯文本批次可直接写受托轮次；复用库存不扩 scope。最新轮未完成或不可解析为 unknown，用户授权或作者自检不替代验收。

在项目根目录运行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint "{config_path}" "{asset_path}" ...`；config_path 必须是上述规范化结果，不直接传绝对路径或 ./。逐项核对证据 inputs，至少含当前卡和该配置，以及实际参考的剧本、基础卡等输入；对证据内全部项目输入重新采指纹，不能漏掉配置。提交前复核身份，哈希由 helper 计算，不编造或刷新证据冒充审核。

缺项、needs_revision、unknown 或过时目标报告 blocked，保留旧 PNG，不传 provider/force；Director 协调独立复审或兼容性评估。仅放行通过的明确目标，缺依赖阻止对应提交。整集 readiness 不是基础图生成前提，不要求未来输出先有 asset-visual pass。

明确授权的视觉探索须单独标明目的、范围和用户实际约束，并与生产提交分开报告；不要求费用字段或余额预检，按已选模型/参数执行，不为省钱降级。普通生成/修复请求不能自动降级为探索以绕过失败。探索结果不是 accepted delivery，不写 pass、不自动推进生产；覆盖已有生产 PNG 仍需上述当前 prompt 验收，另存探索产物须有单独输出授权，不能擅自改现有 wrapper 的路径协议。

## 输出

排空 active 后返回全组 scope、成功/跳过/失败/pending/blocked 数量，保留失败路径、原始原因和全部 IDs；CLI 非零不等于无成功。稳定输出 `successful asset paths: {asset_path...} | none`，仅列本次实际落盘成功资产，不含 skip、失败或未落盘 pending。其他已登记图像的纯取回单列实际 ID/output，不产生新生产目标。

生成后的 visual review 必须覆盖本次成功且实际更新的图片；失败或 pending 未落盘的输出不能当作新图送审。成功集合仅描述本次生成结果，不是全部审核范围：Director 可另行纳入已有但未审核、证据过时或 unknown 的目标进行评估，并保留其他未解决目标。不得用本次生成成功子集替换 outstanding review scope；成功集合为空也不表示没有待审项。缺图目标继续报告阻塞，不伪造视觉通过。
