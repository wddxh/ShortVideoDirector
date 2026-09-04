import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('generate-video selects canonical shot headings and stores converter fields unchanged', () => {
  const text = read('skills/generate-video/SKILL.md');
  assert.ok(text.includes('`### shot N`'));
  assert.ok(text.includes('重复 shot'));
  assert.ok(text.includes('IMAGES:'));
  assert.ok(text.includes('DURATION:'));
  assert.ok(text.includes('逗号分隔字符串原样'));
  assert.ok(text.includes('每一张图片'));
  assert.ok(text.includes('detect-legacy-kf.sh'));
});

test('initial submission consumes tasks images without reordering', () => {
  const text = read('skills/creator-video-dreamina/SKILL.md');
  assert.ok(text.includes('tasks.json 中的 `images` 原顺序'));
  assert.ok(text.includes('video-gen-dreamina.sh'));
  assert.ok(text.includes('detect-legacy-kf.sh'));
  assert.equal(text.includes('IMAGES_REORDERED'), false);
});

test('auto retry preserves stored fields and interactive retry refreshes all converter fields', () => {
  const text = read('skills/check-video/SKILL.md');
  const automatic = text.slice(text.indexOf('### 阶段 5'));
  assert.ok(automatic.includes('原 prompt/images/duration'));
  assert.ok(automatic.includes('原顺序'));
  assert.ok(automatic.includes('新 prompt / images / duration'));
  assert.ok(automatic.includes('storyboard-to-prompt.sh'));
  assert.ok(text.includes('detect-legacy-kf.sh'));
});

test('auto-video invokes check-video through the standard skill call sentence', () => {
  for (const path of [
    'skills/auto-video/SKILL.md',
    '.opencode/skill-overrides/auto-video/SKILL.md',
  ]) {
    assert.ok(read(path).includes('使用 Skill tool 调用 `check-video` skill'), path);
  }
});

test('interactive correction rebuilds sheet stages before converter retry', () => {
  const text = read('skills/check-video/SKILL.md');
  const interactive = text.slice(text.indexOf('**交互模式（默认）：**'), text.indexOf('## JSON 摘要契约'));
  const stages = [
    'creator-storyboard-sheet-prompts',
    'director-review-storyboard-sheet-prompts',
    'creator-fix-storyboard-sheet-prompt',
    'creator-generate-images',
    'director-review-storyboard-sheets-visual',
    'creator-fix-storyboard-sheet-image',
    'director-review-storyboard-sheet-impact',
    'storyboard-to-prompt.sh',
    'video-gen-dreamina.sh',
  ];
  let previous = -1;
  for (const stage of stages) {
    const index = interactive.indexOf(stage, previous + 1);
    assert.ok(index > previous, stage);
    previous = index;
  }
  assert.ok(interactive.includes('creator-generate-images` skill，参数 `{集数} paths'));
  assert.equal(interactive.includes('creator-image-{图像模型值}'), false);
});
