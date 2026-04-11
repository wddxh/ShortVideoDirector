# ShortVideoDirector 配置

## 模型配置
# - 视频模型: generic          # 暂不可选，待接入视频生成后启用
- 图像模型: none              # none / dreamina
- 视频风格: 3D写实            # 2D动漫 / 3D动漫 / 3D写实 / 2D手绘 / 自定义

## 创作配置
- 语言: auto                 # auto(跟随输入语言) / zh / en / 自定义
- 每集分镜数: 15             # 建议10-20
- 每集时长目标: 1-2分钟
- 单镜头时长范围: 10-15秒    # 每个分镜镜头的时长范围
- 单镜头资产上限: 5           # 每个分镜镜头中引用资产的最大数量
- 上下文集数: 1              # continue mode时Director读取前N集novel.md
- 默认模式: default           # default / full-auto
- 每集小说字数: 4000-5000     # 范围格式；单个数字视为上限，下限自动取80%
