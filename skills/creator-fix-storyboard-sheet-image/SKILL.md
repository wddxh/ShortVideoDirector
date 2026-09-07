---
name: creator-fix-storyboard-sheet-image
description: Use when a storyboard-sheet image needs visual diagnosis or authorized whole-sheet correction.
user-invocable: false
agent: creator
allowed-tools: Read, Edit, Glob, Grep, Bash, Skill
model: sonnet
---

# Fix Storyboard Sheet Images

## 输入

读取原请求及持续有效 grants：普通图片制作意图包含同范围可恢复失败重试及必要修卡、整板替换/重生和独立复审，默认不设尝试或轮次上限，不另问重试许可。生成一张图不等于用户明确只许尝试一次；用户明确的单次、次数、范围、检查点和费用限制仍绑定。跨 section/owner 的问题先交 Director 在原权限内协调，不自动变成用户提问；当前 prompt 门禁与新建独立复审仍为内部 gate。按共享 user-decision-relay 规则诊断失败与进展，不盲目无限尝试；参数不支持、账号/额度或其他不可恢复问题停止受影响工作，替代方案仅限固定配置与实际裁量授权，否则报告阻塞。本 skill 白名单与 pending 保护不变。

- 从委托取得 ep、canonical cards/shotNN、诊断或替换目的、固定设置与授权范围；路径不是重生许可。
- 若委托依据 visual review，读取指定记录，通常为 `story/episodes/{ep}/.review-storyboard-sheets-visual.md`。委托明确要求处理当前 dirty 时据此定位，否则范围不清先澄清，不自动扩到整集或历史 dirty。
- Review 模式读取最新声明目标 scope 的意见，支持 `### dirty list` 中 `card|image` 及 impact 意见 `card|image|impact|fix_direction`；显式 scope 与当前可处理目标取交集，不因旧轮完整而回退。
- 也接受直接授权的 ep、canonical cards 与 instruction，不要求历史 review。纯诊断不授权生成；不得从文件名或 owner 标签推定前置工作已完成。
- Read 选中 cards、PNG、实际配置（`SVD_CONFIG` 或 `config.md`）、当前 storyboard 和 script 相关场景/清单；连续性问题读取最小必要前后镜对照。看不到图片则说明诊断限制，不假装已目视确认。
- 按 [card rules](../creator-storyboard-sheet-prompts/rules.md) 的项目根转换命令取得当前完整 prompt、images、settings、sourcePath，按该 images 读取直接参考，不另猜上传集合。源 shot 是叙事依据，Panel 选择静态 beats，整板提示只管格式、阅读顺序、比例、风格与 labels；不能把最后一个 section 当全部生成输入。

## 修改边界

只可最小 Edit 选中 card 的：

- `## Panel 规划`
- `## 图像生成提示`

不得修改 `## 连续性参考`、`## 引用资产`、`## 基本信息`、heading、Panel 数量、文件名、storyboard 或其他资产。若意见要求越界，报告失败，不扩大修改范围。

Card 不存源 shot 副本；叙事、对白与声音的修改交上游负责人，不能用 Panel/整板摘要覆盖。修姿态、构图时保留完整 Panel 细节；对白/声音影响表演，不逐句配格、不自动画字幕，也不为字数加格。源声明或实际参考图片缺失时报告依赖问题，不用压缩上下文或外观描述替代。旧冗余提示仅在受托目标内按实际问题修正，不自动迁移用户卡。

先分清 Panel 选择、提示表达、错误引用、上游事实和生成偏差。可在授权范围内修正 Panel 规划/整板提示；纯生成偏差不强制改词。涉及连续性参考、资产或镜头事实时返回具体 findings 与跨负责人建议，交由 Director 协调。保留未涉及 Panel、时间码和既有事实。图片修复单位始终是整张 sheet；不裁切、不局部修图、不拼接旧 panel。

## 执行

可先比较关键姿态、屏幕方向、持有物与门口等空间锚点，再检查格序、标签和内部画幅。若只有某格偏色，辨别是否合理光源变化；若主体被裁切，核对已解析画布比例与内部视频比例，不把所有问题归为换模型或整板加形容词。以下执行依赖不等于强制先改卡再生图。

修复成果是满足当前 card、源 shot 及必要声明连续性的可用整板，或具体诊断与阻塞，不要求精确复刻每个细节或机位。当前独立视觉证据已 pass 即停止质量循环，不为无影响的细节、色彩、布局或机位偏好反复重生；可选精修仅在用户要求或出现新需求时进行。明显错误、关键设计、空间动作或妨碍生成的格序问题仍须处理，证据失效先评估，不自判 pass；失败重试默认无次数上限不变。Creator 根据根因决定是否改卡、恢复或重生；调用方约定目标和授权，不选择专家内部的技能或工序。

- 编辑边界：核对当前意见、路径、scope 和 section；只在授权时 Edit cards。纯诊断返回 findings，保留全部文件。
- 新提交前提：执行方核对完整目标路径、替换授权、当前 sheet-prompt 与实际依赖证据、四项已解析设置。缺证据或设置冲突保留旧 PNG 并返回 blocked；路径不授予 force。
- 执行责任：生成单位是整张 sheet，禁止逐 panel 生图。制作委托内已诊断必要的目标替换无需另问；实际 coordinator `[--force] [--concurrency N] CARD...` 使用共同 runner，先 preflight 全批 pending/设置，再由获调度的 wrapper 删除明确授权目标，caller 不提前删除。pending/未知结果先按已有 id 恢复或核实，未终态或结果未知不得重提，轮询超时不算生成失败。终态可恢复失败在原制作范围与用户限制内重试，无默认次数上限。
- 结果责任：依据接口结果和实际 PNG 落盘情况报告真实成功集合。失败项保持可恢复失败，不声称已更新；连续性影响交 Director 协调，不自行 enqueue impact。

默认本地并发 5，不是账号配额；Creator 按当前接入限制覆盖，不反复询问。只等实际基础/previous-sheet 图片依赖，无关 sheets 可并发，参考图全量有序且就绪。force 全批只含明确替换 cards。首次失败/pending 停止新启动、排空 active；保留所有成功、IDs 和未启动旧图，不用 shell 并行 raw provider/wrapper 绕过。pending helper 互斥写入，stale claim/未知 receipt 人工核实、不自动过期。恢复与结果协议见 [图像接口](../creator-provider-dreamina/image.md)，调度器不替角色盲重试或设质量轮次上限。

恢复既有 job 使用记录中的 provider、输出路径和设置，不被新卡验收阻断；纯恢复委托无论结果如何均不新提交，制作委托恢复后续生成仍须上述门禁。有 `.generation.json` 时由现有方法 settle 后再移除 pending，不能重新 prepare；receipt 的 status、tuple 与哈希只是来源信息，不是视觉验收。导入/历史图片可无 receipt，不编造元数据或仅为补 receipt 重生。四项设置变更超出本 skill 的 section 白名单，交 Director 协调授权卡片同步。

当前解析出的 source/refs 是修复与复审依据，不证明旧图当初使用同一组输入。已知 ID 的纯取回不以当前解析成功为前提；解析失败只阻塞依赖它的新提交/当前验收，不触发替换旧 job。

Bash 可用于只读校验，以及已授权、限定目标的现有生成接口、pending 查询/下载与状态维护。目标 PNG 的 force 删除仅由现有 wrapper/coordinator 在 pending preflight 后执行；本 skill 不另写删除命令、不绕过保护。card 仍用 Edit，不用 Bash 写 card/review，不写无关文件。

## 返回

```text
requested shots: shotNN ... | none
changed cards: shotNN ... | none
successful regenerated shots: shotNN ... | none
failed shots: shotNN: reason ... | none
review path: story/episodes/{ep}/.review-storyboard-sheets-visual.md
```

返回集合以实际结果为准，附未处理问题与建议；direct/诊断无 review path 时写 none。本次重生后的复审须覆盖 `successful regenerated shots`，由这些实际更新发起相邻连续性影响评估，不将失败或 pending 未落盘的输出伪装为新图。该集合不限定全部待审范围：Director 可另行评估已有未审核、证据过时或 unknown 的图片，保留 outstanding review scope，不以成功子集覆盖未解决项。独立审核由 Director 另行委派，不自动续接技能；未生成图片的诊断也不能声称完成视觉修复。
