---
name: series-video
description: 在开始多集系列、续作下一集或用 /series-video config 查看配置时使用。
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
argument-hint: "自然语言目标、材料或配置请求"
---

## 委托入口

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。原角色一次给齐全部可预见相关问题/表、题界、完整选项/解释、稳定标签及条件分支。主 AI 读全并内部保留计划，仅沿作者题界展示当前题全部内容，再用可用原生键盘选择器，questions 恰好一项。等回答再问下一适用题，相关原始答复及全部条件经 Director 批量完整回原角色原任务，不逐题往返；仅缺内容/映射、不相容或计划外新决定才提前回询。只应用作者条件，不有损改写、不提前展示全表；长解释在控件前，Markdown 不替代可用控件，宿主限制明确披露。

主 AI 负责配置、输入、目标与用户决策；用 Task 将创作成果委托给 Director，不自己编排创作步骤。每次仅制作一集；该制作请求本身包含所需新增基础资产图和分镜板图片，intake/当前审核满足后直接生成，不另问生图授权。配置查看/纯诊断不生成；范围外覆盖、固定设置冲突或受保护任务仍须处理。本流程始终停止在视频生成之前，即使全部审核完成；只有用户后续手动调用 generate-video 才提交视频。

## 配置与目标

尽早逐题明确可预见的关键选择与委托余地，不合并问卷或追问尚不可知的艺术细节。原请求已授权且相关 intake 充分即开始，无额外“开始吗”。随后按共享规则连续执行，Director 先用现有材料/配置/grants 和专业判断处理问题，范围内修复与独立审核不需逐轮用户批准；仅真实缺权限、关键冲突或用户指定检查点才询问，进度只作陈述。续集不重开已定选择，仍保留每次一集与视频独立入口边界。

具体创作前完成与当前材料相关的 intake，复用用户/配置/已有材料与实际角色/范围/约束委托，不以沉默或模板代替。剧情未指定但主题、前提或期待体验足够时，Director 默认发展三个完整故事候选，每个有动机、冲突、推进和结局；明确数量优先，已有剧本/选定方向/委托直接复用，续集保留连续性。剧情选择不是探索前置，无关技术设置不阻塞探索；不能先问“谁决定”或只给类型标签。主 AI 全文展示候选后单题选择，加“Director 决定”（按宿主限制映射）。正式剧本/资产等相关选择已知或委托后才制作。只读诊断可先做，后续材料批准与 intake 分开；意外问题仅暂停受影响工作。

初始化和后续角色创作按设置使用相应模型/参数，不必询问预算、费用、积分或余额，不做强制 affordability/最低价检查，不为省钱降级。用户明确限制仍有效，实际账号/provider 失败如实报告；范围、覆盖、重试及视频单独授权仍须遵守。

任何配置读取/写入/evidence 前，从项目根执行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，从 SVD_CONFIG（未设才 config.md）取得 canonical 项目相对 config_path。项目内绝对路径和 ./ 可规范化，外部配置（含 symlink 越界）不支持，在副作用前报告。缺失的项目内路径可只读报告或获准初始化，不静默回退默认。

所有配置与 approval 写入只用 config_path。Task/relay 传此路径；每次 Bash 显式 `SVD_CONFIG="{config_path}"`，detect-mode 传该路径，read-config 在键名后传该路径，check-episode 在 ep 后传该路径。fingerprint 用 canonical config_path，videoProfile 和 evidence 必须共用同一配置，不依赖工具间环境持久化。

整体理解原始请求 `$ARGUMENTS` 与会话，不按首 token 判断配置意图。查看只 Read 实际配置（SVD_CONFIG 或 config.md），缺失也只报告，不补 mode、不强制初始化。修改须明确范围；获准初始化才参考 [config-template.md](config-template.md) 确认并保存 mode=series 和实际选择。已有冲突先澄清。

制作前用 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh" "{config_path}"` 验证模式；失败停止，不根据 arc 猜测。先确认 canonical episode、材料、范围和授权，再写入或生成。明确目标不能被自动下一集逻辑覆盖；含糊请求不默认最新或全部。
仅当用户明确请求新系列或下一集时，用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/latest-episode.sh"` 解析目标；分别保留 stdout/stderr/exit。不用 Glob 推断目录存在。exit 0 对下一集取十进制编号加一（至少两位），mode=`continue-series`；exit 1 且请求新建时选 ep01、mode=`new-series`；其他错误停止。将解析出的目标与请求核对后委托；不覆盖已有集，修复已有集另走 repair-story。
新系列用 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "总集数" "{config_path}"` 读取 N，并结合用户本次已给出的集数；有效整数 N≥2 直接复用并按授权保存，不重复问。缺失、仅有未经确认模板值或冲突时只澄清必要问题；续作沿用明确配置。

## 集总时长

新系列在第一集开始时由用户决定每集总时长。结合本次请求读取 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "{config_path}"`；用户已给出的目标或明确配置直接复用，续集不重复询问。两处均缺失、空白或仅有未经确认模板值时，正式制作前询问目标或范围，不默用 1-2 分钟；冲突先澄清。查看配置不初始化或追问制作设置。

初次设置单值时说明并确认 scene-duration 的 ±10% 容差及对应秒数边界；用户更严格的限制优先，精确时长用相等上下界。显式范围不额外放宽。实际目标与确认的容差/严格边界保存到实际配置，并随每集委托传给 Director。

全部集始终共用这个初始用户目标/范围，使各集总时长大致相同；不能拿上一集实际时长作为下一集目标而逐集漂移。单 shot 时长与内容可在 provider/项目约束内灵活安排，但合计遵守共同预算。Creator 参数自主权不含修改集目标；冲突或内容无法适配由 Director 提修改方案或经主 AI 询问用户，不自动拉长或静默改系列共同目标。

## Provider 配置

全系列各集视频共用 `provider/model/ratio/resolution`，后续集继承一致的已准备 submission，不重新选型。准备前执行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/video-task-inputs.mjs" profile "story/episodes/{ep}/videos/tasks.json"`，任何准备写入前须成功。source=tasks 沿用 profile；无历史快照才按 source=config 固定值和明确委托 null 字段请 Creator 解析，不能绕过其他集或自身已有快照。

扫描全部 canonical episode tasks 的 prepared pending、submitted/done/failed 和 inflight；历史缺字段、冲突或固定配置与继承不符时停止新准备/付费，不改旧任务、不猜默认，查询下载不受影响。provider=none 同样禁新提交。profile 不继承单 shot 时长、内容、引用或任何 grants；集总时长另由初始用户目标跨集共用。系列准备串行执行，现有 episode 锁不构成跨集原子事务；不并发初始化不同集的 profile。

配置能力问题以真实 Task 委托 Creator，提供操作、固定/继承值、范围、约束与 grants。按共享 Concrete Technical Choices，一次提供 images/video/sheets 各 scope 的全部未决问题：provider -> model -> 相容 ratio -> resolution，含已接入且当前支持的具体值、完整解释、“此字段交 Creator 决定”及明确相容分支。主 AI 仅依作者条件逐题展示当前全部选项并原生单选，相关原始答复/条件批量回 Creator；不推断 provider 知识。若委托模型须 Creator 先解析且无后续分支，才提前回询再问依赖项。不以笼统“技术交团队”替代具体选择，不因用户不懂隐藏选项；已答/固定/继承/已委托项按 scope 跳过，续集保留上述 profile，sheet 继承和授权覆盖分清，横屏不擅定数值比例。用 template 保存实际选择与 `参数选择授权`，不维护静态模型表或示例默认；任务选择不改项目默认，能力诊断不提交或写配置。

用户选定模型即按可访问处理，不查权益/会员/凭据/账号/积分、不索证明或要求确认访问不确定性声明；仍核验当前 CLI/API 技术组合与接入。仅授权执行实际返回账号/provider 错误时报告并处理必要决定，不换固定模型，不声称访问已验证或生成成功；视频仍不得在本入口提交。

## 制作前确认

用户要求先看 outline、novel 或 arc 时，主 AI 在实际配置的 `## 制作前确认 epNN` 段保存一个 JSON 块（替换 ep 为本集）：

```json
{"episode":"ep01","required":["outline"],"approval":null}
```

仅记录用户要求的材料；无请求不新建记录，已有记录不可静默清除。对应路径是本集 outline.md、novel.md 和 `story/arc.md`。Director 先交这些材料，不进入正式制作。主 AI 用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...` 取得身份，呈现材料并明确询问批准；确认后复核身份未变，将 approval 写为 `{"decision":"用户实际确认内容","inputs":[实际 path/sha256 对]}`。缺失、空白、未批准或变化均阻塞正式制作；变化后重新请用户确认，不沿用旧批准。质量审核不能代替批准。

## 成果委托与转交

用 Task 派发 `director`，保存返回的原始 `task_id`。委托内容：本集 mode/ep、期望成果、config 与材料路径、用户原意、intake 已知需求与明确委托、制作前确认记录、授权范围、集时长及用户实际限制、可自行决策与须升级的事项。请 Director 诊断现状，在 intake 充分后选择专业协作并交付相容的剧本、分镜、实际基础资产卡/图和 storyboard sheets，以及当前独立审核证据、整体连贯性判断和未决事项。资产清单属于 script；缺清单请 Scriptwriter 采用现有剧本并补齐，不重写故事。arc/outline/novel 按需要规划，不作为固定前置；系列仍应评估人物弧、铺垫回收与跨集连续性。

Director 按 descriptions 自选知识，不派发“加载并执行某 skill”的任务。嵌套实际可用时由 Director 协作；明确深度拒绝后在会话内记住限制，普通任务失败不算嵌套不可用。收到转交请求时，主 AI 按其目标角色、成果、路径、范围和约束忠实派发，将结果送回原 Director `task_id` 继续；不另排顺序、不升宿主深度。审核另开全新 Director 上下文，不继承制作历史；无独立上下文则保持阻塞。

用户待决问题由主 AI 完整呈现，未委托的选择明确询问；实际答复完整送回同一 Director 及原发起角色。候选选定须来自实际用户决定或其明确的选择委托，主 AI 不代选、不接管创作、不代写 pass。

## 交付与失败

Director 报告当前范围与证据；整集就绪用 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-episode.sh" "{ep}" "{config_path}"` 核验。exit 1 未就绪，exit 2 legacy 阻塞，均报告具体原因。缺图、审核未决或资源不足保持部分交付/阻塞；重试次数不产生通过。技术失败先检查落盘材料和任务，避免重复提交；取消即停止。

材料就绪不授权付费视频。用户另用 `/generate-video {ep}` 提交，`/check-video {ep}` 或 `/auto-video {ep}` 跟踪。成片质量由用户判断，不自动审片或合成。所有生成内容遵循 config 语言与角色版权规避规则。

## 输入

请求可混合文件参考、内联材料与修改意见；按语义识别路径，无法定位或读取先澄清，不把整句按扩展名分类。长材料向 Director 传路径及简短意图，不复制整篇。已有剧本、分镜和用户选定方向可复用，不强迫重选候选。
