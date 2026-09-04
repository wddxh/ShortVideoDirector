---
name: series-video
description: 多集系列视频入口。检测项目状态（新故事 / 续写），写入 mode 标记，dispatch generate-episode-pipeline 完成本集生成。使用 /series-video 启动，/series-video config 编辑配置。
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Bash, Task
model: opus
argument-hint: "[故事材料|文件路径]"
---

## 职责（薄壳）

本 skill 仅做 4 件事：配置加载 → mode 检测 → ep 解析 → dispatch `generate-episode-pipeline`。
所有真正的流水线工作（plot/outline/novel/script/assets/storyboard/sheets/review）都在 pipeline skill 内执行，本入口不直接调用任何 sub-skill。

**硬性约束：每次调用仅生成一集内容。**

## 阶段 1：配置加载

1. Read `config.md`
2. 若不存在 → 参考 [config-template.md](config-template.md) 进入交互式配置引导（逐项询问，每次只问一个），生成 `config.md` 写入项目根目录
3. **mode 写入**：检查 `config.md` 是否含 `- mode:` 字段
   - 无 → 用 Edit 在「## 模型配置」区域追加一行 `- mode: series`
   - 有但值非 `series` → 报错停止（项目模式冲突）

## 阶段 2：特殊命令

若 `$ARGUMENTS` 第一个 token 为 `config`：Read 展示 `config.md`，询问是否编辑。流程结束。

## 阶段 3：mode + ep 检测

```bash
COUNT=$(ls -d story/episodes/ep* 2>/dev/null | wc -l)
```

- `COUNT = 0` → `mode='new-series'`, `ep='ep01'`
- `COUNT > 0` → `mode='continue-series'`, `ep=$(bash ${CLAUDE_PLUGIN_ROOT}/scripts/latest-episode.sh | awk -F'ep' '{printf "ep%02d", $2+1}')`

若 `latest-episode.sh` 非零退出但 COUNT>0，报错停止。

## 阶段 4：总集数检测（mode='new-series' only）

1. 用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "总集数"` 读 config 总集数值 (整数 N)
2. 若 `mode='new-series'` 且 N == 1 (默认值) → 问用户:
   > 本剧总集数 (整数, 例: 20):
3. 用户回复 N (≥2) → 用 Edit 把 config.md 中 `- 总集数: 1` 改为 `- 总集数: <N>`
4. 若 N > 1 → 不动 (用户已设)
5. mode='continue-series' → 跳过本阶段

## 阶段 5：输入解析

`$ARGUMENTS` 整体作为故事材料候选：
- 空 → `story_input=''`
- 以 `.txt` / `.md` 结尾 → Read 文件内容
- 否则 → 内联文本

## 阶段 6：Dispatch

使用 Skill tool 调用 `generate-episode-pipeline`，prompt 模板：

```
加载并执行 skill generate-episode-pipeline。

参数：
- mode: {mode}        # 'new-series' 或 'continue-series'
- ep: {ep}            # 如 'ep01' / 'ep03'
- story_input: |
    {story_input}     # 用户故事材料，可空
```

dispatch 后等待返回。失败处理见下。

## 失败处理（核心规则）

**sub-agent task 失败后，永远不要在主 session 自己接管本应由 sub-agent 做的工作。**

1. 分析失败原因
2. 可修复 → 用修正参数重新派发同一 sub-agent
3. 不可修复 → 将原因与已尝试方案返回用户，停止流程

## 版权规避

所有生成内容不得出现现实明星 / 公众人物 / 真实地名 / 商标，必要时使用虚构替代名称。该约束由 pipeline 内各 sub-skill 自行执行，本入口仅在此提示一次。
