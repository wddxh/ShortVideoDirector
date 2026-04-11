# 视频生成工作流 设计文档

> **执行方式：** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。

**目标：** 利用即梦CLI的 multimodal2video（全能参考）模式，将分镜提示词和资产参考图片转化为视频片段。用户手动触发，完全异步。

**架构：** 两个用户可调用 skill（`generate-video` 提交任务 + `check-video` 查询结果），三层抽象（入口 skill → 模型 skill → 脚本），异步任务通过 tasks.json 文件跟踪。

---

## 1. 用户入口

### 1.1 `/generate-video`（提交视频生成任务）

```
/generate-video ep01                    # 整集所有镜头
/generate-video ep01 镜头3 镜头5        # 指定镜头
```

不区分 series/short，统一要求传入集数。

### 1.2 `/check-video`（查询视频生成结果）

```
/check-video ep01                       # 查询该集所有任务状态
```

## 2. 三层抽象

### 2.1 入口 skill（`generate-video`，用户可调用）

- 读取 `config.md` 获取视频模型值，若为 `none` → 进入视频模型交互式配置流程（询问模型版本、视频比例、视频分辨率），将结果写入 config.md（更新视频模型为 `dreamina` + 追加 `## 视频生成配置` 区域），然后继续执行
- 读取 `story/episodes/{集数}/storyboard.md`，解析目标镜头
- 前置检查：扫描所有目标镜头引用的资产图片（`assets/images/{category}/{name}.png`），全部存在才继续，缺失则列出清单并提示用户先生成图片
- 显示当前积分余额（`dreamina user_credit`）
- 使用 Skill tool 调用 `creator-video-{模型值}` skill 提交任务
- 提交完毕后再次显示积分余额
- 输出提交摘要，提示用户稍后用 `/check-video` 查询结果

### 2.2 模型 skill（`creator-video-dreamina`，不可用户调用）

- 读取 `config.md` 中 `## 视频生成配置` 获取模型版本、视频比例、视频分辨率
- 登录检查（`dreamina user_credit`）
- 对每个目标镜头：
  1. 从分镜内容中提取引用资产列表，按顺序映射为 `{图片1}`、`{图片2}`...
  2. 构造 prompt：整个镜头 markdown 块，将 `[角色名](../../../assets/characters/角色名.md)` 替换为 `[角色名:{图片N}]`
  3. 收集对应的图片文件路径列表
  4. 从分镜中提取时长（如 `15s` → `15`）
  5. 调用脚本 `bash scripts/video-gen-dreamina.sh "{prompt}" "{输出路径}" "{图片路径列表}" "{时长}" "{比例}" "{模型版本}"`
  6. 脚本立即返回 `submit_id`
- 将所有任务记录到 `story/episodes/{集数}/videos/tasks.json`：
  ```json
  [
    {"shot": 1, "submit_id": "xxx", "status": "submitted"},
    {"shot": 2, "submit_id": "yyy", "status": "submitted"}
  ]
  ```

### 2.3 查询 skill（`check-video`，用户可调用）

- 读取 `story/episodes/{集数}/videos/tasks.json`
- 逐个使用 Bash 调用 `dreamina query_result --submit_id={id} --download_dir={临时目录}` 查询
- 根据 `gen_status` 处理：
  - `success` → 下载视频 mv 到 `story/episodes/{集数}/videos/shot{NN}.mp4`，更新 tasks.json 中 status 为 `done`
  - `querying` → 保持 status 为 `submitted`，显示仍在排队
  - `fail` → 更新 status 为 `failed`，进入失败处理流程
- 输出整体进度摘要（完成 N 个 / 排队 N 个 / 失败 N 个）

**失败处理流程：**
1. 展示 `fail_reason` 原文
2. 询问用户："您有修改建议吗？或者交给我自行判断如何修复"
3. 用户有建议 → 按建议调用相应 skill（如 `storyboarder-fix-storyboard`、`short-fix-storyboard`、`creator-fix-asset` 等）修改内容
4. 用户没建议 → skill 自行分析 `fail_reason`，判断调用哪个 skill 修改
5. 修改完后自动重新提交该镜头（调用 `creator-video-{模型值}` skill），更新 tasks.json

### 2.4 脚本（`scripts/video-gen-dreamina.sh`）

**输入参数：**
- `$1` — prompt（替换后的镜头块）
- `$2` — 输出视频文件路径（预留，脚本本身不下载）
- `$3` — 图片路径列表（逗号分隔）
- `$4` — 时长（秒）
- `$5` — 比例（如 `16:9`）
- `$6` — 模型版本（如 `seedance2.0fast`）

**行为：**
1. 拆分 `$3` 为多个 `--image` 参数
2. 调用 `dreamina multimodal2video --image ... --prompt="$1" --duration=$4 --ratio=$5 --video_resolution=720p --model_version=$6`（不带 `--poll`，立即返回）
3. 解析返回 JSON：
   - 提取 `submit_id` 和 `gen_status`
   - `gen_status` 为 `fail` → 输出 `FAIL {fail_reason}`，exit 1
   - 否则 → 输出 `SUBMITTED {submit_id}`，exit 0

**退出码：**
- `0` — 提交成功，stdout 输出 `SUBMITTED {submit_id}`
- `1` — 提交失败

## 3. Prompt 构造

每个镜头的完整 markdown 块直接作为 prompt，仅替换引用资产中的 md 链接：

**替换前：**
```markdown
- **引用资产：** [林知意](../../../assets/characters/林知意.md)、[唐代铜镜](../../../assets/items/唐代铜镜.md)、[考古实验室](../../../assets/locations/考古实验室.md)
```

**替换后：**
```markdown
- **引用资产：** [林知意:{图片1}]、[唐代铜镜:{图片2}]、[考古实验室:{图片3}]
```

对应 `--image` 传入顺序：
```
--image assets/images/characters/林知意.png
--image assets/images/items/唐代铜镜.png
--image assets/images/locations/考古实验室.png
```

画面描述中的角色名保持原样，模型通过引用资产区域的 `[名称:{图片N}]` 建立名字和图片的对应关系。

## 4. config 变更

启用视频模型配置：

**交互式引导新增项：**

**视频模型选择：**
- A) none（不生成视频）
- B) dreamina（即梦）

若选择 dreamina，继续询问：

**即梦 — 视频模型版本：**
- A) seedance2.0fast（推荐，速度更快）
- B) seedance2.0（标准）
- C) seedance2.0fast_vip（VIP 加速）
- D) seedance2.0_vip（VIP 标准）

**即梦 — 视频比例：**
- A) 16:9（推荐，横屏）
- B) 9:16（竖屏，短视频常用）
- C) 其他

**即梦 — 视频分辨率：**
- A) 720p（当前仅支持 720p）

**config.md 模板示例（选择 dreamina 时）：**
```markdown
## 模型配置
- 视频模型: dreamina           # none / dreamina
- 图像模型: dreamina           # none / dreamina
- 视频风格: 3D写实

## 视频生成配置（仅视频模型为 dreamina 时写入此区域）
- 即梦视频模型版本: seedance2.0fast  # seedance2.0 / seedance2.0fast / seedance2.0_vip / seedance2.0fast_vip
- 视频比例: 16:9                     # 1:1 / 3:4 / 16:9 / 4:3 / 9:16 / 21:9
- 视频分辨率: 720p                   # 当前仅支持 720p
```

## 5. 视频存储

**路径规则：** `story/episodes/{集数}/videos/shot{NN}.mp4`

```
story/episodes/ep01/videos/
├── tasks.json        # 任务跟踪文件
├── shot01.mp4
├── shot02.mp4
└── ...
```

## 6. 前置检查

生成前扫描所有目标镜头引用的资产，检查对应的 `assets/images/{category}/{name}.png` 是否存在。全部存在才开始提交。缺失则列出缺失清单，提示用户先生成图片（如使用 `/series-edit-story 重新生成XXX的参考图片` 或确认 config 图像模型非 none）。

## 7. 积分提示

`generate-video` 在提交任务前后各显示一次 `dreamina user_credit` 余额，让用户自行对比消耗。

## 8. 不在本次范围内

- 视频拼接/合成（将多个镜头视频拼成完整一集）
- 音频/配乐生成
- 在主流水线中自动触发视频生成
