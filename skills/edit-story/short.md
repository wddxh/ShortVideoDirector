# Short Mode: edit-story 专属指南

## 集数解析

- 集数硬编码为 `ep01`（单集短视频只有一集，永不询问，不解析 $ARGUMENTS 中的 epXX）
- 即便用户输入含 "ep02" 等也忽略集数提示，按 ep01 处理（必要时在 Phase 2 候选阶段提示用户："short 模式仅有 ep01"）

## Phase 2 / 3 专属补充

### 入口节点候选（short）

| 入口节点 | 最上游动作 | 下游候选（按需触发） |
|---------|-----------|---------------------|
| outline | `director-fix-outline`（mode=short） | scriptwriter-script → review+fix → keyframe-prompts → review-script+fix → create-assets → images → assets-visual review+fix → storyboard → review+fix |
| script | `scriptwriter-fix-script` | review+fix → keyframe-prompts → review-script+fix → create-assets → images → assets-visual review+fix → storyboard → review+fix |
| keyframes | `creator-keyframe-prompts`（incremental, dirty list） | review-script+fix → images → assets-visual review+fix → storyboard → review+fix（若关键帧编排变化引入新资产则同步触发 create-assets） |
| asset-list | 直接 Edit `outline.md` 清单 | create-assets → images |
| assets（文字变动）| `creator-fix-asset` | images → storyboarder-fix-storyboard（仅引用此资产的镜头）→ review+fix |
| keyframe-images（仅重生 + 审）| `creator-fix-asset-image` | assets-visual review（≤2 轮 fix loop 内置）→ storyboarder-fix-storyboard（仅引用此 keyframe 的镜头）→ review+fix |
| images（仅重生）| `creator-image-{模型}` | 无 |
| storyboard | `storyboarder-fix-storyboard` | review+fix |

**关键差异**：short 模式下游绝不插入 `creator-update-records`（单集无跨集出场记录概念）。

### v1 范围限定（拒绝清单）

以下场景不在 v1 范围，遇到时按 SKILL.md Phase 3 步骤 6 拒绝：
- 修改 `story/arc.md`（short 无 arc，但兜底拒绝）
- 修改全局 `story/outline.md`（short 无此文件，兜底拒绝）
- 修改 `config.md`

（short 模式无"跨多集批量"概念，无须该项拒绝。）

## Phase 4 节点 → skill 对照（short 专属：script-trio）

| 节点动作 | skill 调用（Skill / Task 工具按 OC 调度规则）|
|---------|---|
| 修 outline | `director-fix-outline`，参数 `short ep01 "{修改意见}"` |
| 写 script | `scriptwriter-script`，参数 `ep01` |
| 修 script | `scriptwriter-fix-script`，参数 `ep01` |
| review script | `director-review-script`，参数 `short ep01` |
| Edit asset-list 清单 | 直接 Edit `story/episodes/ep01/outline.md` 「本集资产清单」section（仅作为局部清单补漏；若改动来自关键帧编排变化应走 keyframe-prompts 节点）。Edit 后按 SKILL.md「dedupe 公共逻辑」去重 |
| 修 keyframes | `creator-keyframe-prompts`，参数 `ep01 incremental`。产出后按 dedupe 逻辑同步本集资产清单 |
| 创建资产文件 | `creator-create-assets`，参数 `ep01` |
| 修资产文件 | `creator-fix-asset`，参数 `{资产文件路径} "{修改意见}"` |
| 重生成关键帧 .md | `creator-keyframe-prompts`，参数 `ep01 incremental "{dirty list}"` |
| 覆盖单张资产图 | `creator-image-{config 图像模型}`，参数 `"{资产文件路径}"` |
| 批量生成新增资产 + 关键帧图 | `creator-generate-images`，参数 `ep01` |
| 修关键帧图（含 prompt 调整 + 重抽）| `creator-fix-asset-image`，参数 `ep01` |
| review keyframes 画面 | `director-review-assets-visual`，参数 `ep01 --type=keyframes` |
| 修 storyboard | `storyboarder-fix-storyboard`，参数 `ep01` |
| review storyboard | `director-review-storyboard`，参数 `ep01` |
| review asset prompts | `director-review-asset-prompts`，参数 `ep01 {scope}`（scope=basic 仅审 character/location/item/building；scope=keyframes 仅审 keyframes；缺省=全部，**仅在 dedup 不出问题时使用**）|

**注意**：无 `creator-update-records` 行 —— short 模式永不触发。

## Short 级联 DAG 参考

```
outline → script [review-script+fix] → keyframe-prompts [review-script+fix 二轮]
   → asset-list → assets → images
   [keyframe 图变动: review-assets-visual + ≤2 轮 fix-asset-image]
   → storyboard [review-storyboard+fix]
```

（与 series DAG 唯一差异：novel→script 替换，且无 `[非 ep01: update-records]` 步骤。）

## Short 专属失败模式

- 误调用 `writer-novel` / `writer-fix-novel`（应走 script-trio）
- 误插入 `creator-update-records`（短视频永不需要）
- 误传 mode 参数给 director-review-storyboard / storyboarder-fix-storyboard（这两个 skill 模式无关，统一入口）
- 误接纳 arc.md / 全局 outline 类请求（应拒绝）
- 接纳 "ep02 …" 请求并真的去找该集（应忽略并提示用户）
