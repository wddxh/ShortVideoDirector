---
name: director-review-script
description: 在单集 script.md 需要独立评估叙事、可拍性、视觉节点和资产清单时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入
委托说明集数 ep、短篇/新系列/续集语境、当前目标、保留要求与参考路径；mode 是语境，不是函数入参协议。

## 必读文件
- `story/episodes/{ep}/script.md` — 必读 (review 目标)
- `story/episodes/{ep}/outline.md` — 存在且适用于当前委托时对照；用户素材与已确认意图也可作为依据
- 实际配置 `SVD_CONFIG`（未设时 `config.md`）— 必读（用户每集时长目标及确认边界）
- `assets/characters/*.md`, `assets/locations/*.md`, `assets/items/*.md`, `assets/buildings/*.md` — Glob 列出 (asset 引用核对)
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/rules.md` — 剧本 schema、时长契约与表演表达指南
- `${CLAUDE_PLUGIN_ROOT}/skills/director-review-script/series.md` (when mode in {new-series, continue-series}) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/director-review-script/short.md` (when mode=short) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

## 接管说明
本 skill 同时承担叙事审核职责。script 是叙事骨架；storyboard 与 storyboard sheets 在后续各自接受独立审核。

按共享规则在独立新 Director context 审核，kind=`script`，scope=[`story/episodes/{ep}/script.md`]。先开工声明 scope，阅读前/结束后 fingerprint script、config 和全部实际项目参考；不预跑依赖后续图片的全生产 readiness。

## 审核维度

### 适用指南
按委托选用 series.md 或 short.md，区分已有事实、已确认意图与可选素材；下面分组是检查维度，不规定思考方法或强制 skill 链。

### 当前材料与预算
- Read script.md、实际配置与相关已存在的 outline/用户素材
- Glob assets/ 建立已注册 asset 集合
- 按 mode 文件指引读相关已存在的上下文 (series 可参考 arc / 上集 script)
- 按 scriptwriter-script/rules.md 从实际配置取目标与确认边界、换算秒数并实跑 scene-duration.sh：已确认 ±10% 的单值用 `--target N`；显式范围/更严格限制用 `--target-min M --target-max X`（精确值 M=X），不得扩大范围。记录真实 sum、边界、退出状态，不只接受作者自述。系列核对初始共同目标，不以前集实际时长重设预算；目标缺失/冲突报告待澄清，超界交生产 Director 协调修订或询问用户，不以节奏审美豁免。

### 剧本判断

1. **节奏分布合理性**
   - `scene-duration.sh` 输出: PASS / FAIL 状态 + sum 秒数
   - 节奏曲线: 按场景目标与表演看压力、策略、认知和情绪的变化，持续冲突或静观都可成立
   - 检查动作、对白与反应是否有空间，重复是否挤掉关键表达；长短场景不是独立失败标准
   - 一场景只挂一个节奏角色 (公共规则呼应)

2. **视觉节点覆盖**
   - 剧本每个场景的"视觉摘要"字段是否覆盖该场景的关键视觉点 (构图焦点 / 道具 / 对比 / 符号)
   - 视觉摘要不能写成"一个紧张的场景"等抽象描述——必须给具体可拍画面
   - 用户确认的核心事件及适用 outline 事件是否落实为可拍场景；已授权改编不要求逐字照搬，遗失关键因果/情绪落点才打回

3. **asset 列表完整性 (双向核对)**
   - 用 `episode-assets.mjs "story/episodes/{ep}/script.md" all` 解析 script 的 `## 本集资产清单`，含新增和已有两小节；script 是唯一 inventory 来源，不回退 outline
   - 从正文场景提取四类资产，与清单双向核对，不能用清单自身证明出场；遗漏和冗余都给具体路径。新增卡尚未创建不是早期 script review 失败，已有引用须核对实际材料
   - **资产引用路径**：与 scriptwriter-script/rules.md 一致，角色、地点及需独立视觉身份的道具/建筑在场景元数据或正文首次使用处写 `<名称> (assets/<type>/<名称>.md)`。后续同名提及可省路径；不能因对白或重复提及未带路径打回。真正未标识的出镜资产仍须定位并补齐，清单不能替代正文核对
   - 列出所有 dangling 引用 + 冗余声明

4. **表演与观众体验**：重要互动有具体话语、行动与回应；人物目标、利害关系、潜台词与情感触发可感知。声音特征与角色卡一致，内心声、自言自语、旁白、画外对话或字幕按表达需要使用，明确谁能听见。鼓励用人物的自我辩解、愿望与声音反应增强代入，不设数量或不可替代门槛。

5. **mode 专属 review 项**: 见 series.md / short.md

6. **场景级内容密度参考**
   - 可运行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/script-budget.sh {ep}`，读取真实每场与汇总 status；工具按场景文字计数，不是对白或表演计时器
   - 低于 8 或高于 10.4 字/秒的 `fail` 仅提示检查；沉默调度可用少量文字，长描述可表达瞬时画面，不自动判艺术失败或补删独白
   - 结合试读、动作复杂度与反应时间发现真实不可拍或遗漏，才给定位与方向。`missing:duration` 是计算依据缺失；剧本确实缺少必需时长字段时另按 schema 报告

本次不代替资产卡或图片的专门审核，也不把模板存在当作它们已通过的证明。

### 表演与事实落地

区分供作者理解的背景与观众实际得到的证据。`归历六年夜，桥东北岸` 的年份/方位不自动要求字幕；`已装芯` 若仅是前情可留背景，若本场必须证明则核对既有设计是否支持，不能以虚构显示装置解决。当前状态不要只靠“全身无伤／无未来年份”等排除来定义。选择看册须有视线/动作依据，而非只写判断结论；已有站位、持有关系不因措辞修订丢失。

对白、内心独白、自语的重要表达要能看出对谁、想什么/持何态度、何事触发变化及可听表演，不只贴“温和询问／带期待／认真”。稳定音色/口音与临场重音、呼吸、节奏、音量、音高区分；常态配速不是永久限制，青年戏不带老年声备选。声音卡问题指出交相应负责人，不在剧本审核里擅改卡。

既定18s的告别还须容纳倾听、反应和动作，不因场景55s或字数工具通过而忽略实际承载。不要求逐句哭、耳语、停顿，不默认延时或改已保留台词。审核剧本中的成片证据，不脑补后续 prompt 会补齐；最终 prompt 的独立可消费性仍由分镜审核核实。

### 意见取舍
- 阻塞聚焦真实叙事、共情或制作缺口；有用的专业建议可另列收益，不把措辞偏好强制交给作者
- 意见供 scriptwriter-fix-script 消费，生产 Director 决定修正与重审；reviewer 不承担修复调度
- 意见说清问题方向，不替 scriptwriter 写最终台词

### 审核记录 (append 模式)

**Round 自检**：
1. Read `.review-script.md` (若不存在为第 1 轮；存在则 grep `^## 第 [0-9]+ 轮` 找最大 N，本次为 N+1 轮)
2. Write/append 开工段，先声明 scope；完成后补全本轮 `script` evidence（version/kind/scope/results），每目标恰好一个 result，并以唯一 `<!-- /round-{N} -->` 关闭，Read 自检

**本轮段格式** (每轮段前留空行)：

通过时 heading：`## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过`，仍必须写完整证据和 footer；实际输入变更/读取失败/无法判定为 unknown。

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{位置 (场景 N / 字段名 / "整体")}：** {问题描述} → {修改建议}
```

## 规则
- 重审聚焦仍影响下游分镜的关键问题，轮次不改变验收标准，不自行豁免
- 具体权利风险按共享规则升级，不因现实名称自动要求改名

## 输出
- 文件: Write 或 Edit `story/episodes/{ep}/.review-script.md` (append, 详见审核记录)
- 返回: `pass`、`needs_revision {M}` 或 `unknown` (M = 本轮意见条数) → 返回原生产 Director
- 详细意见已写入文件，下游 scriptwriter-fix-script 自行读取最后一轮段
