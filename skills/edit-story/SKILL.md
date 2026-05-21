---
name: edit-story
description: 对任意内容（资产、大纲、剧本、分镜）提出修改意见。自动检测 series/short mode 并按 DAG 级联修复。
argument-hint: "[自然语言修改意见]"
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, Task
model: opus
---

## 失败处理（核心规则）

**sub-agent task 失败后，永远不要在主 session 自己接管本应由 sub-agent 做的工作。**

1. 分析失败原因（task return 值 / 错误信息）
2. 如可修复：用修正后的参数重新派发同一 sub-agent
3. 如不可修复：将失败原因和已尝试方案返回给用户，停止流程

错误做法：自己 Write/fallback 应由 sub-agent 完成的内容。主 session 缺少 sub-agent 的隔离上下文，自己接管会导致质量下降、permission 错配等问题。

## 输入

- `$ARGUMENTS`：自然语言修改意见（可含 epXX / "第 X 集" 等集数提示）

## 必读文件 (按 mode 加载，双重保护)

- `skills/edit-story/series.md` (when mode='series')
- `skills/edit-story/short.md` (when mode='short')

## 工作流

### Phase 0: Mode 检测（必做，先于一切业务）

1. 在仓库根目录执行 `bash scripts/detect-mode.sh`
2. 捕获 stdout（'series' | 'short'），作为本次会话的 `mode`
3. 若退出码非 0 或值非法 → 告知用户"mode 检测失败"并结束；不要猜测

### Phase 1: 加载对应 mode 文件（必做）

1. 按 Phase 0 的 mode 用 Read tool 加载**仅对应 mode 的文件**（避免 prompt 污染）：
   - mode='series': Read('skills/edit-story/series.md')
   - mode='short': Read('skills/edit-story/short.md')
2. **不要**加载非当前 mode 的文件
3. 严格按加载的 mode 文件指引执行 Phase 2-4

### Phase 2: 理解意图（协作讨论）

1. 读 `config.md`
2. 按 mode 文件规则解析集数（series 从 $ARGUMENTS 识别；short 硬编码 ep01）
3. 主动读用户提及的相关文件；位置无法直接定位时先澄清
4. **基于已读内容，主动提出 2–4 个具体修改候选**（具体文本/参数 + 创作意图）
5. 用户可选 / 改 / 否决 / 自给版本；多轮无共识 → 告知后结束
6. 意图已明显（如"重新生成苏锦年的图片"）→ 可跳过候选生成

### Phase 3: 协商方案

1. **必读范围**：目标文件 + 候选上游 + 下游评估所需文件，必读后再诊断
2. **定位入口节点**：按"语义源头在哪个节点"，参见 mode 文件的入口表
3. **沿 DAG 向下逐节点评估**：每个下游候选判断是否受影响；跳过须说明理由
4. **方案呈现**：含「集数 / 入口 / 改动清单（编号 + 节点 + 文件 + 描述）/ 跳过及理由 / 请求确认」
5. **用户确认循环**：调整 / 改入口 / 取消，循环呈现直至明确确认
6. **边界拒绝**：若超出 mode 文件「v1 范围限定」 → 告知用户并结束

### Phase 4: 执行级联

按 mode 文件「节点 → skill 对照表」遍历清单（上游 → 下游）。

公共规则：
1. 传给下游 skill 的"修改意见"用方案中的具体描述，不是用户原始输入
2. review 节点仅在同名节点本次有改动时触发
3. review 失败 → 调对应 fix skill ≤2 轮；2 轮后仍失败 → 摘要记录并继续后续
4. 不在清单中的节点跳过
5. `config.md` 图像模型 = `none` 时 images 节点跳过并在摘要中提示
6. 节点 skill 调用失败（非 review 失败）→ 终止后续级联并报错

**"本集新增资产" dedupe 公共逻辑**（级联触发新增资产清单写入时）：
1. Read 目标 `outline.md` 中现有「本集资产清单」内容
2. Merge 新增条目
3. **Dedupe by 资产路径**（如 `assets/characters/苏锦年.md`），去重保留首次出现
4. Rewrite 该 section（不依赖 git diff，每次写入都是完整去重后的清单）

### Phase 5: 完成

输出摘要：含「集数 / 执行（已完成节点 + review 通过项）/ 跳过列表 + 原因汇总 / 检查建议」。

若 review 循环 2 轮后仍失败：追加 `- [!] {节点} review: 2 轮 fix 后仍有意见 — "{reviewer 最后反馈}"`

若 `config.md` 图像模型 = `none`：追加 `images 节点已跳过，请配置图像模型后重新触发 /edit-story`。

## 通用规则

- mode 一旦在 Phase 0 确定不再变更
- 所有 sub-skill dispatch 必须显式传递 ep（series 解析得到；short 恒为 ep01）
- 阶段 3 执行前必须取得用户对清单的确认
- 阶段 2 诊断前必须先读相关文件，不能凭关键词猜
