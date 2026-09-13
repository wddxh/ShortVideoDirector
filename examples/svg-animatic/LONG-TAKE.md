# SVG 三维长镜头实验

工程样例：15 秒、24fps、360 帧、单镜到底。clean 为 960×540；review
从完整 clean 派生，原图不缩放，增加 142px 中文字幕带，成图 960×682。
两者无音轨。字幕是工程观察提示，不是对白原文；时间码按整秒更新。

## 三维来源与可编辑参数

`long-take.py` 的 `frame(t, width, height)` 兼容现有 SVG 导出器。
SVG 本身只输出二维 polygon；三维来自 Python stdlib 的世界坐标、向量、
look-at 正交基和透视除法。固定垂直 FOV=50°，不是二维缩放。

- Y 向上；相机在目标上方 4 单位，从 +Z 一侧绕向 +X。
- 0–4 秒：水平相机半径从 13 推到 9。
- 3–11 秒：方位从 −20° 变为 +60°，总计 80°，与推进／跟随交叠。
- 9–15 秒：主体沿 `(0.5, 0, −√3/2)` 方向移动 1.8 单位，相机同时跟随。
  11 秒后运动方向与水平视轴垂直，成为明确的侧向跟随。
- 五次 smoothstep 使各运动入口／出口速度和加速度连续；无切点、位置重置或变焦。
- `subject()`、`camera()`、FOV、ORBIT_DEGREES、各 box 的 origin/size/colors
  均可直接修改。主体是彩色方块，无肢体／rig。

场景为四个长方体（平台、两柱、主体）和地面棋盘网格。主体底面始终位于
平台顶面 0.35，路线在平台范围内；两柱与平台间有间隙。相机在实体外的
高位环绕走廊运行。近平面 0.2 做多边形裁剪。

背面剔除后，同一凸盒的可见面内部不重叠。当前机位的遮挡顺序为远柱 →
平台 → 主体 → 近柱，地面先画。此顺序利用本场景几何布局，避免平台支撑面
与主体接触处的平均深度排序错误。编辑布局／机位后须重查遮挡；这不是通用
深度缓冲、任意遮挡求解器或通用 3D 引擎。

## 完整导出与验证命令

在 `/home/huangz/repos/ShortVideoDirector-svg-animatic` 执行。已先 `ls /tmp/opencode`
确认父目录，再 `mkdir /tmp/opencode/svg-3d-long-take`。复跑时 review 要用新文件名，
clean 可显式加 `--overwrite`。现有工具／skills 未修改。

```sh
/usr/bin/time -f 'clean export elapsed=%e s' python3 scripts/svg-animatic.py \
  examples/svg-animatic/long-take.py --duration 15 --fps 24 \
  --width 960 --height 540 \
  --output /tmp/opencode/svg-3d-long-take/long-take-clean.mp4

/usr/bin/time -f 'review export elapsed=%e s' python3 scripts/previs-preview.py \
  /tmp/opencode/svg-3d-long-take/long-take-clean.mp4 \
  examples/svg-animatic/long-take-review-plan.json --timecode \
  --output /tmp/opencode/svg-3d-long-take/long-take-review.mp4

SVG_LONG_TAKE_OUTPUT=/tmp/opencode/svg-3d-long-take \
  node --test .opencode/tests/svg-long-take.test.js
```

实际墙钟：clean 7.34 秒，review 2.37 秒，两个 contract 测试合计命令 0.84 秒。
这些是命令耗时，不是制作或返工耗时。两轮各 9 张关键帧栅格化＋拼图分别
0.424／0.349 秒，先完成关键帧修正再完整导出。

测试结果：2 passed，0 skipped。数学检查全程相机 finite、正交、目标投影居中，
阶段连接处导数连续性和深度视差；媒体检查对两个实际 MP4 执行 ffprobe 全帧
读取，核对每个时间戳为 n/24、每帧时长 1/24、360 帧及 15 秒，并用
`ffmpeg -v error -xerror -i VIDEO -f null -` 完整解码。
未设置 `SVG_LONG_TAKE_OUTPUT` 时只运行数学检查，媒体检查会明确 skip。

## 实际视觉自查与产物

所有媒体均位于 `/tmp/opencode/svg-3d-long-take/`：

| 文件 | 内容 |
| --- | --- |
| `long-take-clean.mp4` | 完整无标注画面 |
| `long-take-review.mp4` | 同源完整视频，中文阶段说明和时间码 |
| `decoded-contact.jpg` | 从最终 MP4 抽帧：0、3、5、6、7、8、10、12、359/24 秒，按行排列 |
| `occlusion-contact.jpg` | 最终 MP4 的 7–8.875 秒，每 0.125 秒一帧，4×4 顺序检查遮挡 |
| `review-08s.png` | 最终 review 第 192 帧，检查中文和时间码 |
| `final-key-00.png` … `final-key-08.png` | 导出前同源 960×540 完整关键帧 |
| `keyframes-v2.jpg` | 修正后的带采样时间关键帧拼图 |
| `keyframes-v1.jpg`、`key-00.png` … `key-08.png` | 保留首轮诊断图片，非最终效果 |

最终解码抽帧命令（另两张按表中范围取样）：

```sh
ffmpeg -v error -i /tmp/opencode/svg-3d-long-take/long-take-clean.mp4 \
  -vf "select='eq(n,0)+eq(n,72)+eq(n,120)+eq(n,144)+eq(n,168)+eq(n,192)+eq(n,240)+eq(n,288)+eq(n,359)',scale=480:270,tile=3x3" \
  -frames:v 1 -threads 1 /tmp/opencode/svg-3d-long-take/decoded-contact.jpg
```

主 AI 查看上述最终两张接触图和 review 截图：近柱相对远柱横移、主体侧面逐渐
显现、7–9 秒近柱掠过主体、末段平台相对主体移动均可辨识。字幕无裁字，时间码
显示 00:00:08。首轮发现底边锯齿并改为场景分层；最终抽帧未见该错误。

局限：视觉判断基于有限采样，完整解码不等于逐帧视觉审核；未创建独立审核或
production pass。近柱是大面积部分遮挡，并非保证完全遮住主体。没有真实光照、
投影阴影、运动模糊或人物表演；远处网格可能混叠。更改几何须重新检查相机
安全区域、支撑范围和图层关系，当前样例不承诺任意几何遮挡准确。
