---
name: generate-video
description: 将分镜提示词提交为视频生成任务。读取分镜和资产图片，提交到即梦CLI，异步跟踪任务状态。使用 /generate-video ep01 提交整集，或 /generate-video ep01 镜头3 镜头5 提交指定镜头。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "集数 [镜头N ...]"
---

## 使用示例

```
/generate-video ep01
/generate-video ep01 镜头3 镜头5
/generate-video ep03 镜头1-镜头8
```

## 流程

### 阶段 1: 配置检查

1. 读取 `config.md`，获取 `视频模型` 值
2. 若视频模型为 `none` → 进入视频模型交互式配置流程：
   a. 询问视频模型：A) none B) dreamina
   b. 若选择 none → 提示"已取消"并结束
   c. 若选择 dreamina → 继续询问：
      - 即梦视频模型版本：A) seedance2.0fast（推荐） B) seedance2.0 C) seedance2.0fast_vip D) seedance2.0_vip
      - 视频比例：A) 16:9（推荐） B) 9:16 C) 1:1 D) 其他
      - 视频分辨率：A) 720p（当前仅支持 720p）
   d. 使用 Edit 更新 config.md：将 `视频模型: none` 改为 `视频模型: dreamina`，追加 `## 视频生成配置` 区域

### 阶段 2: 解析参数

1. 从 `$ARGUMENTS[0]` 获取集数（如 `ep01`）
2. 从 `$ARGUMENTS[1..]` 获取可选的镜头列表（如 `镜头3 镜头5`）
3. 读取 `story/episodes/{集数}/storyboard.md`
4. 解析分镜中的所有镜头（`### 镜头 N` 块）
5. 若指定了镜头 → 过滤出目标镜头；否则使用全部镜头

### 阶段 3: 前置检查

1. 从每个目标镜头的 `**引用资产：**` 行提取所有资产链接
2. 将链接路径（如 `../../../assets/characters/张三.md`）转换为图片路径（如 `assets/images/characters/张三.png`）
3. 使用 Glob 检查每个图片是否存在
4. 若有缺失 → 列出缺失清单，提示用户先生成图片（使用 `/series-edit-story 重新生成XXX的参考图片` 或确保图像模型已配置），结束
5. 全部存在 → 继续

### 阶段 4: 显示积分余额

1. 使用 Bash 执行 `dreamina user_credit`，显示当前积分余额

### 阶段 5: 提交任务

1. 读取 `config.md` 获取视频模型值
2. 对每个目标镜头：
   a. 提取引用资产列表，按顺序映射资产链接 → 图片路径
   b. 提取镜头完整 markdown 块
   c. 将 `[资产名](../../../assets/{category}/{name}.md)` 替换为 `[资产名:{图片N}]`
   d. 提取时长（如 `15s` → `15`）
3. 将处理后的镜头信息打包为 JSON
4. 使用 Skill tool 调用 `creator-video-{视频模型值}` skill，传递参数：`{集数} '{镜头JSON}'`

### 阶段 6: 完成

1. 使用 Bash 执行 `dreamina user_credit`，再次显示积分余额
2. 输出提交摘要：提交了 N 个镜头的视频生成任务
3. 提示用户稍后使用 `/check-video {集数}` 查询结果
