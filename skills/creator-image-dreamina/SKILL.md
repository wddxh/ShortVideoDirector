---
name: creator-image-dreamina
description: 使用即梦 CLI 按 scope 生成基础资产或串行 storyboard sheets，并处理 pending。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Glob, Bash
model: sonnet
---

## 动态参数

- `$ARGUMENTS[0]`：`basic`、`storyboard-sheets` 或 `paths`
- `storyboard-sheets` 后接 `{ep} {card...}`；其他 scope 后接 `{card...}`

## 准备

读取 `config.md` 的即梦模型版本、图片比例和分辨率，执行 `dreamina user_credit` 检查登录。严禁测试性调用付费生成。

## 基础资产

`basic` 和 `paths` 中的基础资产按基础卡再衍生卡的依赖顺序处理：基础资产 text2image，衍生资产读取基础资产图片后 image2image。调用 `image-gen-dreamina.sh`，不截断引用。

## Basic Pending 状态合同

```json
{
  "tuple": ["submit_id", "asset_path", "output_path"],
  "statuses": ["success", "fail", "querying"],
  "max_rounds": 5,
  "persist_path": "assets/images/pending.json",
  "advance_when_pending": false,
  "resubmit_pending": false
}
```

每档提交时：exit 0 记录成功；exit 1 记录失败；exit 2 的 `PENDING id` 解析为上述 tuple，加入本档待查集合。不得再次调用 image wrapper 提交该 tuple。

本档提交结束后才轮询：每 30 秒对 tuple 调用 `dreamina query_result --submit_id={id} --download_dir=/tmp/dreamina-pending`。`success` 将 `{id}_image_1.png` 移到 output_path 并移除；`fail` 记录 provider 原因并移除；`querying` 保留。最多 5 轮。

5 轮后仍 querying 时，Read `assets/images/pending.json`（不存在为 `[]`），按 submit_id 去重写入 `{submit_id,output_path,asset_name,asset_path}`。本档仍有 querying 时停止本次 skill，不进入衍生档；下次先恢复 pending.json，查询终态后才考虑新提交，避免重复付费。

只有本档 pending 全部 success/fail 终态后才进入下一档。`paths` 混合输入同样先基础资产、再衍生资产、最后 sheet cards。

## Storyboard Sheets

`storyboard-sheets` 和 `paths` 中的 sheet 卡按 shot 数字顺序交给现有串行 coordinator：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/generate-storyboard-sheets-dreamina.sh "{图片分辨率}" "{模型版本}" {cards...}
```

当 scope=`paths` 且输入为明确 sheet cards 时使用：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/generate-storyboard-sheets-dreamina.sh "{图片分辨率}" "{模型版本}" --force {cards...}
```

`--force` 只传 targeted sheet cards。基础资产 paths 不使用此 flag。

Coordinator 固定 16:9 sheet 画布、验证全部基础引用和可选前镜 sheet、跳过已有 PNG，并在第一个失败或 pending 处停止。不得绕过 coordinator 单独生成后续 shot。

若返回 `PENDING <id> <card> <output>`，每 30 秒调用 `dreamina query_result`，最多 5 轮：成功则把下载文件移动到 output 后重新调用 coordinator，靠已有 PNG 断点续跑；失败则记录 provider 原因并停止；仍 querying 则写入 `assets/images/pending.json` 后停止，不启动后续 shot。再次执行时先处理 pending.json 中对应 output，成功落盘后再从第一张缺失 PNG 续跑。

`pending success resume: no --force`：targeted 首次调用可带 `--force`；pending 成功移动 output 后，续跑 coordinator 必须去掉 `--force`，保留刚落盘图并从下一缺失 shot 继续。

生成前和完成后删除 `assets/images/storyboard-sheets/{ep}/` 下没有 canonical card 的 orphan sheet PNG。

## Pending 持久化

每条为：

```json
{"submit_id":"abc","output_path":"assets/images/storyboard-sheets/ep01/shot02.png","asset_name":"shot02","card_path":"assets/storyboard-sheets/ep01/shot02.md"}
```

写入时 Read 最新数组并保持其他任务。终态后删除对应条目。

## 输出

按 scope 返回成功、跳过、失败、pending 数量及原始失败原因。Sheet 调用记录本次 provider 生成成功或 pending 下载成功且已落盘的 shots；历史 existing skip 不计入，只输出：

```text
successful shots: shotNN ... | none
```

Provider FAIL/pending 未落盘和未请求 shots 不进入该集合。
