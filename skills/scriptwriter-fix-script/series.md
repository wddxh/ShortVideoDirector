# Series Mode: scriptwriter-fix-script 专属指南

## 额外上下文读取
- `story/episodes/{ep}/novel.md` — 必读 (本集文学素材库，校对台词/动作纹理是否仍贴合原 novel)
- `story/arc.md` — 必读 (识别本集所推进的 arc 节点 + 该节点的人物弧)
- mode='continue-series': 上一集 `story/episodes/{prev_ep}/script.md` 末场景 (验证开场承接未被破坏)

## Phase 3: Series 专属修正点

### 改对白 / 内心独白
- 角色声音必须对照 `assets/characters/{name}.md` 的「声音特征」字段——改之前重读
- 若 novel 中该场景有同角色对白细节，新台词不能与 novel 的语气基调脱节 (允许提炼，不允许改人设)
- 主角内心独白若被改动，校对其是否仍反映本集 arc 节点上的人物弧位置

### 改场景结构 / 主要事件
- 改场景前回查 outline.md「在 arc 中的位置」字段——本集仍须推进该 arc 节点
- 若修正实质上让某场景不再服务 arc 节点推进，须在 outline 同步登记 (但本 skill 不动 outline，需通过上游 workflow 触发 director-fix-outline)
- 改场景导致 novel 中对应段落的视觉细节失效时，标注 (本 skill 不动 novel，需上游触发 writer-fix-novel)

### 改集尾钩子相关场景
- 钩子是"留给下一集的戏剧悬念"——改最后场景时确保仍具象化承载 outline.md 末尾「集尾钩子」字段所述悬念
- 不能把钩子改成旁白 / 字幕，必须是可拍画面 / 对白 / 动作

### 改跨集承接场景 (continue-series, 仅本集第一场景)
- 第一场景须与上一集 script.md 末场景在时空 / 情绪 / 角色状态上自然衔接
- 改首场景前比对上集末，避免硬切日常或与上集集尾钩子矛盾

## Series 专属失败模式
- **改台词丢失角色声音特征**: 套用通用对话腔调，角色辨识度崩塌 → 改前重读 character 资产「声音特征」
- **修正打破 arc 推进**: 改后场景不再服务本集 arc 节点 → fix 完成前回查 outline「在 arc 中的位置」
- **集尾钩子被弱化**: 修正最后场景时把钩子写成"主角思考"或下集见 → 钩子必须留可视化悬念
- **跨集承接断裂**: 改首场景未对照上集末，时空/情绪硬切 → continue-series 必读上集末场景
- **与 novel 脱节**: 改场景后台词 / 动作纹理与 novel 完全不一致，丢失文学层价值
