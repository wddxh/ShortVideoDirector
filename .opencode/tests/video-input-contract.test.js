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
  const direct = interactive.slice(interactive.indexOf('direct sheet retry sequence'),
    interactive.indexOf('storyboard retry sequence'));
  const storyboard = interactive.slice(interactive.indexOf('storyboard retry sequence'),
    interactive.indexOf('shared regeneration sequence'));
  const ordered = (block, stages) => stages.reduce((previous, stage) => {
    const index = block.indexOf(stage, previous + 1);
    assert.ok(index > previous, stage);
    return index;
  }, -1);
  ordered(direct, ['creator-fix-storyboard-sheet-prompt',
    'director-review-storyboard-sheet-prompts', 'creator-generate-images']);
  ordered(storyboard, ['creator-storyboard-sheet-prompts',
    'director-review-storyboard-sheet-prompts', 'creator-generate-images']);
  ordered(interactive.slice(interactive.indexOf('shared regeneration sequence')),
    ['director-review-storyboard-sheets-visual', 'director-review-storyboard-sheet-impact',
      'storyboard-to-prompt.sh', 'video-gen-dreamina.sh']);
  assert.ok(interactive.includes('creator-generate-images` skill，参数 `{集数} paths'));
  assert.equal(interactive.includes('creator-image-{图像模型值}'), false);
});

test('interactive correction passes the user target and instruction through direct mode', () => {
  const interactive = read('skills/check-video/SKILL.md').slice(
    read('skills/check-video/SKILL.md').indexOf('**交互模式（默认）：**'),
  );
  assert.ok(interactive.includes('storyboarder-fix-storyboard` skill，参数 `{集数} --direct {target} {instruction}`'));
  assert.ok(interactive.includes('creator-fix-storyboard-sheet-prompt` skill，参数 `{集数} --direct {card} {instruction}`'));
});

test('interactive asset repair requires a unique confirmed target', () => {
  const text = read('skills/check-video/SKILL.md');
  const interactive = text.slice(text.indexOf('**交互模式（默认）：**'));
  const gate = interactive.indexOf('asset target gate');
  const fix = interactive.indexOf('creator-fix-asset` skill', gate);
  const image = interactive.indexOf('creator-generate-images` skill', fix);
  assert.ok(gate >= 0 && fix > gate && image > fix);
  const block = interactive.slice(gate, fix);
  assert.ok(block.includes('asset_path'));
  assert.ok(block.includes('0 或 >1'));
  assert.ok(block.includes('询问并停止'));
  assert.ok(interactive.slice(fix, image).includes('{asset_path} {instruction}'));
});

test('interactive visual review receives only successful regeneration scope', () => {
  const text = read('skills/check-video/SKILL.md');
  assert.ok(text.includes('director-review-storyboard-sheets-visual` skill，参数 `{集数} {successful_shots...}`'));
  assert.ok(text.includes('successful_shots 为空则不调用 visual review'));
});

test('interactive asset repair regenerates direct sheets before converter retry', () => {
  const text = read('skills/check-video/SKILL.md');
  const block = text.slice(text.indexOf('asset target gate'), text.indexOf('direct sheet retry sequence'));
  const stages = ['creator-fix-asset', 'creator-generate-images',
    'direct_affected_card_paths', 'creator-generate-images` skill，参数',
    'paths {direct_affected_card_paths...}', 'successful shots',
    'director-review-storyboard-sheets-visual', 'director-review-storyboard-sheet-impact'];
  let previous = -1;
  for (const stage of stages) {
    const index = block.indexOf(stage, previous + 1);
    assert.ok(index > previous, stage);
    previous = index;
  }
  assert.ok(block.includes('为空则错误并停止'));
});
