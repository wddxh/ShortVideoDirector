---
name: edit-story
description: 在用户要求修改已有故事、剧本、分镜或视觉资产，并需评估实际影响时使用。
argument-hint: "[自然语言修改意见]"
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 输入与范围

按 [shot-inputs](../_meta/rules/shot-inputs.md) 评估 manifest、PNG/MP4、sources 与独立证据，每镜至少一个 MP4。Reviewer 聚焦实际输入集成、变化细节和必要边界，当前 storyboard 判断在无冲突时复用。源码/记账变化而渲染媒体未变可独立 scoped 兼容性评估，不自动全量重审或盲刷哈希；需看图仍每次新任务、缩略图优先。改输入不刷新已登记视频或 grants；submitted 按 recorded ID/provider 取回。

实际修改/重生请求本身建立其目标操作意图，所需图片生成不另问通用授权；Director 依据请求和当前材料确定受影响范围。纯诊断不生成，未涵盖的覆盖或受保护任务仍阻塞；本入口不提交视频，后续由用户手动 generate-video 请求建立首次视频提交。

按共享 intake 规则先复用已有意图、材料和授权；缺口只读诊断，询问必要需求或让用户明确委托责任角色决定（记录角色/范围/约束）。相关需求不足时不编候选、场景、设计或提示，聊天预览也不例外。预览材料先 intake 后创作，再单独请用户批准。意外问题仅暂停受影响工作。

按已选模型/参数执行，不设预算/费用/积分/余额必填或预检，不为省钱降级；仅用户实际给出的费用限制有约束力，真实 provider 失败仍报告。覆盖、范围和单独视频/重试授权不变。

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。发起角色一次提供全部相关问题及题界/分支；主 AI 读全并内部保留计划，沿作者题界完整展示当前题全部选项/解释再原生单题询问，不用摘要或按钮替代正文、不倾倒全表。仅应用所给条件；相关原始答复及全部条件经 Director 批量完整送回原角色原任务，不逐题往返，提前回询仅限共享规则的缺内容/映射、不相容或计划外决定。

在任何配置读取、写入或 evidence 操作前，从项目根运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，取 SVD_CONFIG（未设才 config.md）的 canonical 项目相对路径为 config_path。支持项目内绝对路径和 ./，外部配置（含 symlink 越界）不支持，报错后在副作用前停止；不复制/改写外部配置。后文 config 均指 config_path，制作前确认与 approval 只写该文件，不写默认 config.md。

所有 Task/relay 传 config_path；配置相关 Bash 显式用 `SVD_CONFIG="{config_path}"`。detect-mode 与 read-config 的配置参数用同一路径；fingerprint 仅用 canonical config_path 与材料路径。videoProfile 和 evidence 共用配置，不依赖跨工具环境持久化。

主 AI 整体理解原始请求 `$ARGUMENTS` 与会话，可混合文件参考、集/镜头范围和修改意见。查看只读 config_path，缺失不初始化；配置修改转配置入口。制作修改读取该配置并运行 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh" "{config_path}"`，失败停止。解析 canonical ep 和 scope；series 缺目标或歧义先澄清，short 仅 ep01，冲突不能忽略。目标不存在或定位不清先问，不选 latest/all 或另开集。跨多集/arc 交 Director 说明范围需求，不扩大执行。

目标集目录用 Bash `test -d "story/episodes/{ep}"` 检查，不用文件 Glob。主 AI 只确认目标、用户意图与授权，不凭关键词决定创作源头。长材料用路径引用。

## 制作前批准

保留 config_path 的 `## 制作前确认 epNN` 记录。用户新增先看材料要求时，仅列 outline/novel/arc，在该文件该段写 `{"episode":"ep01","required":["outline"],"approval":null}`，段内只放一个 fenced JSON（语言标记 json，ep 换为目标集）。对应本集 outline.md、novel.md 和 `story/arc.md`。无请求不新建记录；准备材料可修订，但未批准前不做正式制作。

主 AI 用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...` 获取指定材料身份，向用户展示并明确询问批准；答复后复核同一输入，再将 approval 写为 `{"decision":"用户实际确认内容","inputs":[实际 path/sha256 对]}`。缺失、空白、待批或变动均阻塞；本次修改使已批准材料变化时重新请用户确认，范围确认或质量 pass 不能替代材料批准。

## 协作与交付边界

provider/参数问题交真实 Creator Task 诊断当前能力与接入限制，主 AI 处理用户决定。固定 images/video 设置继续约束，缺值不授予选择权；任务选择不得改项目默认。路径仅定位材料，不授权 force。保留实际 grant、pending/receipt 设置，已有任务先按记录取回，不用当前配置重新选择。

Director 从 descriptions 自选方法。嵌套实际可用则直接委派；明确深度拒绝后在本会话记住限制，普通失败不等于不能嵌套。主 AI 收到转交请求，按其角色、成果、参考路径、范围与约束忠实派发，把结果送回原 Director `task_id`，不另排流程或提高宿主深度。

审核必须是全新 Director 上下文，接收必要当前材料，不继承制作历史。无独立上下文或审核仍有阻塞就保留未通过，不自审、不代写 pass，也不因修了固定轮数继续宣称就绪。

请 Director 依据真实改动评估实际依赖，不自动级联全部文件或清理归档。保留 pending 保护、明确 force 目标和实际成功集合，只重生确认受影响且获准的媒体。独立 shot-input reviewer 选择必要边界配对；已有文件和旧 pass 不证明当前兼容，审核仍覆盖未决目标与缺证据的现有媒体，不只看本次成功项。

返回实际改动、保留理由、当前证据、任务/pending 和未决决策。局部完成不等于整集就绪；整集运行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" "{ep}"` 及同配置 `review-evidence.mjs check "{ep}"`。非零保持阻塞；none 或资源耗尽不豁免必需材料。

技术失败先检查存活材料与任务，避免重复执行；不可恢复则报告原因，用户取消即停止。submitted/done 视频记录保持保护，不自动重提；付费视频另由用户 `/generate-video {ep}` 授权，`/check-video`、`/auto-video` 只用于后续跟踪。成片质量由用户判断，不自动审片或合成。

## 诊断与确认

用 Task 委托 `director` 并保留原始 `task_id`：给出 mode/ep、修改意图、目标与相关材料路径、已知需求与明确委托、图像授权、集时长及用户实际限制、已有制作前确认记录。先请 Director 读取目标及必要上下游，诊断语义源头、实际影响、复用项和风险；意图含糊先澄清或取得范围内决策委托，不先编具体候选或改文件。委托成果不是“加载并执行某 skill”。

Director 先核对原请求、配置、材料和已有 grants；修改意图与权限已充分时直接协调执行，不强制诊断后再问一次“开始吗”。范围内专业选择、修复及独立重审持续进行；进度仅陈述。只有用户要求先看方案、缺必要权限或无法内部解决的关键冲突才返回决策包。主 AI 读全计划，沿作者题界完整展示当前题所有选项、理由、风险与不确定性后原生单题询问，将相关原始答复及全部条件批量送回同一 Director `task_id` 和原发起角色；只暂停受影响工作，不扩大范围或违反限制。

按已有或本次取得的有效授权，由 Director 协调各专业 owner 和独立审核，不由主 AI 遍历节点表。script 是资产清单来源；缺清单委托 Scriptwriter 采用现有剧本补齐，不把 outline 清单合并回去或重写故事。outline/novel/arc 按用途选择，不因缺失自动创建。
