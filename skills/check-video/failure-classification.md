# 视频生成失败分类

check-video 仅处理实际生成失败的 status=failed 任务时，根据 fail_reason 的语义归类。
分类由 LLM 基于理解判断，不做机械关键词匹配。

未调用 pending 不是失败：并发停止不能将它改 failed，按独立 initial_authorization 恢复首次提交。遗留 inflight 为未决调用，不能分类成临时失败后重试，须先核实；预留的 retry attempts 不因未知结果而退还。

临时失败的自动重试授权来自该 task 的 `retry_authorization`，不是监控 prompt 或 failed 状态。缺失/耗尽/不符合用户 constraints 时归 human_needed；交互模式取得实际授权后持久化，后续隔离监控才能继续原输入重试。

`querying`/exit 1 是正常等待；`error:reason`/exit 2 是查询或取回错误，保留 submitted 和 submit_id，重试同一任务下载，不进入付费重生分类。已有 MP4 不证明当前 job 成功。

## 可自动重试（retryable）

**特征：** 临时性、外部环境性的生成失败，不改 prompt/参考图/参数，下次提交可能成功。但重提仍可能消耗配额，必须在已有用户重试授权内；failed 状态不产生授权。

常见形态（非穷举，按语义归类）：
- 并发/并行限制（平台同时任务数超限）
- 频率限制（单位时间请求过多）
- 服务端 5xx、超时、网络错误
- 临时队列满、资源暂时不可用
- 响应中明示"请稍后重试"/含 retry-after

## 需人工介入（human_needed）

**特征：** 根因性失败——不修改输入内容（prompt 文字、参考图、时长、比例等），重试只会反复撞墙。

常见形态（非穷举，按语义归类）：
- 内容安全/合规拦截（涉政、涉黄、暴力、侵权等）
- 参数错误（时长/比例/格式不合法）
- 参考图不存在、引用资源缺失
- 模型明确拒绝生成
- 账号余额/配额耗尽、权限问题（即使可"重试"也无意义）
- submission 身份缺失、图片字节漂移、当前 scoped material review 未就绪、重试授权不明。不得自动 capture 或用当前配置替换已存模型/比例。

## 判定规则

1. **LLM 语义判断**，不做硬编码关键词匹配。fail_reason 可能是英文 code（如 `ExceedConcurrencyLimit`）、中文描述、或自由文本，都按含义归类。
2. **不确定时默认人工介入**。若 fail_reason 信息不足以明确判断性质（如 `"Unknown error"`、只有错误码没有描述），归为 human_needed 让用户过目。避免 --auto 模式反复重试根因问题。
3. **每次重新分类**。同一 shot 多次失败时按当次的 fail_reason 重新判断。
4. **auto 只报告人工介入**。创作修改交由用户授权的 Director 委托，不自动修资产、分镜或 sheets。材料接受后才可授权重新准备输入。
