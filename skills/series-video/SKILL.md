---
name: series-video
description: 在用户要求开始多集系列、续作下一集或查看系列配置时使用。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
argument-hint: "自然语言目标、材料或配置请求"
---

## 委托入口

交付采用 [shot-inputs](../_meta/rules/shot-inputs.md)：Creator 设计后将连续摄影 shots 装组，保留时长/对白/切点，`task-inputs/taskNN.json` 草稿恰为 `{shots,references}`，最终恰为 `{shots,references,prompt}`，Creator 据 materials 编写完整任务时间 prompt 并自查最终 `--json`。独立 task_id 来自文件名，每生成任务至少一个全组 MP4，可辅 PNG；header 身份图在前，sources 不上传，静态段可用 clip。fresh 独立 shot-input 审核最终 prompt 的源忠实度、完整性、集成/delta、内部切点/声音桥及必要跨镜/跨集边界，target 指纹绑定 prompt；草稿不就绪。就绪要求 script/storyboard/asset-visual/shot-input，asset-prompt 仅覆盖授权新增/重生集合。选镜须完整组，部分组报告完整成员/额外镜头，不扩授权；系列预算、四元组及视频独立授权保持。

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。原角色一次给齐全部可预见相关问题/表、题界、完整选项/解释、稳定标签及条件分支。主 AI 读全并内部保留计划，仅沿作者题界展示当前题全部内容，再用可用原生键盘选择器，questions 恰好一项。等回答再问下一适用题，相关原始答复及全部条件经 Director 批量完整回原角色原任务，不逐题往返；仅缺内容/映射、不相容或计划外新决定才提前回询。只应用作者条件，不有损改写、不提前展示全表；长解释在控件前，Markdown 不替代可用控件，宿主限制明确披露。

主 AI 在当前上下文用 Skill 加载 `director-orchestrate`，作为生产 Director 负责配置、输入、目标、用户决策与创作协调。每次仅制作一集；制作请求包含所需新增基础资产图和本地参考，intake/当前审核满足后执行，不另问生图授权。配置查看/纯诊断不生成；范围外覆盖、固定设置冲突或受保护任务仍须处理。本流程始终停在付费视频提交前，不自动启动监控；用户后续以自然语言明确要求提交时，AI 本地加载内部 `generate-video`，按实际请求原文与范围登记授权，由真实 Creator 在 grants 和 gate/reserve 约束内提交。

## 配置与目标

获准制作初始化按 [项目启动环境检查](../director-orchestrate/SKILL.md#项目启动环境检查)，由 Director 统一协调 Creator 一次覆盖全部当前支持的本地路线，将真实 pass/unavailable 与命令、版本、backend、路径、结果和限制保存为 `story/work/shared/environment/environment.md` 当前 Markdown 报告。续集及后续 Creator 自查此固定 read 依赖，Director 只协调 init/update 占用与稳定性，不逐次转交内容或路径。缺报告在初始化/恢复统一补齐；实际故障、已知环境变化或新需未验证能力才定向更新，无逐集/例行重测、TTL 或版本扫描。无依赖的 intake/文字可并行，unavailable 只影响依赖工作。报告不进 sources 或默认审核语义 inputs、不按任务复制；探针仅在 `/tmp/opencode`，不自动安装或账号/付费探测。纯配置调用仍只读，不初始化或试渲染。

尽早逐题明确可预见的关键选择与委托余地，不合并问卷或追问尚不可知的艺术细节。原请求已授权且相关 intake 充分即开始，无额外“开始吗”。随后按共享规则连续执行，Director 先用现有材料/配置/grants 和专业判断处理问题，范围内修复与独立审核不需逐轮用户批准；仅真实缺权限、关键冲突或用户指定检查点才询问，进度只作陈述。续集不重开已定选择，仍保留每次一集与视频独立入口边界。

具体创作前完成与当前材料相关的 intake，复用用户/配置/已有材料与实际角色/范围/约束委托，不以沉默或模板代替。剧情未指定但主题、前提或期待体验足够时，Director 默认发展三个完整故事候选，每个有动机、冲突、推进和结局；明确数量优先，已有剧本/选定方向/委托直接复用，续集保留连续性。剧情选择不是探索前置，无关技术设置不阻塞探索；不能先问“谁决定”或只给类型标签。主 AI 全文展示候选后单题选择，加“Director 决定”（按宿主限制映射）。正式剧本/资产等相关选择已知或委托后才制作。只读诊断可先做，后续材料批准与 intake 分开；意外问题仅暂停受影响工作。

初始化和后续角色创作按设置使用相应模型/参数，不必询问预算、费用、积分或余额，不做强制 affordability/最低价检查，不为省钱降级。用户明确限制仍有效，实际账号/provider 失败如实报告；范围、覆盖、重试及视频单独授权仍须遵守。

任何配置读取/写入/evidence 前，从项目根执行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，从 SVD_CONFIG（未设才 config.md）取得 canonical 项目相对 config_path。项目内绝对路径和 ./ 可规范化，外部配置（含 symlink 越界）不支持，在副作用前报告。缺失的项目内路径可只读报告或获准初始化，不静默回退默认。

所有配置与 approval 写入只用 config_path。Task/relay 传此路径；每次配置相关 Bash 显式 `SVD_CONFIG="{config_path}"`，detect-mode 传该路径，read-config 在键名后传该路径。fingerprint、videoProfile 和 evidence 共用 canonical config_path，不依赖工具间环境持久化。

整体理解当前上下文中的用户原始自然语言请求与会话，不按首 token 判断配置意图。查看只 Read 实际配置（SVD_CONFIG 或 config.md），缺失也只报告，不补 mode、不强制初始化。修改须明确范围；获准初始化才参考 [config-template.md](config-template.md) 确认并保存 mode=series 和实际选择。已有冲突先澄清。

制作前用 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh" "{config_path}"` 验证模式；失败停止，不根据 arc 猜测。先确认 canonical episode、材料、范围和授权，再写入或生成。明确目标不能被自动下一集逻辑覆盖；含糊请求不默认最新或全部。
仅当用户明确请求新系列或下一集时，用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/latest-episode.sh"` 解析目标；分别保留 stdout/stderr/exit。不用 Glob 推断目录存在。exit 0 对下一集取十进制编号加一（至少两位），mode=`continue-series`；exit 1 且请求新建时选 ep01、mode=`new-series`；其他错误停止。将解析出的目标与请求核对后委托；不覆盖已有集，修复已有集另走 repair-story。
新系列用 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "总集数" "{config_path}"` 读取 N，并结合用户本次已给出的集数；有效整数 N≥2 直接复用并按授权保存，不重复问。缺失、仅有未经确认模板值或冲突时只澄清必要问题；续作沿用明确配置。

## 集总时长

新系列在第一集开始时由用户决定每集总时长。结合本次请求读取 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "{config_path}"`；用户已给出的目标或明确配置直接复用，续集不重复询问。两处均缺失、空白或仅有未经确认模板值时，正式制作前询问目标或范围，不默用 1-2 分钟；冲突先澄清。查看配置不初始化或追问制作设置。

初次设置单值时说明并确认用户原始目标的 ±10% 创作预算及秒数边界，供 owner 主动安排揭示、倾听和反应，不只是完稿容错；更严格限制优先，精确时长用相等上下界，显式范围不放宽。主 AI 将原始目标与确认边界保存在实际配置，并向各集专家和 Reviewer 传递；本轮或前集合计不成为新基准。按 [集总时长责任](../director-orchestrate/SKILL.md#集总时长责任) 协调更新 canonical script/storyboard 与受影响下游，范围内不逐次求许可。

全部集共用初始用户目标/范围，不拿上一集实际时长作下一集目标。摄影 shot 按叙事及项目限制分配正整数秒，可用短镜，不受 provider 最短时长或 70% 任务目标约束，合计遵守共同预算。Creator 只对装组后的生成任务核对模型边界，不改原时长、对白和切点；参数自主权不含修改集目标。冲突交 Director 协调，不自动拉长或改系列共同目标。

## Provider 配置

全系列各集视频共用 `provider/model/ratio/resolution`，后续集继承一致的已准备 submission，不重新选型。准备前执行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/video-task-inputs.mjs" profile "story/episodes/{ep}/videos/tasks.json"`，任何准备写入前须成功。source=tasks 沿用 profile；无历史快照才按 source=config 固定值和明确委托 null 字段请 Creator 解析，不能绕过其他集或自身已有快照。

扫描全部 canonical episode tasks 的 prepared pending、submitted/done/failed 和 inflight；历史缺字段、冲突或固定配置与继承不符时停止新准备/付费，不改旧任务、不猜默认，查询下载不受影响。provider=none 同样禁新提交。profile 不继承单 shot 时长、内容、引用或任何 grants；集总时长另由初始用户目标跨集共用。系列准备串行执行，现有 episode 锁不构成跨集原子事务；不并发初始化不同集的 profile。

配置能力问题以真实 Task 委托 Creator，提供操作、固定/继承值、范围、约束与 grants。按共享 Concrete Technical Choices 给齐 images/video 未决 provider -> model -> 相容 ratio -> resolution，含当前已接入值、完整解释、逐字段委托选项及明确分支。主 AI 只依作者条件逐题完整展示并原生单选，相关原始答复/条件批量回 Creator；委托模型需专家解析且无后续分支时先回询。按 scope 跳过已答/固定/继承/已委托项，续集保留 profile，不隐藏选项、不把横屏当数值比例。按 template 保存真实选择与 `参数选择授权`，不存静态模型表；能力诊断只读，任务选择不改默认。

用户选定模型即按可访问处理，不查权益/会员/凭据/账号/积分、不索证明或要求确认访问不确定性声明；仍核验当前 CLI/API 技术组合与接入。仅授权执行实际返回账号/provider 错误时报告并处理必要决定，不换固定模型，不声称访问已验证或生成成功；视频仍不得在本入口提交。

## 制作前确认

用户要求先看 outline 或 arc 时，主 AI 在实际配置的 `## 制作前确认 epNN` 段保存一个 JSON 块（替换 ep 为本集）：

```json
{"episode":"ep01","required":["outline"],"approval":null}
```

required 仅列用户要求的 outline/arc，对应本集 outline.md 和 `story/arc.md`；无请求不新建记录，已有记录不可静默清除。未知类型按 [制作前确认](../director-orchestrate/SKILL.md#来源与制作前确认) 报告并阻塞，不过滤或自动批准。Director 先交材料，不进入正式制作。主 AI 用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...` 取得身份，呈现材料并明确询问批准；确认后复核身份未变，将 approval 写为 `{"decision":"用户实际确认内容","inputs":[实际 path/sha256 对]}`。缺失、空白、未批准或变化均阻塞正式制作；变化后重新请用户确认，不沿用旧批准。质量审核不能代替批准。

## 成果委托与转交

主 AI 直接统筹本集 mode/ep，保留成果、config/材料路径、用户原意、已知需求与明确委托、制作前确认、授权范围、集时长与限制、决策余地及升级条件。按成果委托专家，交付相容剧本、分镜、基础资产卡/图、生成 task manifest/完整 shots 与媒体、独立证据、必要跨镜/跨集连续性判断和未决项；生成 task_id 与代理任务 ID 分开。缺 script 清单请 Scriptwriter 接纳剧本补齐；arc/outline 按需采用。用户小说、章节和节选按实际路径交 Scriptwriter 改编，保留采用范围，源文保持原样。

Director 与专家按 descriptions 自选知识，委托说明成果而非技能链。专家/审核协调者可嵌套时直接委派；工具不可用或明确深度拒绝后复用已知限制，普通失败不算。主 AI 忠实转交角色、成果、路径、范围与约束，并恢复原专家、审核协调者或 checker 任务传回实际结果，不调高深度。审核用全新 Reviewer 上下文，不继承制作历史；后续视觉操作仍新 task。必要角色或隔离不可用则阻塞。

主 AI 可编写自己的完整剧情候选并直接呈现，未委托的选择询问用户；已有选择委托由责任角色在范围内决定。自编计划的完整答复本地保留；专家计划及相关原始答复/条件完整批量回原发起任务，不做主 AI 自我 relay，不代写 pass。

## 交付与失败

Director 报告当前范围与证据；整集用 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" "{ep}"` 及同配置 `review-evidence.mjs check "{ep}"` 核验。非零报告未就绪或运行阻塞。缺媒体、审核未决或资源不足保持部分交付；重试次数不产生通过。部分交付/进度不结束原授权委托：仍有可执行、可恢复或待返回工作时，按 Director 的等待/恢复契约继续，补齐本集资产、本地参考、装组与独立审核，不再问“继续吗”，也不自动进入下一集。正常终点是本集制作材料完整、当前审核就绪且下述本集字幕预演已交付，尚未付费视频提交，不是资产图像已提交。真实决策/权限缺口、不可恢复错误或必要工具不可用仅暂停受影响工作并说明阻塞；先检查落盘材料和任务，避免重复提交；取消即停止。

材料就绪不授权付费视频。用户可后续以自然语言明确要求提交指定集与镜头范围、查询下载或持续监控，AI 按实际请求本地加载内部 `generate-video`、`check-video` 或 `auto-video`。查询/监控只取回已登记任务或在有效 grants 内续交、重试；监控仅在用户要求或已有同意默认时启动。成片质量由用户判断，不自动审片或合成。所有生成内容遵循 config 语言与角色版权规避规则。

当前 ep 全部材料、每 task 完整 clean + caption MP4 及现有独立审核 ready、依赖 stable 后，Director 按 [整集字幕预演交付](../director-orchestrate/SKILL.md#整集字幕预演交付) 自动授权单一 Creator 汇总，另交 `references/epNN/episode-previs/review.mp4`；临时映射为 `story/work/epNN/episode-previs/parts.json`。每完成一集交一次，不等待或拼接 all-series，局部制作/修复不扩全片。先拼显式选中的完整 clean，再按 canonical 累计时长重基全部字幕窗口，逐镜显示全片起止区间（含 task 间边界），全片时间码从零开始。保留原 task 交付，无额外许可或新 gate，不写原 reviews/manifest/grants，Director 不自签 pass。报告实际输出、总时长、顺序与限制；工具失败或未完成汇总仍为部分交付。按 [工具接口](../creator-local-reference/tools.md#episode-caption-review-mp4) 输出新文件；正式更新由 Creator 验证新文件后在原授权内安全替换，无 overwrite 参数。本地参考汇总不属于 generated video 剪辑。

## 输入

请求可混合文件参考、内联材料与修改意见；按语义识别路径，无法定位或读取先澄清，不把整句按扩展名分类。长材料由主 AI 读取，向专家委托时传路径及准确意图，不复制整篇；决策包仍须全文转交。已有剧本、分镜和用户选定方向可复用，不强迫重选候选。
