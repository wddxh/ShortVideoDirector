---
name: creator-generate-images
description: 在已授权的基础资产或分镜板需要生成、恢复或定向重生时使用。
user-invocable: false
agent: creator
allowed-tools: Read, Write, Edit, Glob, Skill, Bash
model: sonnet
---

## 委托范围

short/series 制作请求本身包含完成本集所需的新增基础资产图和分镜板图；直接生成/重生请求也表达其已解析目标操作，无额外生图批准握手。普通图片制作意图包含同范围可恢复失败重试、必要质量修复/重生及独立复审，默认不设尝试或轮次上限，不另问重试许可。生成一张图不等于用户明确只许尝试一次；用户明确的单次、次数、范围、检查点和费用限制优先。Director 转交实际请求与范围，当前 intake、设置、审核及依赖满足后执行。仅路径、纯诊断或纯取回不授权生成；超委托覆盖、固定值冲突及 pending/未知结果仍阻塞对应动作。

按 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md` 诊断失败与进展，不盲目无限尝试。参数不支持、账号/额度和其他不可恢复问题停止受影响工作；替代方案只在固定配置与实际裁量授权内执行，否则报告阻塞。pending/未知结果先按已有 id 恢复或核实，轮询超时不算生成失败，不重复提交。质量修订仍经当前 prompt 门禁和新建独立复审；视频授权与次数另行管理。

授权核对是读取实际请求/grants，不是每次生图再问一次。持续有效的生成、替换或重试许可在原目标与限制内复用；制作委托内已诊断必要的质量重生可作为下述目标替换/force 依据，不需另问，但普通 existing skip 不因此变成批量覆盖。缺当前 review 由 Director 自动协调独立审核、权限内修复和重审，不新增用户批准步骤。新问题先查配置、材料和授权，再用 owner 判断；只为真实缺权限、关键冲突或用户指定检查点提问，不扩大范围或绕过 pending。

从当前委托获得 ep、目标卡片、生成/恢复/替换意图、固定设置与授权，不构造位置参数。basic、storyboard-sheets 和 paths 描述范围类别，不是用户必须遵循的语法。写入/付费前确认 canonical 目标；缺失或冲突先澄清，不扩到所有或最新。路径本身不授予 force 权限。

### 无 ID 提交的有限例外

Dreamina 的 text2image/image2image 使用 `--poll=0`，先持久化 receipt 与 pending ID，再独立查询/下载。已有 ID 的 ret 1015、CLI 非零、轮询或下载失败只取回同一任务，不属于丢 ID，不重提。

只有提交没有可用 ID，且 owner 已检查目标 pending、receipt、邻接临时 receipt、日志/下载等本地证据并确认没有活跃 owner，才显式传 `--retry-missing-id`。单图 wrapper、batch runner 和 sheet adapter 均转交此选项；API 为 `retryMissingId: true`。每次调用只增加一次提交，默认最多额外两次（原提交共三次）；计数在重试前持久化，重启、force、普通 reprepare 不重置，保留此前无 ID 证据。旧 `prepared` 也必须通过该显式操作确认无活跃 owner，不删活跃 claim/lock。发现可用 ID 就恢复取回，耗尽则停止并报告；远端可能已有重复任务，必须提示。

这只是无 ID 不确定提交的例外，不是图片质量修复的统一次数上限。用户明确只许一次时不启动额外调用；只许两次时最多追加一次。普通调用不自动重试，纯取回不使用此选项。详细恢复与接口见 [图像接口](../creator-provider-dreamina/image.md)。

## 路由

先核对授权、目标路径和现有 pending。Skill 加载只是当前负责人的本地工具知识，不另行转移角色；不从生图请求推定其他 owner 已完成工作，也不自动委派审核。

纯恢复委托首先按范围筛选 pending 并取回，随后立即返回，不读取生成配置或进入生产门禁，也不顺便生成缺图。其他委托仍先恢复匹配 pending，只有新提交才需要下面的有效 provider 判断与当前生产证据；基础图提交必须执行「基础图生产门禁」。

新提交的配置读取/写入/evidence 前，从项目根运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，把 SVD_CONFIG（未设才 config.md）规范为 canonical 项目相对 config_path；项目内绝对路径/./ 支持，外部配置（含 symlink 越界）不支持，在相关副作用前报告。相关 Bash 显式 SVD_CONFIG，helper 位置参数、Task/relay、配置写入及 fingerprint 共用此路径。

先按目标类型确定有效作用域 provider，再判断 none。基础/衍生资产使用共享 `图像提供方`；sheets 使用用户明确授权的 `分镜板图像提供方` 覆盖，否则继承共享值。共享 none 不否定明确启用的 sheet override，sheet none 也不禁用基础图。固定值冲突且无明确改作用域授权时先澄清；缺值/空值/auto 不授予选择权，卡片的已解析值本身不构成覆盖授权。混合 paths 按各自 scope 判断，none 仅跳过该 scope 新提交并报告恢复结果，不能让整个批次提前返回。其余 tuple 同样遵守固定共享/独立设置与实际参数选择授权。

恢复范围：`paths` 仅匹配显式路径；`storyboard-sheets` 匹配当前 ep 的 sheet 路径；`basic` 匹配 script 清单内基础资产路径。若清单缺失而无法确定基础资产范围，返回需明确路径的请求，不扫描恢复整个项目。查询既有 job 不要求卡片仍存在或通过当前审核；保留 pending 中的身份与输出路径。

既有任务按记录的 provider 取回。缺 provider 的历史 Dreamina-only pending 仅允许 Dreamina 取回；未知显式 provider 保留记录并报告阻塞，不猜测或重提。Creator 根据 descriptions 自行选择适用知识处理匹配范围。仅纯恢复委托遇空集合直接返回；新生成委托无匹配 pending 时继续配置、当前证据与授权检查。下载后先按既有 receipt settle，再移除 pending；不重新 prepare 或解析当前配置。无论结果如何，纯恢复立即返回，不 force/reconcile/续生成。有效 scope 的 none 返回 `images:skipped`（sheet 另报 `storyboard-sheet-images:skipped`），仅指新生成；成功集合仍列本次实际恢复项。缺必需图片仍 blocked，取回不等于验收。

生产 sheet 生图须读取 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md`，核对当前 script/storyboard、本次 card 的 sheet-prompt 和所用基础卡/图证据。按目标最新 scope 轮次、完整 results/footer 和 `review-evidence.mjs fingerprint PATH...` 的实际 inputs 身份判断；标题“通过”、旧 PNG 存在或先前 owner 名称均不够。修改后的 card 需要当前 prompt 验收，不能沿用修改前的 pass。

缺证据或哈希过时返回 blocked 和具体目标，交由 Director 协调独立审核或兼容性评估；不自行写 pass、不自动重生所有依赖。`review-evidence.mjs check {ep} [SHOT...]` 用于完整交付检查，不要求待生成图片先有 visual pass。已提交 pending 的查询/下载不因新的创作门禁而中断；恢复不等于授权新提交。

新提交先由 Creator 按当前能力与已授权字段解析 provider/model/ratio/resolution，并验证实际操作组合及接入限制。none 仅恢复；缺失、不支持或冲突阻塞，不能静默 fallback。Sheet 使用 card 已解析设置，变动需获准准备及当前 prompt review；不在执行时覆盖共享固定值。以下是范围处理规则，不是固定创作链。
`basic`：从当前 script 的「本集资产清单」收集卡，可用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all`。初建可限定 new，恢复/就绪覆盖新旧实际资产；缺清单请求整理，不回退 outline/novel。普通生成由 wrapper 在 claim 内确认 completed skip，不能仅凭已有 PNG 跳过 unresolved/failed receipt；只有明确替换授权才 force。
`storyboard-sheets`：只收集委托范围的 canonical cards。获准整集同步时可用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/reconcile-storyboard-sheet-images.sh {ep}` 清理 orphan 并读取 missing cards；定向委托不清理范围外输出。保留 existing skip，返回 removed 与本次实际成功 shots，不把 preserved/deleted 计入。
`paths`：接受明确基础资产或 sheet cards，按原顺序去重。路径仅定位，不默认 force；显式重生授权才让 wrapper/coordinator 删除对应 output。混合类型遵循实际引用依赖；由 Creator 发现 provider 知识执行，不创建模板技能名。

Sheet 替换的付费边界：确认明确 force 授权、所有 card canonical 且属于本 ep，以及已解析设置和当前证据后，调用 coordinator `[--force] [--concurrency N] CARD...`。其使用共同 runner，先 preflight 全批 pending/设置，再由获调度的单图 wrapper 删除明确 target 旧 PNG。仅实际引用依赖要求等待，无依赖 sheets 可并发。caller 不提前删除，未终态不得绕过保护；未启动 target 保留旧图，已删除后失败的 output 保持 dirty。

基础资产显式替换同样仅删除授权 target output；provider failure leaves target missing，保持 dirty。普通生成不删除现有 PNG。

任何 scope 都不截断参考图。Provider 限制作为 provider 原始错误返回。

## 依赖与并发

标准卡先读取基本信息可选「同实体参考」，按 canonical 直链声明顺序用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/asset-to-image-path.sh" "{ref_card}" ...` 映射为有序 `job.images`；只含直接 refs，不递归展开。声明多项须完整保留；无声明/其他必需引用才可空数组，有 refs 的标准卡走 image2image。提示仍自包容，写清参考绑定与当前目标。衍生资产继续提供其基础图，不用同实体视图替代状态衍生规则。

缺卡、缺图或前置未就绪报告具体 prerequisite blocked，不能丢引用退回 text2image。批内已授权前置图等待完成，批外须就绪；缺前置不自动扩目标、force 或覆盖参考图。基本信息到图片的映射完整性由 Creator 核对，runner 仅按实际 images 强制依赖、状态与有序传参，不推断同实体或验证标准卡声明。

Dreamina 普通批量使用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/generate-images-dreamina.mjs" [--force] [--concurrency N] JOBS.json`；sheet-only 可用上述 card adapter。Creator 准备最小数组，每项 `{source,output,prompt,images,settings:{provider,model,ratio,resolution}}`，只转交当前已审核提示、已解析设置与授权目标，不另造任务协议或技能链。Write/Edit 仅用于此临时 manifest 且每次不超过 2000 字符，不修改卡片/review/pending。

默认本次本地最多 5 个 active jobs，不是账号总配额。Creator 按当前 provider 接入限制及用户约束用 `--concurrency N` 覆盖，不反复询问。`images` 完整有序且为真实图片路径；同实体跨类别、基础/衍生与 previous-sheet 的实际图片引用形成等待边，批内前置输出完成后才供下游使用，批外引用须已就绪。无关目标不加依赖，不按资产类别或全体 pending 轮询建立分阶段屏障；待审依赖先满足实际证据门禁再提交下游。

禁止用 shell 后台并行 raw provider/单图 wrapper 绕过 runner。重复相同 output 去重，冲突请求拒绝；命中 target/ref pending 的批次整体阻塞。output claim 内复查 pending/receipt 与非 force completed skip，不凭旧 PNG 推定已完成。force 作用于全批，只传明确替换目标；缺少授权的前置不得借入批覆盖。

调度发现首次失败/pending 即停止新启动并等待 active 全部结束；保留所有成功、IDs、原始错误与未启动输出，不另开批绕过停止。pending 状态只经 mutex helper 更新；claim 冲突不排队、不自动过期，stale claim/lock 或未知 receipt 先人工核实恢复。调度器不盲重试，也不设置质量轮次上限，后续诊断/修复/复审仍由责任角色决定。具体 CLI/API 输出及整批部分成功恢复见 [图像接口](../creator-provider-dreamina/image.md)。

## 基础图生产门禁

此门禁在调用 provider、单图 wrapper 或执行任何 force 删除之前生效，覆盖 `basic` 与 `paths` 中所有待新提交的基础/衍生卡，不区分 new、reused 或修正来源。普通 existing skip 不触发付费生成，也不由此取得验收；已有 job 的 recovery-only 查询/下载不受此门禁阻断。

读取 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` 和委托本集 `story/episodes/{ep}/.review-asset-prompts.md`。每个 target 必须有独立 Director reviewer 的当前 `asset-prompt` pass：取最新声明该 target 的 scope 轮次，核对 version/kind、完整 results 与 footer、唯一目标结果和空 blockers。标题通过、旧 pass、用户授权或作者自检均不能替代；最新轮未完成或不可解析时保持 unknown。

在项目根目录运行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint "{config_path}" "{asset_path}" ...`；config_path 必须是上述规范化结果，不直接传绝对路径或 ./。逐项核对证据 inputs，至少含当前卡和该配置，以及实际参考的剧本、基础卡等输入；对证据内全部项目输入重新采指纹，不能漏掉配置。提交前复核身份，哈希由 helper 计算，不编造或刷新证据冒充审核。

缺项、needs_revision、unknown 或身份过时的目标报告 blocked，保留其旧 PNG，不传给 provider/force；由 Director 决定独立复审或兼容性评估。只放行通过的明确目标，缺失依赖同样阻止对应提交。不调用整集 `review-evidence.mjs check` 作为基础图生成前提，不要求待生成图先有 asset-visual pass，也不要求 sheets 已完成。

明确授权的视觉探索须单独标明目的、范围和用户实际约束，并与生产提交分开报告；不要求费用字段或余额预检，按已选模型/参数执行，不为省钱降级。普通生成/修复请求不能自动降级为探索以绕过失败。探索结果不是 accepted delivery，不写 pass、不自动推进生产；覆盖已有生产 PNG 仍需上述当前 prompt 验收，另存探索产物须有单独输出授权，不能擅自改现有 wrapper 的路径协议。

## 输出

排空 active 后返回全组 scope、成功、跳过、失败、pending 和 blocked 数量；保留每个失败路径、原始原因和全部已知 IDs，CLI 非零不等于无成功。Basic/paths scope 透传本次实际落盘成功的基础资产卡，稳定输出 `successful asset paths: {asset_path...} | none`，不含 existing skip、失败或未落盘 pending。Sheet scope 额外返回稳定集合 `successful shots: shotNN ... | none`，只列本次实际落盘成功的 shots。

生成后的 visual review 必须覆盖本次成功且实际更新的图片；失败或 pending 未落盘的输出不能当作新图送审。成功集合仅描述本次生成结果，不是全部审核范围：Director 可另行纳入已有但未审核、证据过时或 unknown 的目标进行评估，并保留其他未解决目标。不得用本次生成成功子集替换 outstanding review scope；成功集合为空也不表示没有待审项。缺图目标继续报告阻塞，不伪造视觉通过。
