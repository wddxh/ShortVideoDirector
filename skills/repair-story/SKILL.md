---
name: repair-story
description: 在单集制作中断、材料或审核缺失，需要检查现状并恢复时使用。
argument-hint: "自然语言恢复目标、材料与范围"
user-invocable: false
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

## 接收与检查

主 AI 在当前上下文用 Skill 加载 `director-orchestrate`，作为生产 Director 直接诊断恢复、协调专家、处理用户决策并对交付负责。独立验收委托全新 Reviewer。

实际制作恢复请求包含其范围内所需图片补齐，不另问通用生图授权；纯检查/取回仍止于诊断或恢复已有 job。替换意图不清、超范围覆盖、固定参数冲突或 protected jobs 仍须处理，不借缺图重复提交。用户后续以自然语言明确要求提交视频时，AI 本地加载内部 `generate-video`；不因本次恢复完成自动提交。

按共享 intake 规则复用已有需求、材料和授权，不重新问卷。先只读诊断；恢复中需新创作时，相关需求须已知或用户明确委托责任角色决定（记录角色/范围/约束），否则仅问必要缺口，不先编候选、设计、提示或聊天预览。准备材料同样先 intake，后续用户批准另行处理；意外问题仅暂停受影响工作，已有任务取回可继续。

按已选模型/参数执行，不设预算/费用/积分/余额必填或预检，不为省钱降级；仅用户实际给出的费用限制有约束力，真实 provider 失败仍报告。范围、覆盖、首次/重试、inflight 和视频单独授权不变。

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。发起角色一次提供全部相关问题及题界/分支；主 AI 读全并内部保留计划，沿作者题界完整展示当前题全部选项/解释再原生单题询问，不用摘要或按钮替代正文、不倾倒全表。仅应用所给条件；相关原始答复及全部条件经 Director 批量完整送回原角色原任务，不逐题往返，提前回询仅限共享规则的缺内容/映射、不相容或计划外决定。

配置读取/写入或 evidence 操作前，从项目根运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，把 SVD_CONFIG（未设才 config.md）解析为 canonical 项目相对 config_path。项目内绝对路径和 ./ 可规范化；外部配置（含 symlink 越界）明确不支持，在副作用前报告，不复制迁移。后文 config 均指此文件，制作前确认和 approval 只写 config_path。

配置相关 Bash 显式传 `SVD_CONFIG="{config_path}"`，Task/relay 同样传该路径。detect-mode 配置参数、read-config 键名后参数也用该路径；fingerprint、videoProfile 与 evidence 共用 canonical config_path，不依赖跨工具环境。纯取回不需要配置有效或当前审核，按 recorded provider/receipt 处理。

整体理解当前上下文中的用户原始自然语言请求与会话中的恢复目标、路径和范围。查看只读 config_path，缺失不初始化；配置修改转配置入口。制作恢复读取该配置并运行 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh" "{config_path}"`，失败停止。写入/生成前确定 canonical ep 和 scope；series 缺目标先问，只有明确“最新一集”才用 latest-episode 并检查退出码。short 仅 ep01，冲突不能忽略。歧义不默认 latest/all。用 Bash `test -d "story/episodes/{ep}"` 检查目录；不存在报告，不自动新建。

按请求范围运行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" "{ep}" [SHOT...]` 和同配置 `review-evidence.mjs check "{ep}" [SHOT...]`，保留 stdout/stderr/exit。整集省略选镜；局部须覆盖完整组，部分组报告完整成员/额外镜头，不扩授权，也不要求未选媒体或完整全片计划。非零用于诊断缺口，不规定恢复顺序。

## 恢复判断

按 [shot-inputs](../_meta/rules/shot-inputs.md) 恢复 `task-inputs/taskNN.json`：草稿 `{shots,references}` 仅供 materials，最终须 `{shots,references,prompt}`，Creator 据当前材料写非空白语义 prompt 并自查最终 `--json`。每任务至少一个全组 MP4，可辅 PNG。装组保留 canonical 时长/对白/切点；重设计交 Director/owner 在原始确认预算内同步源/下游，范围内不逐次求许可，精确要求优先，基准不滚动。部分选组报告 task_id、完整成员/额外镜头，不扩授权。fresh shot-input Reviewer 的最终 manifest target 指纹绑定 prompt，核对源忠实度、完整性、可见性/注意/时序、内部切点/声音桥及边界，无冲突复用 storyboard 判断；草稿不通过最终审核/就绪。源码/记账变且媒体未变可 scoped 兼容性评估，不盲刷哈希或自动全量重审；看图仍新任务/缩略图。sources 入指纹不上传，必要运动不可查 unknown。asset-prompt 仅覆盖授权新增/重生图；submitted 按 recorded ID/provider 取回，保留 pending/receipt/grants/inflight。

provider/参数问题由真实 Creator Task 解释当前能力与接入限制，主 AI 询问所需决定。固定 images/video 配置继续约束；空值不授权选择，任务选择不改默认。已有 pending/receipt 按记录取回，不按新 config 重选；视频缺失/未知 provider 保留记录并报 human_needed，不猜路由。图像恢复按其 provider 指引执行。路径不等于 force 授权。

缺 outline/arc 不阻止恢复已有剧本、分镜或资产；仅在有用或用户要求时规划。用户小说、章节和节选按实际路径与采用范围作为 Scriptwriter 改编输入，源文保持原样。资产清单以 script 为准，可用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all` 核对新旧资产。缺清单委托 Scriptwriter 采用现有剧本并补齐，不重生故事、不回退 outline。

依据受影响材料和证据选工作；哈希变化先评估兼容性，不全部重生。仅缺 review 时审核现有媒体，不只看本次成功项。按实际成功集合、必要依赖和未决范围协调重审，保留编号与引用一致性，不自动清理归档或把已删除卡当作生成目标。

已有 pending 先核对记录身份并恢复，不因缺图重复提交；查询/下载不要求当前创作审核已通过，恢复完成也不等于验收或新提交授权。图像提供方 none 禁止新生图但仍可恢复既有任务，缺必需图仍阻塞。视频 submitted/done 不改写、不重提；视频查询下载交独立视频入口，不借本次恢复启动付费视频。

## 制作前批准

保留 config_path 的 `## 制作前确认 epNN`。用户要求先看 outline/arc 时，由主 AI 仅在该文件写本集记录，例如 `{"episode":"ep01","required":["outline"],"approval":null}`，段内只放一个 fenced JSON（语言标记 json，ep 换为目标集）。对应本集 outline.md 和 story/arc.md。无请求不新建；已有要求不因恢复删除。未知类型按 [制作前确认](../director-orchestrate/SKILL.md#来源与制作前确认) 报告并阻塞，不过滤或自动批准。指定材料缺失、空白、未批准或已变化时，不推进正式制作；不阻断已提交任务取回。

主 AI 用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...` 记录材料身份，展示后明确询问用户批准；答复后复核身份未变，写 approval=`{"decision":"用户实际确认内容","inputs":[实际 path/sha256 对]}`。变动需重新确认，恢复范围确认和独立质量通过都不能替代此批准。

## 协作与结果

Director 与专家从 descriptions 选择知识。专家/审核协调者在嵌套支持时直接委派；工具不可用或明确深度拒绝后复用已知限制，普通失败不算。主 AI 按 role/outcome/references/scope/constraints 忠实转交，恢复原专家、审核协调者或 checker 任务传回实际结果，不提高宿主深度；后续视觉操作仍新 task。

独立审核使用全新 Reviewer 上下文，不继承制作历史。独立上下文不可用、needs_revision/unknown 或证据过时均保持阻塞，不自审兜底、不按固定重试次数换取通过。技术失败检查实际落盘与任务状态，报告可恢复范围；取消即停止。

返回恢复/保留路径、当前证据、pending 与未决决策。整集交付重跑上述 check-shot-inputs 与 evidence 检查，非零不称就绪。局部恢复不等于整集完成；缺媒体、资源不足或审核未决报告部分交付。视频另获授权提交，取回交 check-video/auto-video；不自动审片或合成。

## 恢复执行

主 AI 直接统筹 mode/ep、用户期望、config/材料路径、检测结果、已知需求与明确委托、制作前确认、图像授权、集时长及实际限制。检查当前文件、review 的 scope/输入身份/未决结论及 `assets/images/pending.json`、本集 `videos/tasks.json`（若存在），诊断恢复成果与风险。原请求/有效 grants 已覆盖的恢复、生成或替换交专业 owner 继续；仅诊断或缺权限时返回建议范围，不擅自生成或覆盖。

已有恢复权限充分时不重复确认；Director 在原范围内协调 owner 修复与独立重审。新问题先查配置、材料和 grants 并用专业判断处理，仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才准备完整决策包。主 AI 读全计划，沿作者题界完整展示当前题后原生单题询问；自编计划答复本地保留，专家计划的相关原始答复及全部条件批量完整回原发起任务，只暂停受影响工作。进度不是批准请求，不强制最终“开始吗”。已有充分证据且无待办可报告无需修复，但文件存在本身不是艺术验收。
