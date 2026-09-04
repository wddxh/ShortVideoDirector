import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const generator = () => read('skills/creator-storyboard-sheet-prompts/SKILL.md');
const reviewer = () => read('skills/director-review-storyboard-sheet-prompts/SKILL.md');
const fixer = () => read('skills/creator-fix-storyboard-sheet-prompt/SKILL.md');

test('storyboard sheet leaves have stable frontmatter', () => {
  const cases = [
    [generator(), 'creator', 'sonnet', 'Read, Write, Edit, Glob, Grep, Bash'],
    [reviewer(), 'director', 'opus', 'Read, Write, Edit, Glob, Grep'],
    [fixer(), 'creator', 'sonnet', 'Read, Edit, Glob, Grep'],
  ];
  for (const [text, agent, model, tools] of cases) {
    assert.match(text, /^user-invocable: false$/m);
    assert.match(text, /^context: fork$/m);
    assert.match(text, new RegExp(`^agent: ${agent}$`, 'm'));
    assert.match(text, new RegExp(`^model: ${model}$`, 'm'));
    assert.match(text, new RegExp(`^allowed-tools: ${tools}$`, 'm'));
  }
  assert.match(read('agents/creator.md'), /^tools: Read, Write, Edit, Glob, Grep, Bash$/m);
});

test('generator has stable output and full argument protocol', () => {
  const text = generator();
  assert.match(text, /assets\/storyboard-sheets\/\{ep\}\/shotNN\.md/);
  assert.match(text, /完整 `\$ARGUMENTS` token 序列/);
  assert.match(text, /token 0.*ep/);
  assert.match(text, /token 1.*mode.*full/);
  assert.match(text, /token 2 及以后.*shots/);
  assert.match(text, /ep01 incremental shot03 shot08/);
  assert.doesNotMatch(text, /\$ARGUMENTS\[2\.\.\.\]/);
  assert.match(text, /mkdir -p "assets\/storyboard-sheets\/\{ep\}"/);
  assert.match(text, /rm -- "\{orphan_path\}"/);
});

test('card rules expose the literal converter schema', () => {
  const text = read('skills/creator-storyboard-sheet-prompts/rules.md');
  for (const literal of [
    '# shotNN Storyboard Sheet',
    '## 基本信息',
    '- 对应分镜：shot N',
    '- Panel 数量：M',
    '## 引用资产',
    '## 连续性参考',
    '## Panel 规划',
    '### PANEL 01',
    '## 图像生成提示',
  ]) assert.ok(text.includes(literal), literal);
});

test('review rounds persist stable status, dirty paths, and footer', () => {
  const text = reviewer();
  assert.match(text, /story\/episodes\/\{ep\}\/\.review-storyboard-sheet-prompts\.md/);
  assert.match(text, /`pass`.*`needs_revision \{M\}`/s);
  assert.match(text, /### dirty list\n- assets\/storyboard-sheets\/\{ep\}\/shot03\.md/);
  assert.match(text, /<!-- \/round-\{N\} -->/);
  assert.match(text, /owner=generator\|prompt-fix\|upstream-storyboard/);
  assert.doesNotMatch(text, /reviewed inputs|sha256|shasum/);
});

test('handoff orders executable owners and generator mode', () => {
  const text = reviewer();
  assert.match(text, /upstream-storyboard[\s\S]*generator[\s\S]*prompt-fix[\s\S]*一次 sheet reviewer/);
  assert.match(text, /story\/episodes\/\{ep\}\/\.review-storyboard\.md/);
  assert.match(text, /storyboarder-fix-storyboard \{ep\}/);
  assert.match(text, /director-review-storyboard \{ep\}/);
  assert.match(text, /缺卡、orphan、shot 集合或编号变化用 `full`/);
  assert.match(text, /现存 card 的内容问题用 `incremental`/);
  assert.match(text, /review path: story\/episodes\/\{ep\}\/\.review-storyboard-sheet-prompts\.md/);
  assert.match(text, /generator mode: incremental/);
  assert.match(text, /generator cards: assets\/storyboard-sheets\/\{ep\}\/shot03\.md, assets\/storyboard-sheets\/\{ep\}\/shot08\.md, assets\/storyboard-sheets\/\{ep\}\/shot09\.md/);
});

test('prompt fix keeps a strict section whitelist', () => {
  const text = fixer();
  assert.match(text, /owner=prompt-fix/);
  assert.match(text, /`## Panel 规划`/);
  assert.match(text, /`## 连续性参考`/);
  assert.match(text, /`## 图像生成提示`/);
  assert.match(text, /no_image_generated: true/);
  assert.match(text, /changed shots:/);
});

test('legacy pipeline remains unconnected', () => {
  assert.doesNotMatch(
    read('skills/generate-episode-pipeline/SKILL.md'),
    /storyboard-sheet/,
  );
});
