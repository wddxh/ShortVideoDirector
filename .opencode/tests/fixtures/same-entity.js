import assert from 'node:assert/strict';
import { parallelImages, settings } from './parallel-images.js';

export function sameEntity(t) {
  const f = parallelImages(t);
  const sources = ['assets/buildings/hall.md', 'assets/buildings/facade.md',
    'assets/locations/terrace.md', 'assets/items/lamp.md'];
  const mapped = f.cli('asset-to-image-path.sh', sources);
  assert.equal(mapped.status, 0, mapped.stderr);
  const outputs = mapped.stdout.trim().split('\n');
  const jobs = sources.map((source, i) => ({ source, output: outputs[i],
    prompt: ['hall', 'facade', 'terrace', 'lamp'][i],
    images: i === 2 ? [outputs[1], outputs[0]] : [], settings }));
  for (const j of jobs) f.write(j.source, `# ${j.prompt}\n## 基本信息\n- 类型：${
    j.source.includes('/buildings/') ? '建筑' : j.source.includes('/locations/') ? '场景' : '道具'
  }\n${j === jobs[2] ? `- 同实体参考：[facade](${sources[1]}), [hall](${sources[0]})\n` : ''
  }## 视觉描述\nPale stone, square columns, intact parapet.\n## 图像生成提示\n${j.prompt}\n`);
  // Explicit Creator mapping, not a declaration parser or semantic review.
  return { ...f, jobs };
}
