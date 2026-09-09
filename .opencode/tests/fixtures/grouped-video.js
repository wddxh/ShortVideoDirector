import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { videoProject } from './video-project.js';

export function groupedVideo(t) {
  const f = videoProject(t);
  const ep = 'story/episodes/ep01', board = `${ep}/storyboard.md`;
  const input = `${ep}/task-inputs/task01.json`;
  const manifest = JSON.parse(readFileSync(join(f.root, input)));
  manifest.shots = [1, 2, 3];
  const blocks = [3, 4, 5].map((duration, i) => `### shot ${i + 1}
- 镜头类型：中景
- 镜头运动：固定
- 视频风格：写实
- 时长：${duration}s
- 出场人物：无
- 引用资产：[lamp](assets/items/lamp.md)
- 转场：切

**画面与声音描述：**
[0s-2.5s] Action ${i + 1}.  
  [1s-${duration}s] Overlapping sound.
Voice: "Wait 2.5s, then [0s-1s]; 3 seconds, $5."  
\tAt 2s keep moving.  `);
  f.write(board, blocks.join('\n\n'));
  f.write(input, JSON.stringify(manifest));
  const convert = () => f.cli('storyboard-to-prompt.mjs', [board, 'task01', 'ep01']);
  const resolved = JSON.parse(convert().stdout);
  Object.assign(f.task, { shots: resolved.shots, prompt: resolved.prompt, duration: resolved.duration,
    references: resolved.references });
  f.save();
  f.evidence();
  return { ...f, board, input, manifest, blocks, convert, resolved };
}
