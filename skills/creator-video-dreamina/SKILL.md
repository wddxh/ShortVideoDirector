---
name: creator-video-dreamina
description: 使用即梦 CLI 提交已登记 pending 视频任务并维护状态。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash
model: sonnet
---

## 输入

- `config.md`
- `story/episodes/$ARGUMENTS[0]/videos/tasks.json`
- `$ARGUMENTS[0]`：ep；`$ARGUMENTS[1..]`：shot 编号或 `all`

## 约束

- 只处理已登记且 status=`pending` 的记录。
- 只更新 `submit_id`、`status`、`fail_reason`；不得修改 prompt/images/duration。
- 禁止测试性、调试性或未登记提交。

## 流程

1. 执行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/detect-legacy-kf.sh "{ep}" "{storyboard}" "{tasks}"`。失败立即原码停止，旧持久任务不得提交。
2. 读取即梦视频模型、比例、分辨率并执行 `dreamina user_credit`。
3. 按 tasks.json 顺序过滤目标 pending 记录。非 pending 和未登记 shot 输出提示并跳过。
4. 对每条记录验证 prompt、duration 和 images 非空，images 第一项为当前 `assets/images/storyboard-sheets/{ep}/shotNN.png`，且每张图存在。
5. 将 tasks.json 中的 `images` 原顺序直接传入：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/video-gen-dreamina.sh "{prompt}" "story/episodes/{ep}/videos/shot{NN}.mp4" "{images}" "{duration}" "{比例}" "{模型版本}"
```

6. `SUBMITTED id` 转为 submitted；`FAIL reason` 转为 failed。每次写前 Read 最新 tasks.json，仅替换本 shot 的三个状态字段。
7. 并发限制出现时停止提交，并将尚未处理的目标 pending 标为 failed/retryable，保留其原 prompt/images/duration 与原顺序。

## 输出

返回成功、失败、跳过数量和 provider 原始失败原因。
