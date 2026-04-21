---
description: 对单集短视频的任意内容（资产、大纲、剧本、分镜）提出修改意见。通过对话协商确定方案后，按级联 DAG 按需执行修正。使用 /short-edit-story
  加自然语言描述触发。
agent: build
subtask: true
argument-hint: '[自然语言修改意见]'
---

## 使用示例

```
/short-edit-story 大纲的结局改成开放式结局
/short-edit-story 剧本第 3 场苏锦年对导师的台词太平淡
/short-edit-story 分镜镜头 5 里苏锦年的衣服颜色不对，应该是黑色
/short-edit-story 重新生成苏锦年的图片
/short-edit-story 在资产清单中补上遗漏的角色老王
```

## 硬性约束

- 集数固定为 `ep01`（单集短视频只有一集）
- 阶段 3 执行级联前必须取得用户对具体改动清单的确认
- 阶段 2 诊断最上游前必须先读相关文件，不能凭关键词猜

## 流程

### 阶段 1: 理解意图（协作讨论）

1. 读取 `config.md` 获取配置
2. 读 `$ARGUMENTS`，识别用户想改什么内容
3. 主动读相关文件锁定用户提及的具体位置；若位置无法从用户输入和已读文件直接定位，先澄清
4. **基于已读内容，主动提出 2–4 个具体的修改候选**。每个候选必须含：
   - 具体的文本/参数（不是方向描述）
   - 该改法的创作意图解释
5. 用户可选、改、否决或给自己的版本
6. 若用户给不出方向且多轮后仍无共识 → 告知"缺乏方向无法出方案"并结束
7. 用户明确具体改动内容后 → 进入阶段 2

**示例：**

用户：`/short-edit-story 剧本第 3 场苏锦年对导师的台词太平淡`

LLM 读 `story/episodes/ep01/script.md` 第 3 场后：

> 我读了第 3 场苏锦年与导师的对话。最后一句"我不明白"确实平淡。几个具体改法：
>
> **A)** 苏锦年攥紧实验服下摆："……您让我做的事，我其实已经明白了。"
> *效果：肢体动作暴露紧张，台词表面服从实则暗藏指控——"其实"二字暗示此前装傻是保护色。台词与动作张力更强。*
>
> **B)** 苏锦年沉默三秒，低声："明白。我只是不想明白。"
> *效果：三秒沉默是节奏设计；"明白/不想明白"的并置制造自我矛盾，把外部冲突转为内心挣扎。适合内敛人物。*
>
> **C)** 苏锦年把报告翻到最后一页："这里的数据，您签字时——是明白的吗？"
> *效果：反问把矛头抛回导师，翻页动作让对峙有物理感；让苏锦年显得主动，推进后续冲突。*
>
> 你选哪个？或想换个方向？

**边界：**
- 若意图已在用户输入中充分明确、改动方向明显（如"重新生成苏锦年的图片"）→ 可跳过候选生成，用一句话确认后直接进入阶段 2
- 若多轮仍无共识 → 告知"缺乏方向无法出方案"并结束

### 阶段 2: 协商方案

#### 读文件范围（强制）

LLM 在给出方案前必须读以下文件：

- 用户指向的目标文件（e.g., 用户说"分镜镜头 5" → 读 `story/episodes/ep01/storyboard.md`）
- 候选上游位置的相关文件（按"语义源头"判断；e.g., 改衣服颜色 → 读对应角色的资产 .md 文件）
- 下游评估所需的文件（e.g., 判断 storyboard 是否受资产变更影响 → 扫描 storyboard 对该资产的引用）

不能凭文件名或关键词猜。必读后再诊断。

#### 诊断流程

1. **定位入口**：基于"新内容的语义源头在哪个节点"的判断：
   - 新增剧情/角色 → script 层
   - 角色/物品/场景的全局属性变更（外貌、衣着、身份）→ assets 层
   - 纯视觉/构图/节奏 → storyboard 层
   - 剧情走向（幕结构、钩子）→ outline 层
   - 清单遗漏补齐（剧本已有但清单漏写）→ asset-list 层
   - 图像生成不满意但资产描述不变 → images 层（仅重生）
2. **沿 DAG 向下逐节点评估**：对每个下游候选节点判断"本次改动是否影响它"
3. **给出跳过节点的理由**：不能只说跳过，要解释为什么不影响

#### 方案呈现格式

> ## 方案
>
> **入口**：{节点名}
>
> **改动清单**：
> 1. `[{节点}]` `{文件路径}`：{具体改动描述}
> 2. `[{节点}]` {动作} `{文件路径}`（{本条理由}）
>
> ...
>
> N. `[{节点} review]` 自动跑，失败自动 fix ≤2 轮
>
> **跳过**：
> - {节点 1}、{节点 2}——{跳过原因}
>
> 确认执行？或需要调整？

#### 用户确认

用户可：全盘确认 / 调整清单某条 / 改入口 / 取消。LLM 据反馈更新方案循环呈现，直到用户明确确认 → 进入阶段 3。

#### 边界拒绝

若请求不在下文「级联 DAG」列出的节点范围内（e.g., 修改 `config.md`、`story/arc.md`、全局 `story/outline.md`），告知用户并结束：

> 此请求超出当前 edit skill 范围：{具体原因}。请手动修改 {建议位置}，或使用 {建议工具/流程}。

### 阶段 3: 执行级联

#### 规则

1. 按 DAG 顺序遍历清单（上游 → 下游）
2. 每个清单节点调用对应 skill（见下表）
3. 传给下游 skill 的"修改意见"用方案中的具体描述，不是用户原始输入
4. review 节点仅在同名节点本次有改动时触发
5. review 失败 → 自动调对应 fix skill ≤2 轮；2 轮仍失败 → 记录到阶段 4 摘要并继续后续节点
6. 不在清单中的节点跳过
7. `config.md` 图像模型 = `none` 时，images 节点跳过并在阶段 4 摘要中提示
8. 某节点 skill 调用失败（非 review 失败）→ 该节点终止并中断后续级联（与 review 失败不同，review 失败仅记录继续），在阶段 4 摘要中报错

#### 节点 → skill 对照

| 节点动作 | skill 及参数 |
|---------|------------|
| 修 outline | `short-fix-outline`（`ep01 "{修改意见}"`） |
| 写 script | `scriptwriter-script`（`ep01`） |
| 修 script | `scriptwriter-fix-script`（`ep01 "{修改意见}"`） |
| review script | `director-review-script`（`ep01`） |
| Edit asset-list 清单 | 直接用 Edit 改 `story/episodes/ep01/outline.md` 的「本集资产清单」部分（依据方案中的新增/删除条目；不调用 `storyboarder-asset-list`） |
| 创建资产文件 | `creator-create-assets`（`ep01`） |
| 修资产文件 | `creator-fix-asset`（`{资产文件路径} "{修改意见}"`） |
| 覆盖单张资产图（已知资产路径）| `creator-image-{config 图像模型}`（`"{资产文件路径}"`） |
| 批量生成新增资产图 | `creator-generate-images`（`ep01`） |
| 修 storyboard | `short-fix-storyboard`（`ep01 "{修改意见}"`） |
| review storyboard | `short-review-storyboard`（`ep01`） |

### 阶段 4: 完成

输出摘要：

> ## 修改摘要
>
> **执行：**
> - [x] {节点}: {具体改动}
> - [x] {节点} review: 通过
>
> **跳过：** {节点列表}（{跳过原因汇总}）
>
> **提醒：** 请检查{建议检查项}。

若 review 循环失败，追加：

> - [!] {节点} review: 2 轮 fix 后仍有意见 — "{reviewer 最后反馈}"

若 `config.md` 图像模型 = `none`，追加：

> - images 节点已跳过（`config.md` 图像模型 = `none`）。请手动运行 `/short-video config` 配置图像模型后再用 `/short-edit-story` 触发图像生成。

## 级联 DAG 参考

```
outline（大纲）
   ↓
script（剧本）  ← [若改动则 director-review-script + ≤2 轮 fix]
   ↓
asset-list（资产清单，嵌在 outline.md）
   ↓
assets（资产 .md 文件）
   ↓
images（资产 .png 图片）
   ↓
storyboard（分镜）  ← [若改动则 short-review-storyboard + ≤2 轮 fix]
```

### 入口节点与下游候选

| 入口节点 | 最上游动作 | 下游候选（按需触发） |
|---------|-----------|---------------------|
| outline | `short-fix-outline` | scriptwriter-script → review+fix → asset-list → create-assets → images → storyboard → review+fix |
| script | `scriptwriter-fix-script` | review+fix → asset-list → create-assets → images → storyboard → review+fix |
| asset-list | 直接 Edit `outline.md` 清单 | create-assets → images |
| assets（文字变动）| `creator-fix-asset` | images → short-fix-storyboard（仅引用此资产的镜头）→ review+fix |
| images（仅重生）| `creator-image-{模型}` | 无 |
| storyboard | `short-fix-storyboard` | review+fix |
