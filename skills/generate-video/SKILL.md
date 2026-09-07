---
name: generate-video
description: 在用户要求提交已审核镜头、准备视频任务或询问视频生成配置时使用。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill, Task
argument-hint: "自然语言集数、镜头范围与提交要求"
model: opus
---

## 约束

用户后续手动调用本入口要求生成视频，即表达已解析范围的首次提交意图，不再询问“是否授权生成”或“开始吗”。先核对目标和实际模型/参数并保存原请求，不把 scope 核对变成重复批准。仅查看配置或准备任务的请求不提交；short/series 不自动调用本入口。首次提交不以询问自动重试/监控许可为前提，无 retry grant 不重试。新问题先查配置、材料和 grants，由 Creator/Director 在权限内处理，仅真实范围/固定设置冲突、缺必要权限或指定检查点才提问。

按共享 intake 规则复用当前已审核材料和真实授权；只读能力查询可先做。准备中若需要新设计/提示，先由 Director 确保相关需求已知或有明确角色/范围/约束委托，不由入口临时编造。仅问当前必要缺口，意外问题仅暂停受影响工作。

按选定模型/参数提交，不要求预算、费用、积分/余额或最低价检查，不为省钱降级。用户实际费用限制仍绑定，真实账号/provider 失败仍报告。constraints 不必含费用；范围、覆盖、首次/重试、inflight 和独立视频授权保持不变。

用户决策前必读 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。发起角色一次提供全部相关问题及题界/分支；主 AI 读全并内部保留计划，沿作者题界完整展示当前题全部选项/解释再原生单题询问，不用摘要或按钮替代正文、不倾倒全表。仅应用所给条件；相关原始答复及全部条件批量完整回原角色原任务，不逐题往返，提前回询仅限共享规则例外；创作事项保留 Director 协调且 relay 不压缩。

配置读取/准备/写入/evidence 前，从项目根运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`，得到 SVD_CONFIG（未设才 config.md）的 canonical 项目相对 config_path。项目内绝对路径与 ./ 可规范化；外部配置（含 symlink 越界）不支持，在副作用前报告，不自动复制。查看配置只读此路径，缺失不初始化。

每次配置相关 Bash 显式用 `SVD_CONFIG="{config_path}"`，包括 video-task-inputs 的 profile/capture/gate/reserve、review-evidence check 和生成 wrapper；需要位置配置参数的 helper 也传同一路径。所有 Task/relay、配置/approval 写入与 fingerprint 使用 config_path，不能读取默认配置后对另一文件取证。纯已登记任务取回转 checker，不运行 profile 或配置门禁。

- 新提交由真实 Creator Task 使用已接入 scripts 执行；加载 provider skill 不转移角色。禁止测试性付费调用。
- tasks.json 的准备和授权由用户交互上下文维护，每个 shot 唯一。提交状态仅由 wrapper 的 reserve/settle 写入，LLM 不重复写回。不得与提交脚本并发编辑 tasks；发现 `.submit-lock` 或 inflight 先停止准备并核实，不删除绕过。
- 预登记后 creator 不改 prompt/references/duration/submission；submitted/done 及 inflight 保护。
- 用户本次 generate-video 生成请求就是该范围首次提交依据，不需要另一条同意消息；材料就绪或 review pass 本身不是视频请求。failed 状态不产生重试或修改授权。
- 对请求范围内每条首次提交的 prepared pending，在提交前持久化 `initial_authorization:{decision,episode,shot,constraints}`：decision 保留用户实际调用/生成请求原文及必要澄清，不填通用“用户已同意”；episode/shot 为已解析范围，constraints 保留真实条件，无额外条件可为 []。该记录让机械 gate 及隔离监控延续未调用任务，不需额外确认。无生成请求不造 grant，初始 grant 不允许失败重提，retry grant 不能替代它。
- 不在首次提交前例行询问重试许可；仅用户要求自动重试，或实际失败阻塞且需用户决定时处理。按 check-video 的格式保存真实 `retry_authorization`、decision/scope/constraints；仅用户给出次数时写 max_attempts/attempts，不从生成请求推断无限重试。拒绝/无 grant 不重试，不阻止首次提交。监控同样仅用户要求或已有同意默认才启动。
- 重跑准备不得重置已有 grant 的次数；输入/范围变化时不自动继承旧 grant，先核对真实授权是否明确覆盖该变化及重准备/重提，未覆盖才取得新决定。原输入重试许可不授权改输入。符合授权时按当前目标保留真实决定与剩余限制，不伪造新许可。submitted/done 保持保护，撤销授权可单独清除 grant，不改输入或状态。

## 系列继承与单集规格

任何准备写入（含 converter 字段、状态、grant）前，先运行只读命令：

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/video-task-inputs.mjs" profile "story/episodes/{ep}/videos/tasks.json"
```

使用实际 `SVD_CONFIG` 或 `config.md` 检测 mode、读取固定值与参数选择授权；目标 tasks/目录尚不存在也可检查，不创建文件。非零停止，不改记录、不付费。JSON 返回 `{mode,profile,source}`：series 的 source=`tasks` 表示继承完整四元组，source=`config` 表示首次选择，profile 中 null 字段仅限已有明确 video delegation，须由 Creator 在授权内解析；short 返回 profile=null、source=`episode`，仍须核对整集 ratio/resolution。

series 全系列所有集共用 `provider/model/ratio/resolution`。扫描所有 canonical `story/episodes/epNN/videos/tasks.json`，不限前集或本次 shots；一致的已准备快照优先，即使尚无前集任务，也继承其他集或本任务已有快照。包含 prepared pending、submitted/done/failed 和 inflight；只忽略无 submission、无 submit_id、无 inflight 的全新 pending。任何历史四元组缺失或冲突阻止新准备/付费，不阻止查询下载，不能猜默认、补造历史或删除快照重新选型。sole pending 自身快照也绑定，不能借重准备换型。

继承仅限四项设置，不继承 duration、prompt、images/refs 或 grants。无任何快照时才从实际固定配置和明确委托解析；固定配置与继承冲突或 provider=none 时停止，不静默覆盖。按系列串行执行 profile 检查、准备写入和提交，不并发准备不同集；现有 episode `.submit-lock` 不是跨集事务，不保证跨集原子更新。

short 模式保留同一集全部镜头共用 `resolution + ratio`，不设逐镜头清晰度。Creator 读取整集 tasks（不限本次 shots），在明确委托范围解析公共规格，固定值仍绑定；已有 pending/submitted/done/failed 的 submission 约束新任务。仅 short 不要求 provider/model 逐镜头相等，所选能力仍须支持公共规格。

short 准备写入前核对整集；历史缺少 ratio/resolution 时阻止新生成，不猜测或补造，查询下载不受影响。仅 short 获准重准备的 pending 可在不与其他任务冲突时换规格；保护任务不可改写。capture 与 gate/reserve 在本集 `.submit-lock` 内按 mode 复核整集或全系列，拒绝时不写 tasks、不消耗重试次数、不调用提供方。capture 只返回快照，reserve 在付费前再次核对，但不建立全系列锁。

这些参数保证请求的分辨率档位与比例一致，不保证精确像素几何或主观清晰度；不自动转码、缩放或转换，不增加 codec/AI 质量审核。

## 流程

单次请求上下文仅为最终 prompt 与实际 typed references，遵循共享 visual-prompt-craft-common/video 和必读 [shot-inputs](../_meta/rules/shot-inputs.md)。准备时核对转换结果，不以读过剧本补齐模型缺口；创作缺口交 Director/Storyboarder，入口忠实保存。

作品级美术基线由 Creator 交 Storyboarder，在源 shot 的 `视频风格` 中每请求表达一次；详细动作、表情和声音在视听正文表达。Reference use 仅描述控制用途与占位边界。转换器绑定引用、保留完整 shot，不注入风格或清理重复；入口不改写已审核 prompt。

准备使用每镜 `{references}` manifest 和 converter `--json`，返回 `prompt,duration,references,assetCards,sources,inputPath`。header 身份图先按声明去重，后接有序本地 PNG/MP4，每镜至少一个 MP4；图片/视频独立编号，sources 不上传。固定相机可用静态 clip。prompt 保留 heading、七字段、声音、完整 prose/时间码，只绑定已声明路径；GIF 不支持，必要时序无法核实为 unknown。

结构边界仍为 shot heading 后的下一个 ATX heading、独立 `---`、行首 HTML comment 或 EOF。作者将下一场景/预算及尾部制作说明放在这些边界外；转换器不删除 shot 内的任何本地文字或作语义过滤，隐含依赖与混入备注由作者/reviewer 判断。

付费 gate 比较 converter 的 prompt/references/duration，要求 typed references 与本地 MP4。输入差异阻止提交，恢复/重试不静默刷新；submitted 按已登记 ID/provider 取回，submitted/done/inflight 保护不变。

以下准备依赖只适用于获准的新/重新准备任务。任何 tasks 写入前完成目标与授权核对、只读 profile 预检，并把结果与实际 config 路径委托 Creator；source=tasks 时只验证继承设置的能力，不重新选择。能力诊断先于 capture 和付费，不是写完任务后再选。已有 prepared/pending 续交或 failed 原输入重试只验证持久设置，不重新 resolve/capture。实际配置用 SVD_CONFIG 或 config.md；提供方 none 阻止新提交，不阻止查询。

1. 整体理解原始请求 `$ARGUMENTS` 和会话中的集数、镜头、文件参考与提交意图。查看配置只 Read 实际配置（SVD_CONFIG 或 config.md），缺失不初始化。写入/付费前确定 canonical ep 与 exact shots；只有明确全范围才选全部，遗漏或歧义先澄清，不默认 latest/all。读取对应 config/storyboard；路径或审核通过不等于付费授权。
2. 按真实状态区分准备/提交与取回，submitted 缺 ID 或 inflight 未决先人工核实。下述完整就绪检查包含结构检查；只诊断结构时可单独运行 `check-shot-inputs.mjs EP [SHOT...]`。
3. 以严格 heading `### shot N` 精确匹配所选镜头。已提供编号须有序且唯一；整集要求连续 1..N，局部选择允许未提供的编号间隔，每个请求目标须准确存在。
4. 确认目标 manifest 已由 Creator 在授权内组装，最终包已有独立 shot-input 审核。执行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check "{ep}" {shot numbers}`，非零停止并报告，不自动重生。通过后调用 `storyboard-to-prompt.sh --json "{storyboard}" "{shot}"`，失败不写半成品；原样保存 `prompt,duration,references`，不把 resolver 元数据塞进上传数组。
5. 核对每项本地 reference 和 sources 的真实路径，每镜至少一个 MP4，可辅以 PNG，sources 只作审核输入。最终就绪要求 script/storyboard/asset-visual/shot-input；新生图另须 asset-prompt。独立 reviewer 依据故事检查必要边界配对，入口不把机械就绪当作穷尽连续性证明。
6. 预登记到 `story/episodes/{ep}/videos/tasks.json`：
   - 为请求内首次提交的 prepared pending 按上述格式登记实际请求的 initial_authorization；与 capture 得到的 submission 一起在提交前保存。不得省略 grant 而指望 wrapper 从聊天推断许可，也不为已有 protected 或范围外任务造记录。
   - 不存在：新增 `{shot,submit_id:"",status:"pending",prompt,references,duration,fail_reason:""}`。
     - `pending`：仅在无 inflight 且授权准备范围内刷新 converter 输入字段；单纯恢复保留已有字段与 submission。
    - `failed`：默认完整保留；仅真实授权重准备、接受当前材料且授权重提时才刷新输入并改 pending，不静默刷新失败输入。
    - `submitted` / `done` 或任何 inflight：完全保护，不刷新、不自动重提；若 converter 已变化只输出人工处理警告。不得将 unresolved intent 改 pending 来重新准备。
7. 使用真实 Creator 已验证的设置，series 四元组共用，short ratio/resolution 整集共用；验证 operation/duration/references，缺口先交责任角色。获准 pending 执行 `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/video-task-inputs.mjs" capture "{tasks}" "{shot}" "{provider}" "{model}" "{ratio}" "{resolution}"`。把真实返回的 `{provider,model,ratio,resolution,references:[{media,path,sha256}]}` 存入 submission；helper 只返回、不写 tasks，sources 不在 submission。失败不提交；写前重读保护锁/inflight/submitted/done。
8. 按 storyboard 原顺序把已 capture 的授权 pending 委托真实 Creator Task：传预期提交成果、tasks/材料路径、exact shots、实际 grants 和约束。Creator 自选 provider 知识，只用已存 submission，不重选或改输入。嵌套不可用则返回 role/outcome/references/scope/constraints 给主 AI；主 AI 派 sibling Creator 后恢复同一入口 task_id。无角色上下文则阻塞，不由入口冒充 Creator。
9. 只有明确请求或已同意的监控默认才进入 auto-video，传 resolved target 与 unattended 意图及间隔；否则返回提交结果，不自动装监控。监控同意不创建重试授权。

`视频提供方` 为 none 时不提交，可询问配置或取消；已有任务仍可取回。固定配置绑定其范围，缺值不授权选择，任务选择不改项目默认。重试/恢复已有 prepared 记录不重新 resolve/capture。最终报告新增、刷新、保护、提交、失败与未决项。

Converter 的执行字段为 prompt/references/duration；准备及所有付费尝试使用 typed references 和 `--references-json`，每镜至少一个本地 MP4。submitted 按 recorded ID/provider 取回，保留真实状态与授权。接口不满足契约时报告工程阻塞。
