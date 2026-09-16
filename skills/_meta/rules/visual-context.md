# 图像上下文与预览规则

## 每次使用全新任务

由主任务新建并明确委托本次图像操作的视觉子任务，本身就是所需的新上下文，可直接执行该有限操作；不需要再派一个子任务证明隔离。工具知识的读取不消耗这个资格。任务视频集成的 shot-input 总审 owner 是纯文本职责，即使刚创建也不直接看图，按下节派视觉 helper。仅当需要开始另一个图像操作或继续先前已有的图像任务时，才将成果交回协调方，请其新建下一任务。已确认不能嵌套时不重试 Task；不能把一次有限操作拆成无限递归委托。

所有图片读取或操作均须使用全新 task 上下文，不限于独立审核：包括参考查看、生成/渲染、作者自检、诊断、修订、裁剪和动画采样。每次仅委托一个明确操作和最小必要图集；跨图比较只带必要配对，不附全部历史图片。后续读取、细节 crop、修改后再看或重审也另开新 task，不恢复已有图像上下文继续积累图片。

一次明确操作也包括有限批量提交：一个全新 Creator 生成上下文可将相干、已授权、当前 prompt 门禁通过且就绪的多个 jobs 交单一 runner 执行，默认并发 5，不按内部每张图片调用另派任务。该上下文只处理文本与文件路径，返回状态、全部 IDs 和输出路径，不读取或附回图片；输入或输出的实际查看另开全新任务，独立视觉验收仍交全新 Reviewer、helper 缩略图和最小必要图集。批量执行的依赖、force、并发及停止边界见 [依赖与并发](../../creator-generate-images/SKILL.md#依赖与并发)。

通过文本结论、材料/源码路径、当前版本指纹、必要约束和未决问题交接，不继承图像消息或制作历史。协调任务只接收文本/文件交付，可恢复原专家、审核协调者或 checker 的纯文本上下文；不得恢复 image-heavy task 处理下一次图片操作。独立审核须新建 Reviewer，作者自检不提供独立性。支持时直接委派，Task 不可用或明确深度拒绝后复用已知限制，请顶层主 AI/Director relay 并将实际结果回原请求任务。普通失败不算深度拒绝；仍无所需上下文则阻塞、审核 unknown，不在当前上下文代看或自审。

## 任务视频集成的纯文本总审

shot-input owner 在 start 后读最终 prompt/timeline/manifest/必要源，确定 purpose/use，规划空间、轨迹、摄影、光照、揭示、时钟、切点和外部配对。无论参考有无肢翼或是否演细节，owner 始终核对完整源动作序列、必要主体/部位归属、准备/执行/收尾及接触变化，不编动作或设每帧配额。helper 另查粗视频及源中的肢翼/精细机构信号，优先简化复用；保留肢翼处理额外模仿风险，不降低文字完整性。独立 action reference 另查所选动作，purpose 不免最终源语义完整。查看全部交 fresh Reviewer 最小 helper 缩略图集；owner 不加载图片、帧、contact sheet 或附件。单资产叶子仍可在新上下文有限查看并写自身记录。

owner 在 delegate 读取前采集实际 inputs，新依赖先回传未读路径、完成协调和采集，再交 fresh task。helper 仅回文本观察事实、时间/帧、原路径/指纹、预览映射和覆盖限制，区分实际所见与源码推断，不发 target pass、不写同目标记录、不另开竞争轮次。owner 独立判断全文集成与覆盖，缺口另派有界新任务，不汇总局部通过冒充整体通过。必要证据仍缺为 unknown，明确冲突为 needs_revision；采样不证明完整运动。

嵌套可用即在已协调 scope 内直接派发；不可用时 Director 派 sibling，实际文本结果恢复原纯文本 owner，绝不恢复视觉 helper。真实句柄、读写依赖与未完成范围沿现有 handoff 回传，父任务和后代实际完成前保留子树占用。具体职责见 [shot-input 总审](../../reviewer-review-shot-inputs/SKILL.md#text-owner-and-bounded-visual-handoffs)。

## 请求体读取超时

图像密集操作遇到精确报错 `Timed out reading request body. Try again, or use a smaller request size.` 时，优先按请求过大或读取图片过多、上下文图像累积的信号处理；该报错不是此根因的普遍证明。停止重试同一庞大上下文，将当前问题和必要路径交协调方，另建全新 task，按下述 review-image helper 生成并只读取更小的最小必要缩略图集，不携带完整原图或无关历史，也不恢复原 image-heavy task。一次判断所需的最小比较图集仍放在同一任务中，不能为缩小请求省略必要参考；证据不足保持 unknown，不自动 pass。

新任务沿用下述证据采集和独立审核规则，向原请求方返回简洁的观察证据、实际读取路径、预览依据、结果与限制。若小型全新请求仍出现此错误，转查传输或服务问题并回报诊断，不继续无限缩减图集或自动重试。

## 先缩略图，再必要细节

原始图片（包括 2K/4K）绝不直接交给 Read 或其他模型图像读取入口；低分辨率源也先走 helper。原图保留作 provider 输入、可编辑制作依据和原字节 fingerprint，不能用审核缩略图替换。实际查看前核实指定临时目录的父目录，再运行：

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/visual-review-TASK
```

SOURCE 是实际源文件路径；临时目录按本次任务指定，不写入 story/assets/references。成功返回 JSON：`source`、`source_sha256`、`source_size`、`preview`、`preview_sha256`、`preview_size`、`crop`。只 Read 返回的 `preview`。默认长边 1024，`--max-edge` 允许 1..1280，保持比例且不放大小图；不得通过其他工具把整张原图送入上下文绕过限制。失败先处理依赖/输入问题，不退回直接 Read 原图。

缩略图不足以判断必要细节时，将具体问题和坐标交全新 task，仅裁剪所需局部：

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/visual-detail-TASK --crop X Y WIDTH HEIGHT
```

坐标是 EXIF 校正后原图像素坐标，结合 source_size/preview_size 换算。Crop 在原图内，仍限制长边，只 Read 返回 preview。不以全图 crop 或拼接局部重建高分辨率图绕过规则。仅补相关细节，使用最小必要图集/边界配对，不自动加载整套帧。必要目标分派新任务覆盖，不省略审核；无法核实必要条件则说明限制并保持 unknown。

## 动画与证据

观察按实际用途确定：粗骨架呈现操作区域、整体关系/轨迹、相机、光照、揭示、转场和时钟；缺手或未演精细接触不自动判悬浮/unknown。最终文字始终完整保留源序列，无论有无肢翼。已有粗动画优先省去肢翼/精细机构信号复用，保留肢翼另按官方建议 7 处理模仿风险，不以仅借空间豁免具体矛盾，也不穷举潜在行为。细模/静态 shape/identity、精细几何与独立 action reference 按 purpose 审核，不免最终源语义完整，不全降 BOX、重生身份图或默认建细 rig。采样服务必要证据，不设帧配额。

任务接点比较用实际选中 clean MP4 的尾/头相干时间窗口，不只两张端点；将支持接点源意图的两侧证据放在同一次有限 fresh helper 操作，结合最终 prompt 核对：同一事件检查必要动作/空间/声音延续，场幕/时空跳转检查叙事关系与观众定位，不强制续动作/续声。整集覆盖全部相邻组，局部仅必要邻界，按故事另取非相邻/跨集依赖。每个消费 owner 均在读取前采集 inputs、观察仍适用时可共享独立文本事实，无需两端重复看图；各自独立判断目标，不加账本。披露采样及音频实听/仅存在/计划的限制，必要邻界证据缺失为受影响目标 unknown，不扩生成授权。细则见 shot-input 接点审核。

动画 GIF 和其他多帧图片不能静默取首帧冒充缩略图；helper 会拒绝此类输入。需要时在全新任务中用适当工具显式抽取有意义的采样帧到指定临时目录，记录原文件/指纹、帧编号或时间点及抽取方式；各次查看仍按上述新任务和缩略图规则，只带最小必要帧集。披露只看采样帧的时间覆盖与运动/时序判断限制，不能据此证明完整动画连续性。此 helper 不是时序验证器，也不新增最终视频审核权限。

五种 runtime 审核按 review-meta-rules 在读取前由目标 owner 用 review-round start/add-input 采集原材料，finish 复核并注入 `result.inputs` 的原路径与整文件 SHA-256。局部视觉 delegate 所需参考也须 owner 在委托读取前采集；新参考先回传路径，采集后再交全新任务查看。delegate 返回实际观察、所读路径、预览依据和限制，不以后采快照追认前次读取，也不建 import registry。可选 `result.visual_inspection` 保存真实预览 helper JSON；动画帧另保留原动画采样映射与覆盖限制。派生依据不替换或刷新 inputs。

## 写入例外与实际边界

审核者通过 review-round 写受托 canonical 文件，每轮 scope=[target]、一个完成 result；无读写/输入依赖冲突的就绪视觉目标并行，同一 ep/kind/target 重审串行是输出所有权规则，其他读写/输入依赖仍须排序。指定 `/tmp/opencode/<task>` 目录先存在，允许其中 helper STATE、Reviewer payload、必要缩略图/crop/采样帧；不在工作区复制账本。局部检查回指定独立目标 owner，后续视觉操作另开 fresh task，不恢复 image-heavy 上下文。finish 摘要足以回传，正常完成不要求立即重读全文或重复指纹检查。不得修改原图、卡片、源码、工程或其他生产材料，不把临时派生图登记为制作输出；Bash 权限不扩大此范围。

这些约束由任务执行者遵守。Helper 校验自身调用中的缩放上限、源文件与派生输出；插件不机械拦截直接 Read，也不强制新 task。协调方须确认实际委托上下文与查看方式，不能将 helper 成功视为已满足全部隔离和审核要求。
