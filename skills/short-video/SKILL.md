---
name: short-video
description: 在开始单集短视频、提供现有故事材料或用 /short-video config 查看配置时使用。
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
argument-hint: "自然语言目标、材料或配置请求"
---

## 委托入口

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。原角色一次给齐全部可预见相关问题/表、题界、完整选项/解释、稳定标签及条件分支。主 AI 读全并内部保留计划，仅沿作者题界展示当前题全部内容，再用可用原生键盘选择器，questions 恰好一项。等回答再问下一适用题，相关原始答复及全部条件经 Director 批量完整回原角色原任务，不逐题往返；仅缺内容/映射、不相容或计划外新决定才提前回询。只应用作者条件，不有损改写、不提前展示全表；长解释在控件前，Markdown 不替代可用控件，宿主限制明确披露。

主 AI 处理配置、输入和用户决策；Director 拥有创作与专业协作。目标恒为 mode=`short`、ep=`ep01`。用户的制作请求本身包含所需新增基础资产图和分镜板图片，intake/当前审核满足后直接生成，不再询问生图授权。配置查看/纯诊断仍只读；范围外覆盖、固定设置冲突或受保护任务仍须处理。本流程始终停止在视频生成之前，即使全部审核完成；只有用户后续手动调用 generate-video 才提交视频。

## 配置与输入

尽早逐题明确可预见的关键选择与委托余地，不合并问卷或追问尚不可知的艺术细节。原请求已授权且相关 intake 充分即开始，无额外“开始吗”。随后按共享规则连续执行，Director 先用现有材料/配置/grants 和专业判断处理问题，范围内修复与独立审核不需逐轮用户批准；仅真实缺权限、关键冲突或用户指定检查点才询问，进度只作陈述。

具体创作前完成与当前材料相关的 intake，复用用户/配置/已有材料与实际角色/范围/约束委托，不以沉默或模板代替。剧情未指定但主题、前提或期待体验足够时，Director 默认发展三个完整故事候选，每个有动机、冲突、推进和结局；明确数量优先，已有剧本/选定方向/委托直接复用。剧情选择不是候选探索前置，无关技术设置不阻塞探索；不能先问“谁决定”或只给类型标签。主 AI 全文展示三个候选后单题选择，加“Director 决定”（按宿主限制映射）。正式剧本/资产等相关选择已知或委托后才制作。只读诊断可先做，后续材料批准与 intake 分开；意外问题仅暂停受影响工作。

初始化和后续角色创作按设置使用相应模型/参数，不必询问预算、费用、积分或余额，不做强制 affordability/最低价检查，不为省钱降级。用户明确限制仍有效，实际账号/provider 失败如实报告；范围、覆盖、重试及视频单独授权仍须遵守。

配置读取/写入/evidence 前，从项目根执行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，把 SVD_CONFIG（未设才 config.md）规范为项目相对 config_path。项目内绝对路径、./ 可接受，外部配置（含 symlink 越界）明确不支持，在副作用前报告并停止。缺失的项目内路径仍可只读报告或获准初始化；不因缺失换回默认。

后文所有配置/批准记录仅用 config_path。Task/relay 传同一路径；每次 Bash 显式设置 `SVD_CONFIG="{config_path}"`，detect-mode 传该路径，read-config 在键名后传该路径，check-episode 在 ep 后传该路径。fingerprint 仅用 canonical config_path；videoProfile 与 evidence 共用它，不依赖跨工具环境持久化。

整体理解原始请求 `$ARGUMENTS` 和会话：区分查看/修改配置、内联故事、文件参考与制作意图，不按首 token 或文件后缀解析整句。文件和意见可混合；路径不清或读取失败先澄清，不能当内联故事继续。

查看配置只 Read 实际配置（SVD_CONFIG 或 config.md）并展示；缺失就报告，不补 mode、建文件或强制设置。修改配置需要明确范围。制作前确认 short/ep01；其他集数或冲突请求先澄清，不能忽略。已有材料交 Director 判断复用，不默认覆盖或强迫补小说。

获准初始化时参考 [config-template.md](config-template.md) 确认 mode=short、总集数=1 和实际选择后写 config_path；已有冲突值不覆盖。运行 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh" "{config_path}"` 验证模式，失败停止。写入或生成前先解析 canonical 目标、意图和授权。

## 集总时长

唯一一集的总时长由用户在开始时决定。结合本次请求读取 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "{config_path}"`；用户已给出的目标或明确配置直接复用，不重复询问。两处均缺失、空白或仅有未经确认的模板值时，正式制作前先询问目标时长或范围，不能默用 1-2 分钟；冲突先澄清。

初次设置单值时向用户说明并确认现有 scene-duration 的 ±10% 容差及对应秒数边界；更严格的用户限制优先，精确时长按上下界相等处理。显式范围直接使用上下界，不再扩大。将实际目标及确认的容差/严格边界保存到实际配置，随委托传给 Director。单镜头可在 provider/项目约束内灵活分配，但合计须符合本集预算；参数选择授权不允许 Creator 改集目标。冲突或内容装不下交 Director 提修改方案，需改目标则询问用户，不自动拉长。查看配置不触发本设置。

## Provider 配置

配置能力问题用真实 Task 委托 Creator，给出操作、固定/继承值、作用域、约束与 grants。按共享 Concrete Technical Choices，一次提供 images/video/sheets 各 scope 的全部未决问题：provider -> model -> 相容 ratio -> resolution，含已接入且当前支持的具体值、完整解释、“此字段交 Creator 决定”及明确相容分支。主 AI 仅依作者条件逐题展示当前全部选项并原生单选，相关原始答复/条件批量回 Creator；不推断 provider 知识。若委托模型须 Creator 先解析且无后续分支，才提前回询再问依赖项。不以笼统“技术交团队”替代具体选择，不因用户不懂隐藏选项；已答/固定/继承/已委托项按 scope 跳过，sheet 继承和授权覆盖分清，横屏不擅定数值比例。按 template 保存实际选择与 `参数选择授权`，不维护静态模型表或示例默认；能力诊断不提交或改配置，任务选择不改项目默认。

用户选定模型即按可访问处理，不查权益/会员/凭据/账号/积分、不索证明或要求确认访问不确定性声明；仍核验当前 CLI/API 技术组合与接入。仅授权执行实际返回账号/provider 错误时报告并处理必要决定，不换固定模型，不声称访问已验证或生成成功；视频仍不得在本入口提交。

## 制作前确认

仅当用户要求先看 outline、novel 或 arc，主 AI 在实际配置的 `## 制作前确认 ep01` 段写一个 JSON 块：

```json
{"episode":"ep01","required":["outline"],"approval":null}
```

required 仅列用户所需材料，对应本集 outline.md、novel.md 和 `story/arc.md`。无请求不新建记录，已有记录不可静默清除。Director 先交准备材料并暂停正式制作。

主 AI 用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...` 取得材料身份，呈现材料并明确询问批准。确认后复核输入未变，将 approval 写为 `{"decision":"用户实际确认内容","inputs":[实际 path/sha256 对]}`；缺失、空白、未批准或已变化均阻塞，变化后重新确认。不得以审核通过代替用户批准。

## 成果委托与转交

用 Task 派发 `director` 并保留原始 `task_id`。说明 short/ep01、预期成果、config/材料路径、用户原意、intake 已知需求与明确委托、制作前确认、图像授权、集时长及用户实际限制、决策余地和升级条件。请其诊断并在 intake 充分后交付相容的剧本、分镜、实际基础资产卡/图片及 storyboard sheets，当前独立审核证据、整体连贯性判断与未决事项。script 拥有资产清单，缺清单由 Scriptwriter 采用现有剧本补齐，不重写故事；规划材料按用途选择，不是固定前置。

Director 从 descriptions 自选知识；委托不是“加载并执行某 skill”。嵌套实际可用时由 Director 委派；明确深度拒绝后在本会话记住限制，普通失败不当作不可嵌套。需主 AI 转交时，忠实按请求的角色、成果、材料路径、范围和约束派发，将结果送回原 Director `task_id`。不另排创作顺序、不调高深度、不接管创作。审核另开全新 Director 上下文，不继承制作历史；独立上下文不可用则阻塞。

待决问题或剧情候选由主 AI 完整呈现；未委托的选择明确询问用户，不代选。已有明确选择委托由责任角色在范围内决定；实际答复完整送回同一 Director 及原发起角色。

## 交付与失败

整集交付用 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-episode.sh" ep01 "{config_path}"` 核验；exit 1 未就绪、exit 2 legacy 阻塞，报告原因而非补跑固定链。缺图、审核未决或资源不足是部分交付/阻塞，重试次数不产生 pass。技术失败先查存活材料与任务，避免重复提交；取消即停止。

素材创作不授权付费视频。用户另用 `/generate-video ep01` 提交，`/check-video ep01` 或 `/auto-video ep01` 跟踪；成片质量由用户判断，不自动审片或合成。遵循 config 语言和角色版权规避规则。
