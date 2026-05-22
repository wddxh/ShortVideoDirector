# Series Mode: edit-story 专属指南

## 集数解析

1. 从 `$ARGUMENTS` 提取首个 epXX 或"第 X 集"（统一转为 epXX 格式）
2. 资产类请求（如"重新生成苏锦年的图片"）若未指定集数 → 询问用户"该资产变更应更新哪一集的下游内容？"
3. 集数仍无法确定 → 告知并结束，不要默认 ep01

## Phase 2 / 3 专属补充

### 入口节点候选（series）

| 入口节点 | 最上游动作 | 下游候选（按需触发） |
|---------|-----------|---------------------|
| outline | `director-fix-outline`（mode=series） | writer-novel → review+fix → keyframe-prompts → review-script+fix → create-assets → [update-records] → images → assets-visual review+fix → storyboard → review+fix |
| novel | `writer-fix-novel` | review+fix → keyframe-prompts → review-script+fix → create-assets → [update-records] → images → assets-visual review+fix → storyboard → review+fix |
| keyframes | `creator-keyframe-prompts`（incremental, dirty list） | review-script+fix → images → assets-visual review+fix → storyboard → review+fix（若关键帧编排变化引入新资产则同步触发 create-assets / [update-records]） |
| asset-list | 直接 Edit `outline.md` 清单 | create-assets → [update-records] → images |
| assets（文字变动）| `creator-fix-asset` | images → storyboarder-fix-storyboard（仅引用此资产的镜头）→ review+fix |
| keyframe-images（仅重生 + 审）| `creator-fix-asset-image` | assets-visual review（≤2 轮 fix loop 内置）→ storyboarder-fix-storyboard（仅引用此 keyframe 的镜头）→ review+fix |
| images（仅重生）| `creator-image-{模型}` | 无 |
| storyboard | `storyboarder-fix-storyboard` | review+fix |

`[update-records]` 表示仅在集数非 `ep01` 时插入（在 create-assets 之后、images 之前）。

### v1 范围限定（拒绝清单）

以下场景不在 v1 范围，遇到时按 SKILL.md Phase 3 步骤 6 拒绝：
- **跨多集的批量修改**（本 skill 仅支持单集单内容类型）
- 修改 `story/arc.md`（剧情弧线）
- 修改全局 `story/outline.md`（通过修单集大纲间接同步）
- 修改 `config.md`

## Phase 4 节点 → skill 对照（series 专属：novel-trio）

| 节点动作 | skill 调用（Skill / Task 工具按 OC 调度规则）|
|---------|---|
| 修 outline | `director-fix-outline`，参数 `series {ep} "{修改意见}"` |
| 写 novel | `writer-novel`，参数 `{ep}` |
| 修 novel | `writer-fix-novel`，参数 `{ep}` |
| review novel | `director-review-novel`，参数 `{ep}` |
| Edit asset-list 清单 | 直接 Edit `story/episodes/{ep}/outline.md` 「本集资产清单」section（仅作为局部清单补漏；若改动来自关键帧编排变化应走 keyframe-prompts 节点）。Edit 后按 SKILL.md「dedupe 公共逻辑」去重 |
| 修 keyframes | `creator-keyframe-prompts`，参数 `{ep} incremental`。产出后按 dedupe 逻辑同步本集资产清单 |
| review script（叙事/视觉节点覆盖）| `director-review-script`，参数 `series {ep}` |
| 创建资产文件 | `creator-create-assets`，参数 `{ep}` |
| 同步资产档案（**非 ep01**）| `creator-update-records`，参数 `{ep}` |
| 修资产文件 | `creator-fix-asset`，参数 `{资产文件路径} "{修改意见}"` |
| 重生成关键帧 .md | `creator-keyframe-prompts`，参数 `{ep} incremental "{dirty list}"` |
| 覆盖单张资产图 | `creator-image-{config 图像模型}`，参数 `"{资产文件路径}"` |
| 批量生成新增资产 + 关键帧图 | `creator-generate-images`，参数 `{ep}` |
| 修关键帧图（含 prompt 调整 + 重抽）| `creator-fix-asset-image`，参数 `{ep}` |
| review keyframes 画面 | `director-review-assets-visual`，参数 `{ep} --type=keyframes` |
| 修 storyboard | `storyboarder-fix-storyboard`，参数 `{ep}` |
| review storyboard | `director-review-storyboard`，参数 `{ep}` |
| review asset prompts | `director-review-asset-prompts`，参数 `{ep}` |

## Series 级联 DAG 参考

```
outline → novel [review-novel+fix] → keyframe-prompts [review-script+fix]
   → asset-list → assets → [非 ep01: update-records] → images
   [keyframe 图变动: review-assets-visual + ≤2 轮 fix-asset-image]
   → storyboard [review-storyboard+fix]
```

## Series 专属失败模式

- 解析集数错误（资产类请求未澄清就默认 ep01）
- 非 ep01 漏插 `creator-update-records`
- 修了本集 outline 但忘了让 director-fix-outline 同步 `story/outline.md`
- 跨多集请求被误接纳（应直接拒绝并指向"分集逐个执行"）
- 修 arc.md / config.md 被误接纳
