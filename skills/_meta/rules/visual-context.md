# 图像上下文与预览规则

## 每次使用全新任务

由主任务新建并明确委托本次图像操作的子任务，本身就是所需的新上下文，可直接执行该操作；不需要再派一个子任务证明隔离。工具知识的读取不消耗这个资格。仅当需要开始另一个图像操作或继续先前已有的图像任务时，才将成果交回协调方，请其新建下一任务。已确认不能嵌套时不重试 Task；不能把一次有限操作拆成无限递归委托。

所有图片读取或操作均须使用全新 task 上下文，不限于独立审核：包括参考查看、生成/渲染、作者自检、诊断、修订、裁剪和动画采样。每次仅委托一个明确操作和最小必要图集；跨图比较只带必要配对，不附全部历史图片。后续读取、细节 crop、修改后再看或重审也另开新 task，不恢复已有图像上下文继续积累图片。

通过文本结论、材料/源码路径、当前版本指纹、必要约束和未决问题交接，不继承图像消息或制作历史。协调任务只接收文本/文件交付，可恢复其纯文本协调上下文；不得恢复 image-heavy task 处理下一次图片操作。独立审核仍须新建 Director reviewer，作者自检不提供独立性。Task 不可用时请求主 AI relay；仍不能提供所需新上下文则报告阻塞，审核保持 unknown，不在当前上下文代看或自审。

## 先缩略图，再必要细节

原始图片（包括 2K/4K）绝不直接交给 Read 或其他模型图像读取入口；低分辨率源也先走 helper。原图保留作 provider 输入、可编辑制作依据和原字节 fingerprint，不能用审核缩略图替换。实际查看前核实指定临时目录的父目录，再运行：

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/visual-review-TASK
```

SOURCE 是实际源文件路径；临时目录按本次任务指定，不写入 story/assets/references。成功返回 JSON：`source`、`source_sha256`、`source_size`、`preview`、`preview_sha256`、`preview_size`、`crop`。只 Read 返回的 `preview`。默认长边 1024，`--max-edge` 允许 1..1280，保持比例且不放大小图；不得通过其他工具把整张原图送入上下文绕过限制。失败先处理依赖/输入问题，不退回直接 Read 原图。

缩略图不足以判断必要细节时，将具体问题和坐标交全新 task，仅裁剪所需局部：

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/visual-detail-TASK --crop X Y WIDTH HEIGHT
```

坐标是 EXIF 校正后原图像素坐标，结合 source_size/preview_size 换算。Crop 在原图内，仍限制长边，只 Read 返回 preview。不以全图 crop 或拼接局部重建高分辨率图绕过规则。仅补相关细节，使用最小必要图集/边界配对，不自动加载整套帧。必要目标分派新任务覆盖，不省略审核；无法核实必要条件则说明限制并保持 unknown。

## 动画与证据

动画 GIF 和其他多帧图片不能静默取首帧冒充缩略图；helper 会拒绝此类输入。需要时在全新任务中用适当工具显式抽取有意义的采样帧到指定临时目录，记录原文件/指纹、帧编号或时间点及抽取方式；各次查看仍按上述新任务和缩略图规则，只带最小必要帧集。披露只看采样帧的时间覆盖与运动/时序判断限制，不能据此证明完整动画连续性。此 helper 不是时序验证器，也不新增最终视频审核权限。

审核前后仍按 review-meta-rules 对原材料 fingerprint，`result.inputs` 保留原文件路径与整文件 SHA-256。可选 `result.visual_inspection` 数组可保存每次 helper 的真实 JSON（含源 hash、preview 路径/hash 和 crop），另说明实际查看范围/限制；动画帧另保留到原动画的采样映射。此字段仅记录派生查看证据，不替换或刷新 inputs 的原图哈希，不新增 sidecar 或验收状态。

## 写入例外与实际边界

审核者只写受托 review record（single/impact 仍只返回结果），唯一派生文件例外是：可在委托明确指定的 `/tmp/opencode/...` 临时目录生成本次必要缩略图、局部 crop 或显式采样帧。不得修改原图、卡片、源码、工程或其他生产材料，不把临时派生图登记为制作输出；Bash 权限不扩大此范围。

这些约束由任务执行者遵守。Helper 校验自身调用中的缩放上限、源文件与派生输出；插件不机械拦截直接 Read，也不强制新 task。协调方须确认实际委托上下文与查看方式，不能将 helper 成功视为已满足全部隔离和审核要求。
