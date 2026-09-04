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

`basic` 和 `paths` 中的基础资产按基础卡再衍生卡的依赖顺序处理：基础资产 text2image，衍生资产读取基础资产图片后 image2image。调用 `image-gen-dreamina.sh`，不截断引用。每档必须消化 pending 后才能进入下一档。

## Storyboard Sheets

`storyboard-sheets` 和 `paths` 中的 sheet 卡按 shot 数字顺序交给现有串行 coordinator：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/generate-storyboard-sheets-dreamina.sh "{图片分辨率}" "{模型版本}" {cards...}
```

Coordinator 固定 16:9 sheet 画布、验证全部基础引用和可选前镜 sheet、跳过已有 PNG，并在第一个失败或 pending 处停止。不得绕过 coordinator 单独生成后续 shot。

若返回 `PENDING <id> <card> <output>`，每 30 秒调用 `dreamina query_result`，最多 5 轮：成功则把下载文件移动到 output 后重新调用 coordinator，靠已有 PNG 断点续跑；失败则记录 provider 原因并停止；仍 querying 则写入 `assets/images/pending.json` 后停止，不启动后续 shot。再次执行时先处理 pending.json 中对应 output，成功落盘后再从第一张缺失 PNG 续跑。

生成前和完成后删除 `assets/images/storyboard-sheets/{ep}/` 下没有 canonical card 的 orphan sheet PNG。

## Pending 持久化

每条为：

```json
{"submit_id":"abc","output_path":"assets/images/storyboard-sheets/ep01/shot02.png","asset_name":"shot02","card_path":"assets/storyboard-sheets/ep01/shot02.md"}
```

写入时 Read 最新数组并保持其他任务。终态后删除对应条目。

## 输出

按 scope 返回成功、跳过、失败、pending 数量及原始失败原因。
