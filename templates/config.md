# ShortVideoDirector 配置

## 模型配置
- 视频模型: generic          # generic / kling / runway / seedance2.0 / 自定义
- 图像模型: generic          # generic / midjourney / flux / nanobanana / 自定义
- 视频风格: 3D写实            # 2D动漫 / 3D动漫 / 3D写实 / 2D手绘 / 自定义

## 创作配置
- 语言: auto                 # auto(跟随输入语言) / zh / en / 自定义
- 每集分镜数: 15             # 建议10-20
- 每集时长目标: 1-2分钟
- 单镜头时长范围: 10-15秒    # 每个分镜镜头的时长范围
- 单镜头资产上限: 5
- 上下文集数: 1              # continue mode时Director读取前N集novel.md
- 默认模式: review           # review / fast / full-auto
