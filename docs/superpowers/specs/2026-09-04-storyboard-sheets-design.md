# Storyboard Sheets 关键帧系统重构设计

## 1. 背景与目标

当前系统由 Storyboarder 在 `storyboard.md` 中按需声明 `[KF-id]`，Creator 再为每个唯一 KF 生成单帧 `.md` 和 `.png`。视频提交时，系统把 KF 解释为首帧、尾帧或中间参考图。

本次重构以 clean break 方式删除这套单帧模型，改为：

- 每个视频 shot 必须生成一张 storyboard sheet。
- 一张 sheet 是固定 16:9 横向画布上的彩色专业影视分镜板。
- Sheet 内包含动态数量的等宽 panel，从左到右、从上到下表现该 shot 的完整时间推进。
- 每个 panel 对应 shot 内的视觉节拍，而不是一个独立视频 shot。
- Sheet 生成必须引用当前 shot 的基础资产图；存在实质连续性时，还引用前一个 shot 的 sheet。
- 视频生成同时引用当前 sheet 和基础资产图，并保留原 shot prose、对白和音效。

目标是让图像模型一次生成 shot 的完整视觉路线，再让视频模型结合分镜板与文字时间线演绎该 shot。

## 2. 范围

本设计覆盖：

- Storyboard schema 中旧 KF 协议的删除。
- Storyboard sheet 卡片、图片及目录协议。
- Panel 规划与整板生图 Prompt。
- 基础资产和前镜 sheet 的参考图绑定。
- Sheet Prompt 审核、整板视觉审核和修复闭环。
- Sheet 重生后的下游连续性影响评估。
- 视频 Prompt 和图片输入的转换。
- `edit-story`、`repair-story`、完整性检查及测试迁移。

本设计不覆盖：

- 旧项目自动迁移。
- Panel 裁切、局部重绘、蒙版或图片合成。
- OCR 或确定性文字叠加。
- 新图像 provider 的实现。
- 已提交或已完成视频的自动重提。

## 3. 核心术语

- **Shot**：一次视频生成任务，最长受当前视频模型限制，现行为不超过 15 秒。
- **Storyboard sheet**：一个 shot 对应的一张多格分镜板图片。
- **Panel**：sheet 内描述某个时间点或时间段视觉节拍的画格。
- **基础资产**：character、location、item、building 及其衍生资产。
- **连续性参考**：当前 shot 与前一个 shot 存在视觉连续性时引用的前镜 sheet。

## 4. 数据模型

每个 `storyboard.md` 中的 `### shot N` 必须恰好对应以下两个文件：

```text
assets/storyboard-sheets/{ep}/shotNN.md
assets/images/storyboard-sheets/{ep}/shotNN.png
```

编号使用两位零填充文件名，卡片中的 shot 主键仍为整数。`shotNN.md` 是规划与生图事实源，PNG 是其派生产物。

### 4.1 Sheet 卡片 Schema

```markdown
# shotNN Storyboard Sheet

## 基本信息
- 所属集数：epNN
- 对应分镜：shot N
- 时长：Ns
- 类型：分镜板
- Panel 数量：M

## 引用资产
- [资产名](../../characters/资产名.md)

## 连续性参考
- [shotMM](./shotMM.md)
- 继承元素：角色服装、持有物、结束位置、朝向、动作状态

## Panel 规划
### PANEL 01
- 时间码：0.0s-2.0s
- 景别：WS
- 机位：低机位正面
- 摄影机：SLOW DOLLY IN
- 画面：具体、可见的静态构图或关键动作姿态
- 连续性：本格继承或建立的状态；无则写“无”

### PANEL 02
...

## 图像生成提示
单段、模型可消费的完整整板 Prompt。
```

`## 连续性参考` 无依赖时固定写“无”，不得省略 section。依赖只能指向紧邻的前一个 shot，不允许跨越引用更早的 sheet；更早的连续状态应由相邻链逐步传递。

### 4.2 Panel 规划规则

Panel 数量不设硬性上下限，由内容决定，不按时长机械等分。以下事件可形成新 panel：

- 时间段边界。
- cut、反打或其他明确切镜。
- 景别、机位或摄影机运动发生实质变化。
- 动作关键姿态或空间关系变化。
- 重要角色反应。
- Shot 的建立画面和结束构图。

不得为凑数量重复几乎相同的 panel。Panel 时间码必须按升序覆盖 shot 全部时长，不得有未解释的空洞或越界。连续镜头可用多个关键姿态 panel；包含切镜的 shot 可用多个机位 panel。

## 5. Sheet 视觉协议

整张 sheet 使用固定 16:9 横向工作画布，与项目视频比例解耦。每个 panel 内部构图遵循 `config.md` 的视频比例，例如竖屏项目的 panel 仍采用 9:16 构图。

视觉要求：

- 自适应等宽网格。
- 固定从左到右、从上到下阅读。
- Panel 数量严格等于卡片声明值。
- 所有 panel 使用项目最终彩色视觉风格。
- 人物、地点、服装、道具和建筑遵循参考资产图。
- 每格使用短英文专业标注，例如 `P03 · 5.0s · CU · LOW ANGLE · DOLLY IN`。
- 每格可附一句极短英文动作摘要；详细描述只保存在 `.md`。
- 允许少量生成式文字失真。审核以顺序、构图、动作和一致性为主，不因轻微拼写错误打回。
- 不得增加计划外 panel、合并 panel 或遗漏 panel。

Panel 边框、编号、时间码和文字是控制信息，不属于最终视频画面。

## 6. 参考图绑定与生图

Sheet 图片必须使用 image-to-image。参考图按以下顺序绑定：

1. 当前 shot 的全部人物资产图。
2. 当前 shot 的 location、item、building 资产图，保持 storyboard 中首次出现顺序。
3. 可选的前一个 shot sheet PNG。

Prompt 使用显式槽位绑定：

```text
**参考资产：**
[张三:{图片1}]
[雨夜天台:{图片2}]
[黑色手机:{图片3}]
[PREVIOUS_SHOT_SHEET:{图片4}]
```

通用层不设置参考图数量上限，不截断、不降级，也不写死 Dreamina 的能力。具体 provider 不支持输入时，原样返回错误，由审核或修复流程处理。

### 6.1 连续性参考判定

仅当当前 shot 与前一个 shot 延续以下任一元素时声明前镜 sheet：

- 同一角色或服装状态。
- 同一持有物或道具状态。
- 角色、道具的屏幕位置或朝向。
- 跨 shot 连续动作的结束和起始姿态。
- 同一空间关系、光线或时间状态。

Prompt 明确要求只继承声明的连续元素，不复制前 sheet 的网格、panel 内容、构图或机位。跨场景、时间跳跃或视觉无关时不得引用前 sheet。

### 6.2 生成顺序与失败

Sheet 按 shot 编号严格串行生成：

- `shot01` 只依赖基础资产。
- 声明前镜连续性引用的 sheet 必须等待前镜 PNG 成功落盘。
- 必需基础资产图或前镜 sheet 缺失时，当前 sheet 失败并阻塞后续生成，不降级。
- Provider 的图片数、画布、内容安全或其他错误原样记录。
- 图像模型为 `none` 时生成全部 sheet `.md`，跳过 PNG 和视觉审核。

## 7. 创作 Pipeline

主链改为：

```text
storyboarder-storyboard
→ director-review-storyboard
→ creator-storyboard-sheet-prompts
→ director-review-storyboard-sheet-prompts
→ creator-generate-images
→ director-review-storyboard-sheets-visual
```

Storyboarder 仍负责 shot 时长、镜头运动、人物、资产、转场及时间线 prose，不负责 panel 卡片，也不再输出任何 KF 标记。Creator 根据已审核 storyboard 为每个 shot 生成 sheet 卡片。

Series 和 short 共用上述 sheet 子链。所有 review/fix 闭环沿用 pipeline 的最多两次修复规则。

## 8. 审核与修复

### 8.1 Prompt 审核

`director-review-storyboard-sheet-prompts` 在生图前检查：

- Shot 与 sheet 卡片一对一。
- Panel 时间码完整覆盖 shot 且顺序正确。
- Shot 的切镜、机位变化、关键动作和反应没有遗漏。
- Panel 没有无意义重复。
- 当前基础资产引用完整且路径有效。
- 前镜连续性引用和继承元素合理。
- 整板 Prompt 遵守固定 16:9、等宽网格、项目彩色风格和短英文标注协议。
- Prompt 正文中的资产槽位与参考图列表一一对应。

结果写入：

```text
story/episodes/{ep}/.review-storyboard-sheet-prompts.md
```

不通过时由 `creator-fix-storyboard-sheet-prompt` 消费最后一轮意见，只修改 dirty sheet 卡的 `## Panel 规划`、`## 连续性参考` 和 `## 图像生成提示`，不生图。修改后重新执行 Prompt 审核。

### 8.2 整板视觉审核

`director-review-storyboard-sheets-visual` 逐张读取 sheet 卡和对应 PNG，检查：

- Panel 数量、顺序及总体时间推进。
- 每个 panel 的景别、机位、动作和构图。
- 人物、地点、服装、道具和风格一致性。
- 连续性参考声明的视觉状态。
- 是否出现会误导视频模型的额外画格、合并画格或严重标注混乱。

意见必须定位到 `PANEL NN` 或整板级问题。允许轻微英文拼写失真。结果写入 `.review-storyboard-sheets-visual.md`。

### 8.3 修复单位

图片修复由 `creator-fix-storyboard-sheet-image` 以整板为单位执行：

1. 根据意见修改 dirty sheet 卡的 `## Panel 规划`、`## 图像生成提示`，或两者。
2. 删除对应整张 PNG。
3. 使用更新后的全部参考图重新生成整板。
4. 再次执行整板视觉审核。

不裁切、不局部重绘、不合成旧 panel。与基础资产图片修复不同，sheet 的 panel 规划本身允许被修订，因为它是本类资产的核心事实源。

### 8.4 下游连续性影响评估

重生 sheet 后不机械重生全部依赖项。`director-review-storyboard-sheet-impact` 从直接引用该 sheet 的下一 shot 开始逐层评估：

1. 读取新生成的上游 sheet 卡和 PNG。
2. 读取直接依赖它的下游 sheet 卡和现有 PNG。
3. 判断下游现状是否仍与新的连续元素兼容。
4. 兼容时记录 `unaffected` 和理由，保留下游文件，并停止该依赖分支传播。
5. 不兼容时记录 `affected` 和理由，将下游 sheet 标脏、更新并重生；重生后继续评估它的直接依赖项。

不保留旧 PNG 进行前后对照。Reviewer 依据新上游 sheet 与当前下游 sheet 的兼容性判断。Reviewer 只输出影响结论和修复方向，不修改文件或生图；`affected` 项交给 Creator 修复并重生。

触发 `affected` 的典型变化：

- 人物外观、服装或持有物不兼容。
- 屏幕位置、朝向或空间关系不兼容。
- 连续动作的结束与起始姿态不兼容。
- 场景光线、时间或状态不兼容。
- 下游明确声明继承的其他视觉元素不兼容。

构图微调、短英文错字、边框变化或下游没有声明继承的 panel 变化不触发重生。评估结论必须写入本次 visual review 轮次，禁止静默传播。

## 9. 视频生成协议

`storyboard-to-prompt.sh` 为每个视频任务构造：

1. 当前 `shotNN.png`，固定作为图片列表第一项。
2. 当前 shot 的人物、地点、物品和建筑基础资产图。
3. 原 storyboard shot prose、对白、声音和时长。

视频 Prompt 前置读板指令：

- 将第一张图解释为按 PANEL 编号和时间码排列的 storyboard sheet。
- 按从左到右、从上到下的 panel 顺序演绎视觉路线。
- 以 prose 作为动作、对白、音效和精确时序的权威来源。
- 网格、边框、编号、时间码和文字不得渲染进最终视频。

旧 KF 的位置语义检测及首、中、尾图片重排全部删除。`tasks.json.images` 的顺序就是首次提交和失败重试的实际顺序。

视频生成前缺少当前 sheet PNG 时必须停止该 shot 提交。图像模型为 `none` 可以完成内容 pipeline，但不能在没有 sheet PNG 时提交视频。

## 10. 编辑与恢复

`edit-story` 使用以下影响规则：

- Storyboard shot 变化：重建对应 sheet 卡和 PNG。
- 基础资产卡或图片变化：重建所有直接引用该资产的 sheets。
- Panel 规划或整板 Prompt 变化：只重建当前 sheet。
- 任一 sheet 重生：执行第 8.4 节的 Reviewer 影响评估。
- `submitted` 或 `done` 视频不自动重提，沿用现有警告及人工删除任务/视频后重建的机制。

`repair-story` 的恢复顺序统一为：

```text
outline
→ novel（series）
→ script
→ 基础资产卡
→ 基础资产图片
→ storyboard
→ sheet.md
→ sheet.png
→ sheet visual review
```

恢复检测不得在 storyboard 之前生成 sheet，也不得依赖旧 `keyframes.json`。

## 11. 完整性定义

图像模型启用时，完整性要求：

```text
storyboard 的唯一连续 shot 编号集合
== storyboard-sheets/{ep} 下 sheet 卡编号集合
== images/storyboard-sheets/{ep} 下 PNG 编号集合
```

图像模型为 `none` 时只要求 storyboard 与 sheet 卡集合相等，PNG 检查输出 skipped。检查器必须报告缺号、重复 shot、孤儿卡片和孤儿图片。

## 12. Clean Break 删除范围

删除：

- Storyboard 中 `[KF-id]` 及首帧、尾帧、参考三种语义。
- `assets/keyframes/`、`assets/images/keyframes/` 协议。
- `keyframes.json` 的全部残留引用。
- `parse-storyboard-kf.sh`、`keyframe-to-prompt.sh`。
- `creator-keyframe-prompts` 及 keyframe 专属 review/fix 文案。
- 视频提交中的 KF 检测和图片重排。

不提供旧项目自动迁移。检测到旧 KF 标记、旧目录或旧状态文件时明确报错，说明新版本不兼容，并提示固定到旧 release 或人工迁移。

所有用户文档、Claude/OpenCode/Codex 适配层和测试 fixture 必须同步，避免旧术语继续进入模型上下文。

## 13. 组件边界

新增或替换以下单元：

- `creator-storyboard-sheet-prompts`：从已审核 storyboard 创建/更新每个 `shotNN.md`，并清理孤儿卡片。
- `storyboard-sheet-to-prompt.sh`：读取 sheet 卡，确定参考图片列表和带槽位绑定的整板 Prompt。
- `director-review-storyboard-sheet-prompts`：审核 panel 规划、资产引用和整板 Prompt。
- `creator-fix-storyboard-sheet-prompt`：按 Prompt review 意见定向修订 dirty sheet 卡，不生图。
- `director-review-storyboard-sheets-visual`：调度逐 sheet 视觉审核并维护 dirty list。
- `creator-fix-storyboard-sheet-image`：按 visual review 意见修改 dirty sheet 卡并重生整板。
- `director-review-storyboard-sheet-impact`：只读判断重生 sheet 是否使直接依赖项失效；不修改文件。
- `creator-generate-images` 及 provider skill：识别 storyboard sheet 类型，按 shot 严格串行生成。
- `storyboard-to-prompt.sh`：把 sheet 置于视频参考图第一项并注入读板指令。

实施时 visual review 可进一步拆成聚合层与 single-review 层。上述 skill 名和职责是规范的一部分，不再由实施计划改名；规划、文本审核、生图、视觉审核、影响传播各自保持独立。

## 14. 测试策略

### 14.1 Markdown 契约

- 源 skills、agents、scripts、README 和生成适配层不再引用旧 KF 协议。
- 三种 episode pipeline 使用相同 sheet 子链。
- `edit-story` 和 `repair-story` 顺序符合本设计。
- 所有路径统一为 `assets/storyboard-sheets` 和 `assets/images/storyboard-sheets`。

### 14.2 Shell 单元测试

- Sheet 参考资产保持规定顺序。
- 相对路径正确转换为图片路径。
- 可选前镜依赖位于基础资产之后。
- 通用层不截断参考图片。
- 视频图片列表中当前 sheet 始终第一，基础资产随后且去重稳定。
- 视频 Prompt 含读板和禁止渲染标注的指令。
- 不再执行 KF 位置检测或图片重排。

### 14.3 完整性测试

- Shot 与 `.md/.png` 一对一。
- 缺号、重复编号、孤儿卡片和孤儿图片可被识别。
- 图像模型 `none` 时 PNG 正确标记为 skipped。
- 旧 KF 项目得到明确的不兼容错误。

### 14.4 流程 Fixture

至少使用三个 shot：

- `shot01` 无前镜依赖。
- `shot02` 依赖 `shot01`。
- `shot03` 不依赖 `shot02`。

验证 `shot01` 重生后 Reviewer 可将 `shot02` 判定为 affected 或 unaffected。若 unaffected，传播停止；若 affected，重生 `shot02` 后才继续评估其依赖。`shot03` 不得因编号靠后被机械标脏。

## 15. 验收标准

- 每个 shot 都有且只有一张 sheet 卡；图像模型启用时有且只有一张 sheet PNG。
- 一张 PNG 含动态数量的多格画面，不再一格一图生成。
- Sheet 生图使用当前全部基础资产图和按需前镜 sheet，不在通用层限制图片数量。
- 整板固定 16:9，panel 保持项目视频比例和项目彩色风格。
- 视频提交同时使用当前 sheet、基础资产和原始 shot prose。
- Sheet 重生后，由 Reviewer 判断直接依赖项是否受影响，而非机械重生全部后续项。
- 旧 KF 文件、术语、脚本、检查和视频重排逻辑从当前版本完全移除。
- 新旧契约测试及完整测试套件通过。
