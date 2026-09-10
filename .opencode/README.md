# ShortVideoDirector OpenCode 适配

插件从 `agents/*.md` 动态加载四个子代理，从 `skills/*/SKILL.md` 发现技能并转换到 `~/.cache/short-video-director/<hash>/`。制作主 AI 就是 Director，本地加载 director-orchestrate 并直接协调创作；Reviewer 在全新上下文独立验收。Skill 是知识，不是任务调度或隔离。工程主 AI 委托工程代理研究、实现与测试。

## 安装与加载

在 `~/.config/opencode/opencode.json` 选择一个安装来源，避免重复加载：

```json
{"$schema":"https://opencode.ai/config.json","plugin":["short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"]}
```

本地开发可将 plugin 值改为 `file:///absolute/path/to/ShortVideoDirector`。在仓库内启动时也可由宿主扫描 `.opencode/plugin/*.js`，但不使插件自动全局可见。卸载移除对应配置，保留故事项目。

需要 Bash、Node.js、Python 3；图像 helper 需 Pillow，本地媒体按方法需 Blender/FFmpeg，付费生成需 Dreamina CLI。安装/升级须授权。

源码不是热加载。退出重启 OpenCode 后核对：

```bash
opencode agent list
opencode debug skill
```

应发现 creator/reviewer/scriptwriter/storyboarder 四个专家、内部 director-orchestrate、creator-local-reference 和 reviewer-review-shot-inputs，以及七个入口 series-video、short-video、edit-story、repair-story、generate-video、check-video、auto-video。九个 reviewer-review-* 技能由独立 Reviewer 使用；director-* 规划知识由制作主 AI 本地使用。列表应与当前源集合一致。发现名称不证明嵌套、知识加载或审核隔离实际可用。

Commands 原样传 `$ARGUMENTS`，不拆位置参数。入口整体理解目标、路径和范围；歧义不默认 latest/all。配置查看只读，缺失不初始化。

故事文件按 [项目布局](../skills/_meta/rules/project-layout.md) 选择路径：保留 canonical 单集材料、共享资产、references 与工具记账；候选用 `story/planning/plot-options.md`，临时交接用 scoped `story/work/`。委托前指定精确输出路径，简单任务可只回文本；按需建文件，不迁移现有项目或复制状态账本。

## 当前制作契约

见 [shot-inputs](../skills/_meta/rules/shot-inputs.md)：摄影 shot 保留七字段/正整数秒，不受 provider 最短/70% 目标约束。Creator 设计后装组连续 shots，以核实模型最大 M 的 `ceil(0.7*M)..M` 为语义目标而非机械下限，保留当前 canonical 时长/对白/切点。需重设计交 Director 协调 owner 主动使用用户原始集目标已确认的 ±10% 创作预算，同步源及受影响下游，范围内不逐次求许可，基准不滚动，精确要求优先。`task-inputs/taskNN.json` 恰为 `{shots,references}`，文件名给稳定 task_id，每任务至少一个全组本地 MP4，条目仅 local PNG/MP4，静态段可用静态 clip。身份图首次使用求并集在前；BOX 控制相机/布局/整体轨迹，sources 不上传。

相同单行视频风格字段在任务级输出一次，仅从成员移除此字段；差异交 owner，其他字段/对白/prose/空格/续行保留。只重基行首结构 bracket cues，内联经过时间明确仍属具名 shot 本地时间；每镜链接须自身 header 声明。Creator 统一参考时钟、内部切点/声音桥。Converter 返回 task_id/shots/timeline/prompt/duration/references/assetCards/sources/inputPath，时间派生，无可编辑 offset/duration 或装组索引。

tasks.json 数组按 task_id 唯一，保存 shots/prompt/duration/references，输出 videos/taskNN.mp4；submission 四元组/媒体指纹不变。Grants 为 `{decision,episode,task_id,shots,constraints}` 加真实可选次数；manifest/record/grant 成员一致才 reserve，漂移、错误身份或部分选组零调用、不改次数。

Creator 在 local-reference 内用粗 BOX 相机/调度及可选假音频估时试排。持有、支撑或动作否则不可读/悬浮时，在本地授权内补最小手/前臂、相关肢体或接触代理，不限身体出画；默认不做完整 rig、精细手指、脸部动画或 TTS/表演验收。缺手指不是失败，缺必要支撑与动作冲突则需修正；悬浮/透明屏幕按意图判断。源码与媒体在故事项目 references/，内部标注/假音频默认不上传，不引入固定 DSL 或新门禁。基础卡可选本地 PNG/sources，见 [卡片契约](../skills/_meta/rules/local-reference.md) 与 [工具示例](../skills/creator-local-reference/tools.md)。

粗参考需完整 shot prose：谁做什么、必要身体/头部/道具朝向与姿态、左右、归属、握持/接触及初中末变化，按动作选择细节，不设全字段配额。use 声明代理控制而非最终风格；最终 prompt 解释实际肢体代理的解剖、姿态、握向与动作。

独立生成 TASK 边界优先已有、有动机的明显机位/视点/景别切换，减少近似独立生成不一致的显眼程度，不保证连续性；相似连续镜头可同组。不要求每切一任务或角度阈值，保留有意重复构图、连续成员、时长、provider 最大值和 grants。源重设计交 Director/owner 在原始预算内同步，不静默重组受保护任务或改切点。

检查入口为 `scripts/check-shot-inputs.mjs EP [SHOT...]`，配合 review-evidence check。五类 evidence 保留 script/storyboard/asset-prompt/asset-visual/shot-input；最终就绪不含 asset-prompt，新生图另须它。整集源 1..N 且每镜分配一次，任务按首成员排序；局部允许源缺号、目标存在且选完整组。全局检查组重叠/缺失源成员，局部不要求未选媒体或全片计划。未分配/部分组报告完整成员及额外镜头，不静默扩授权。接口不相容交工程。

shot-input target 为 task manifest；审核最终集成/delta、参考时钟、内部切点/声音桥及必要外部边界，无具体冲突复用 storyboard 判断。比较位置、轨迹、状态、轴线与身份，实际依赖入 inputs，不附全计划哈希。源码/记账变化且媒体未变可独立 scoped 兼容性评估，有依据续签，不盲刷哈希或自动全量重审；看图仍新 task、缩略图优先。缺必要证据 unknown。

short/series 含资产图与本地参考，停在付费视频提交前；后续手动 generate-video 建立真实 initial grant。submitted 按 recorded ID/provider 取回，缺 ID 人工核实并保留状态。None 禁新提交而非取回；保留 fixed settings、pending/receipt、grants、locks 和 inflight。

Converter 的 `.sh` 与 `.mjs` 均使用 `--json STORYBOARD TASK_ID EP`；显式 EP 与 storyboard 路径一致，生成 task_id 独立于首镜和宿主代理任务 ID。

## 运行时适配

| 位置 | 职责 |
| --- | --- |
| plugin/index.js | 注册 cache skills、角色和 commands，保留用户同名 command |
| lib/load-agents.js | 角色工具权限与 model inherit |
| lib/transform-skills.js | 转换元数据、路径与知识引用，复制辅助资源 |
| lib/tool-mapping.js | 角色转交、用户决策、当前契约和分段约束 |
| lib/bootstrap.js | 动态角色/入口导览与幂等 bootstrap |
| lib/write-guard.js | 单次字符串参数最多 2000 字符 |

`${CLAUDE_PLUGIN_ROOT}/skills/` 转为 cache 路径，其他插件路径指向安装根；shell.env 提供根变量。故事 config/assets/references/story 仍相对故事项目。Cache 输入含源 skills/agents/scripts、OC overrides/lib 与版本；重启才加载更新，不改现有会话。

每次视觉操作按 [visual-context](../skills/_meta/rules/visual-context.md) 使用新 task、helper 缩略图与必要 crop，只 Read 返回 preview，原图用于 provider/指纹。独立 Reviewer 并行写各自 canonical target 文件；同一 ep/kind/target 重审串行。相干纯文本批次逐目标分别落盘，范围协调依据实际完成摘要或既有记录统计结果，不另设共享账本或汇总验收。审核者只写受托 canonical 记录及指定临时 state/payload/预览，生产者不编造 pass。规划按需采用；工具 allow 不等于付费/覆盖许可。

Director 可直接编写完整剧情候选与计划，逐题展示并保留真实答复，无自我 relay。专家决策包保留全部标签、背景、选项与条件，完整展示当前题后原生 question 单选，完整原答复批量回原专家任务。专家/审核协调者可嵌套时直接委派；工具不可用或明确深度拒绝后复用结论，主 AI 忠实 relay 并恢复原专家、审核协调者或 checker，传回实际结果。普通失败不算深度拒绝，不自审或改深度；后续视觉操作仍新 task。

五种 runtime 审核按 [共享规约](../skills/_meta/rules/review-meta-rules.md) 默认使用 review-round，指定 `/tmp/opencode/<task>` 目录须先存在，STATE/payload 为其中不同绝对路径。在故事项目根运行：

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" start KIND EP TARGET STATE [EXTRA_INPUT...]
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" add-input STATE PATH...
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" finish STATE PAYLOAD.json
```

start 在阅读制作材料前绑定显式配置和首次哈希；新语义参考先 add-input 再读。Reviewer 写指定临时 payload `{commentary,result:{status,blockers,...}}`，helper 注入 target/inputs、复核并验证 canonical 记录，不手填哈希 JSON。采集/发现错误保留，漂移保留首次哈希且 finish 记 unknown；缺显式 status 的 payload 无效。允许受托 canonical 记录和指定临时 state/payload/预览，不在工作区复制账本。可选规划 Markdown 不使用此 helper。

finish exit 0 仅表示记录写入；返回实际 path/round/status/input_count/evidence_issues 和必要意见即可，正常完成不要求立即重复 fingerprint、check-target 或全文 Read，错误/诊断按需查，下游 gates 不变。局部视觉 delegate 由独立 owner 在委托读取前采集必要参考，返回实际观察/路径/限制；新参考先采集再交 fresh task，不以后采快照追认，不需 import registry。独立语义判断、逐 target 并行、全新视觉上下文及缩略图保持不变。

## 自动监控

[auto-video override](skill-overrides/auto-video/SKILL.md) 仅在用户要求或已同意默认时启动 nohup loop，通过 OpenCode HTTP session/prompt_async 委托 checker。需要带 --port 的 session：

```bash
opencode --port 4096 -s YOUR_SESSION_ID
```

目标仅 epNN/all，部分镜头须确认边界，不静默扩大。间隔建议 1200 秒，最少 60 秒；按 target/SID 管理 PID、日志和 prompt 文件，避免重复。先执行一次隔离检查，无需继续或不可恢复错误则不安装 loop。端口/session/health 和停止细节由 override 负责。

首次及周期 checker payload 显式传 canonical config_path 或 UNRESOLVED，并沿 Creator relay 保留。未解析只取回并报 human_needed，不选择默认配置。Untouched pending 用真实 initial grant，failed 需 retry grant；付费交真实 Creator，嵌套拒绝则主 AI 派 sibling 后恢复同一 checker。未知 inflight 保留待核实。仅有效同目标末行 JSON 决定停止，all_complete 可含 human_needed。下载失败保留 ID 重试取回；监控不创作修复或审片。

查询/监控按生成任务计数；human_needed 为 `{ep,task_id,shots,reason}`，每 ep/task_id 一条完整成员。EP/all scope、HTTP transport、配置上下文及 Creator relay 保持上述约定。

## 维护与验证

修改后生成 Codex wrappers 并 --check，使用 git diff --check 检查补丁；源集合动态发现，不维护手工技能总数。当前契约与代码未同步时由主 AI/general 修工程，不能用 provider 接受请求代替门禁。Live-host 的角色加载、relay、隔离与监控须单独验证，机械检查不证明创作质量或完整 E2E。退出重启后核对当前安装/cache，发现旧名称时先确认路径。
