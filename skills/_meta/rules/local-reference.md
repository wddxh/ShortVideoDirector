# 本地制作参考契约

基础/衍生资产卡可省略本节；不使用本地参考时不要添加空声明。需要时添加唯一的 `## 本地制作参考`，正文含且仅含一个 fenced `json` 块，块外自然语言说明用途：

````markdown
## 本地制作参考
```json
{"images":["references/shot/layout.png"],"sources":["references/shot/scene.py"]}
```
layout.png 控制门窗邻接、通道宽度和本视角遮挡；灰色盒体表示主体尺度与站位。
````

示例不是必需目录或场景模板。JSON 仅有 `images`、`sources` 两个字段；两者均为非空、各自唯一且有序的路径数组。路径从故事项目根起，必须是 `references/` 下 canonical 相对路径：使用 `/`，无绝对路径、空段、`.`、`..`、反斜杠、逗号或控制字符。`images` 仅用小写 `.png` 后缀；实际须可读为 PNG。`sources` 列实际用于制作/修改的工程、脚本及所需纹理、字体、导入素材等输入，不是只留一份说明或不完整启动脚本。

可保留 `.blend`、SVG/分层文件、任意 `bpy` 等源码；所需外部资源须打包进工程或放在 `references/` 并列明。PNG 是卡片的模型输入；源码是编辑与审核依据，不自动上传。MP4 不能填入本卡 images，但可按 [shot-inputs.md](shot-inputs.md) 显式作为最终 shot 输入的 video reference；不是付费成片或完成记录。卡片声明与 shot manifest 是两个不同协议，不互相自动上传。

自然语言只说明每张图控制的布局/形体/相机/状态及占位权限。该段作为 `narrative` 保留，不在 JSON 新增 narrative 字段，也不重复风格基线或动作剧情。没有语义说明可能造成占位误用；parser 允许空 narrative 不代表质量合格。无需 sidecar、资产 ID 或新 hash registry。

## 读取与执行

粗模参考遵循 [结构控制与外观依据分离](visual-prompt-craft-common.md)：narrative 声明形态/构图等控制权限；资产绑定与目标描述提供身份、材质和渲染依据。Creator 提供作品级美术基线，基础图像 prompt 写适用风格；Storyboarder 将基线整合进源 shot 的 `视频风格`，每条请求表达一次。转换器不自动注入风格。

所有图片读取和操作遵循 [图像上下文与预览规则](visual-context.md)，每次使用全新 task，以文本/文件交接。实际看图只 Read helper 的缩略图或必要局部预览，原 PNG 仍用于 provider 与 inputs 指纹；临时派生图不写入卡片 images/sources，不替换制作参考。

在故事项目根运行，CARD 是当前资产卡路径：

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/local-reference.mjs" parse "{CARD}"
node "${CLAUDE_PLUGIN_ROOT}/scripts/local-reference.mjs" ready "{CARD}"
```

两者返回 `{images,sources,narrative}`，无声明返回 `null`；失败为 exit 1。parse 校验声明而不要求文件存在；ready 另检查每个实际文件存在且 realpath 不越出项目 `references/`，不接受目录或越界 symlink。ready 不解码 PNG、不运行源码，也不证明视觉质量或素材依赖完整。

基础卡由 Creator 把同实体/衍生基础等必需资产 refs 放在前面，再按声明顺序追加本地 images，每张恰好一次且为精确后缀。最终基础 prompt 显式说明实际有序参考的对应关系，并包含本地 narrative 的完整控制意图与占位边界；只给路径或卡片链接不足以绑定图片。wrapper 不自动提取/拼接这段文字，调用方须提交已审核的完整文本；不得到付费前临时改写未审核提示。

## 独立审核

声明的本地 PNG/源码是已经制成的参考。asset-prompt 须实际看这些 PNG、读取源码并按需检查可编辑工程/输入，核对控制目标、占位边界和最终请求绑定；不要求未来生成目标 PNG 先存在。asset-visual 比较本地参考和目标图，另按规则读取必要直接参考。

两类资产证据的 inputs 包含声明的所有 images/sources，沿用 review 前后 fingerprint 与独立 Director 上下文，不另建哈希账本。helper 不判断源码完整性或视觉意图。缺文件、无法查看必要参考或输入漂移为 unknown；具体冲突为 needs_revision。源码/PNG 变化交 Director 评估实际依赖并协调重审，不自动递归重生。独立上下文不可用则阻塞，作者自检不是 pass。
