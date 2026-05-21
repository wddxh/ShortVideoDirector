---
name: short-video
description: 单集短视频入口。写入 mode 标记，dispatch generate-episode-pipeline (mode=short) 完成单集生成。使用 /short-video 启动，/short-video config 编辑配置。
user-invocable: true
agent: director
allowed-tools: Read, Write, Edit, Glob, Bash, Task
model: opus
argument-hint: "[故事材料|文件路径]"
---

## 职责（薄壳）

本 skill 仅做 3 件事：配置加载 → 输入解析 → dispatch `generate-episode-pipeline` (mode='short', ep='ep01')。
所有真正的流水线工作都在 pipeline skill 内执行。

**硬性约束：每次调用生成一个完整单集短视频。**

## 阶段 1：配置加载

1. Read `config.md`
2. 若不存在 → 参考 [config-template.md](config-template.md) 进入交互式配置引导（逐项询问），生成 `config.md`
3. **mode 写入**：检查 `config.md` 是否含 `- mode:` 字段
   - 无 → 用 Edit 在「## 模型配置」区域追加一行 `- mode: short`
   - 有但值非 `short` → 报错停止（项目模式冲突）

## 阶段 2：特殊命令

若 `$ARGUMENTS` 第一个 token 为 `config`：Read 展示 `config.md`，询问是否编辑。流程结束。

## 阶段 3：总集数保底

1. 用 `bash scripts/read-config.sh "总集数"` 读 config 总集数值
2. 字段缺失 → 用 Edit 在 config.md 的「## 创作配置」段顶部追加 `- 总集数: 1`
3. 字段已存在 → 不动 (尊重用户配置)

## 阶段 4：输入解析

`$ARGUMENTS` 整体作为故事材料：
- 空 → `story_input=''`
- 以 `.txt` / `.md` 结尾 → Read 文件内容
- 否则 → 内联文本

## 阶段 5：Dispatch

使用 task tool 派发到 `generate-episode-pipeline`（agent: director），prompt 模板：

```
加载并执行 skill generate-episode-pipeline。

参数：
- mode: short
- ep: ep01
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
