---
name: short-video
description: 在开始单集短视频、提供现有故事材料或用 /short-video config 查看配置时使用。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
argument-hint: "自然语言目标、材料或配置请求"
---

## 委托入口

交付采用 [shot-inputs](../_meta/rules/shot-inputs.md)：Creator 设计后将连续摄影 shots 装组，保留时长/对白/切点，`task-inputs/taskNN.json` 恰为 `{shots,references}`，独立 task_id 来自文件名，每生成任务至少一个全组 MP4，可辅 PNG；header 身份图在前，sources 不上传，静态段可用 clip。独立 shot-input target 为 task manifest，审核最终集成/delta、内部切点/声音桥及必要边界，无冲突复用 storyboard 判断。就绪要求 script/storyboard/asset-visual/shot-input，asset-prompt 仅覆盖授权新增/重生集合。选镜须完整组，部分组报告完整成员/额外镜头，不扩授权；图片/视频授权边界保持。

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。原角色一次给齐全部可预见相关问题/表、题界、完整选项/解释、稳定标签及条件分支。主 AI 读全并内部保留计划，仅沿作者题界展示当前题全部内容，再用可用原生键盘选择器，questions 恰好一项。等回答再问下一适用题，相关原始答复及全部条件经 Director 批量完整回原角色原任务，不逐题往返；仅缺内容/映射、不相容或计划外新决定才提前回询。只应用作者条件，不有损改写、不提前展示全表；长解释在控件前，Markdown 不替代可用控件，宿主限制明确披露。

主 AI 在当前上下文用 Skill 加载 `director-orchestrate`，作为生产 Director 直接处理配置、输入、用户决策、创作和专业协作。目标恒为 mode=`short`、ep=`ep01`。制作请求包含所需新增基础资产图和本地参考，intake/当前审核满足后执行，不另问生图授权。配置查看/纯诊断仍只读；范围外覆盖、固定设置冲突或受保护任务仍须处理。本流程始终停在付费视频提交前；只有用户后续手动调用 generate-video 才提交视频。

## 配置与输入

制作启动按 [项目启动环境检查](../director-orchestrate/SKILL.md#项目启动环境检查)，由 Director 尽早协调 Creator 一次，在本地资产/参考工作前确认环境；无依赖的创意 intake 与文字创作可并行，后续复用当前机器的有效 handoff，仅按变化/失败定向补验。纯配置调用免检查、不初始化、不试渲染，查看仍只读。

尽早逐题明确可预见的关键选择与委托余地，不合并问卷或追问尚不可知的艺术细节。原请求已授权且相关 intake 充分即开始，无额外“开始吗”。随后按共享规则连续执行，Director 先用现有材料/配置/grants 和专业判断处理问题，范围内修复与独立审核不需逐轮用户批准；仅真实缺权限、关键冲突或用户指定检查点才询问，进度只作陈述。

具体创作前完成与当前材料相关的 intake，复用用户/配置/已有材料与实际角色/范围/约束委托，不以沉默或模板代替。剧情未指定但主题、前提或期待体验足够时，Director 默认发展三个完整故事候选，每个有动机、冲突、推进和结局；明确数量优先，已有剧本/选定方向/委托直接复用。剧情选择不是候选探索前置，无关技术设置不阻塞探索；不能先问“谁决定”或只给类型标签。主 AI 全文展示三个候选后单题选择，加“Director 决定”（按宿主限制映射）。正式剧本/资产等相关选择已知或委托后才制作。只读诊断可先做，后续材料批准与 intake 分开；意外问题仅暂停受影响工作。

初始化和后续角色创作按设置使用相应模型/参数，不必询问预算、费用、积分或余额，不做强制 affordability/最低价检查，不为省钱降级。用户明确限制仍有效，实际账号/provider 失败如实报告；范围、覆盖、重试及视频单独授权仍须遵守。

配置读取/写入/evidence 前，从项目根执行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，把 SVD_CONFIG（未设才 config.md）规范为项目相对 config_path。项目内绝对路径、./ 可接受，外部配置（含 symlink 越界）明确不支持，在副作用前报告并停止。缺失的项目内路径仍可只读报告或获准初始化；不因缺失换回默认。

后文所有配置/批准记录仅用 config_path。Task/relay 传同一路径；每次配置相关 Bash 显式设置 `SVD_CONFIG="{config_path}"`，detect-mode 传该路径，read-config 在键名后传该路径。fingerprint、videoProfile 与 evidence 共用 canonical config_path，不依赖跨工具环境持久化。

整体理解原始请求 `$ARGUMENTS` 和会话：区分查看/修改配置、内联故事、文件参考与制作意图，不按首 token 或文件后缀解析整句。文件和意见可混合；路径不清或读取失败先澄清，不能当内联故事继续。

查看配置只 Read 实际配置（SVD_CONFIG 或 config.md）并展示；缺失就报告，不补 mode、建文件或强制设置。修改配置需要明确范围。制作前确认 short/ep01；其他集数或冲突请求先澄清，不能忽略。已有材料交 Director 判断复用，不默认覆盖。

获准初始化时参考 [config-template.md](config-template.md) 确认 mode=short、总集数=1 和实际选择后写 config_path；已有冲突值不覆盖。运行 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-mode.sh" "{config_path}"` 验证模式，失败停止。写入或生成前先解析 canonical 目标、意图和授权。

## 集总时长

唯一一集的总时长由用户在开始时决定。结合本次请求读取 `SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "{config_path}"`；用户已给出的目标或明确配置直接复用，不重复询问。两处均缺失、空白或仅有未经确认的模板值时，正式制作前先询问目标时长或范围，不能默用 1-2 分钟；冲突先澄清。

初次设置单值时说明并确认原始目标的 ±10% 创作预算及秒数边界，供 owner 主动安排揭示、倾听和反应，不只是完稿容错；精确值按相等上下界，严格限制优先，显式范围不扩大。主 AI 保存用户原始目标及确认边界，修改后的合计不成为新基准。按 [集总时长责任](../director-orchestrate/SKILL.md#集总时长责任) 协调更新 canonical script/storyboard 和受影响下游，范围内不逐次求许可。摄影 shot 按叙事分配正整数秒，不受 provider 最短或 70% 任务目标约束。Creator 装组保留当前源时长/对白/切点，冲突交 owner 重设计而非装组偷加秒。查看配置不触发设置。

## Provider 配置

配置能力问题用真实 Task 委托 Creator，提供操作、固定/继承值、scope、约束与 grants。按共享 Concrete Technical Choices 给齐 images/video 未决 provider -> model -> 相容 ratio -> resolution，含当前已接入值、完整解释、逐字段委托选项及明确分支。主 AI 只依作者条件逐题完整展示并原生单选，相关原始答复/条件批量回 Creator；委托模型需专家解析且无后续分支时先回询。按 scope 跳过已答/固定/继承/已委托项，不隐藏选项、不把横屏当数值比例。按 template 保存真实选择与 `参数选择授权`，不存静态模型表；能力诊断只读，任务选择不改默认。

用户选定模型即按可访问处理，不查权益/会员/凭据/账号/积分、不索证明或要求确认访问不确定性声明；仍核验当前 CLI/API 技术组合与接入。仅授权执行实际返回账号/provider 错误时报告并处理必要决定，不换固定模型，不声称访问已验证或生成成功；视频仍不得在本入口提交。

## 制作前确认

仅当用户要求先看 outline 或 arc，主 AI 在实际配置的 `## 制作前确认 ep01` 段写一个 JSON 块：

```json
{"episode":"ep01","required":["outline"],"approval":null}
```

required 仅列用户所需 outline/arc，对应本集 outline.md 和 `story/arc.md`。无请求不新建记录，已有记录不可静默清除；未知类型按 [制作前确认](../director-orchestrate/SKILL.md#来源与制作前确认) 报告并阻塞，不过滤或自动批准。Director 先交准备材料并暂停正式制作。

主 AI 用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...` 取得材料身份，呈现材料并明确询问批准。确认后复核输入未变，将 approval 写为 `{"decision":"用户实际确认内容","inputs":[实际 path/sha256 对]}`；缺失、空白、未批准或已变化均阻塞，变化后重新确认。不得以审核通过代替用户批准。

## 成果委托与转交

用户小说、章节和节选按实际路径交 Scriptwriter 改编，保留采用范围与指定内容，源文保持原样。

主 AI 直接统筹 short/ep01，保留成果、config/材料路径、用户原意、已知需求与委托、制作前确认、图像授权、集时长与限制、决策余地及升级条件。按成果委托专家，交付相容剧本、分镜、基础资产卡/图、生成 task manifest/完整 shots 与媒体、独立证据、必要连续性判断和未决项；生成 task_id 与代理任务 ID 分开。缺 script 清单由 Scriptwriter 接纳剧本补齐；规划按需采用。

Director 与专家按 descriptions 自选知识，委托说明成果而非技能链。专家/审核协调者可嵌套时直接委派；工具不可用或明确深度拒绝后复用已知限制，普通失败不算。主 AI 忠实转交角色、成果、路径、范围与约束，并恢复原专家、审核协调者或 checker 任务传回实际结果，不调高深度。审核用全新 Reviewer 上下文，不继承制作历史；后续视觉操作仍新 task。必要角色或隔离不可用则阻塞。

主 AI 可编写自己的完整剧情候选并直接呈现，未委托的选择询问用户；已有选择委托由责任角色在范围内决定。自编计划的完整答复本地保留；专家计划及相关原始答复/条件完整批量回原发起任务，不做主 AI 自我 relay。

## 交付与失败

整集交付用 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" ep01` 及同配置 `review-evidence.mjs check ep01` 核验；非零报告未就绪或运行阻塞。缺媒体、审核未决或资源不足是部分交付；重试次数不产生 pass。部分交付/进度不结束原授权委托：仍有可执行、可恢复或待返回工作时，按 Director 的等待/恢复契约继续，补齐资产、本地参考、装组与独立审核，不再问“继续吗”。正常终点是本集制作材料完整且当前审核就绪、尚未付费视频提交，不是资产图像已提交。真实决策/权限缺口、不可恢复错误或必要工具不可用仅暂停受影响工作并说明阻塞；先查存活材料与任务，避免重复提交；取消即停止。

素材创作不授权付费视频。用户另用 `/generate-video ep01` 提交，`/check-video ep01` 或 `/auto-video ep01` 跟踪；成片质量由用户判断，不自动审片或合成。遵循 config 语言和角色版权规避规则。
