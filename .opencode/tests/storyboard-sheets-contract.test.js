import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = {
  generator: 'skills/creator-storyboard-sheet-prompts/SKILL.md',
  rules: 'skills/creator-storyboard-sheet-prompts/rules.md',
  review: 'skills/director-review-storyboard-sheet-prompts/SKILL.md',
  fix: 'skills/creator-fix-storyboard-sheet-prompt/SKILL.md',
};

function source(key) {
  return readFileSync(join(root, files[key]), 'utf8');
}

function has(text, patterns) {
  for (const pattern of patterns) assert.match(text, pattern);
}

test('all storyboard sheet skills are non-user fork leaves with exact agents and tools', () => {
  const expected = {
    generator: ['creator', 'sonnet', 'Read, Write, Edit, Glob, Grep, Bash'],
    review: ['director', 'opus', 'Read, Write, Edit, Glob, Grep, Bash'],
    fix: ['creator', 'sonnet', 'Read, Edit, Glob, Grep'],
  };
  for (const [key, [agent, model, tools]] of Object.entries(expected)) {
    const text = source(key);
    has(text, [
      /^user-invocable: false$/m,
      /^context: fork$/m,
      new RegExp(`^agent: ${agent}$`, 'm'),
      new RegExp(`^model: ${model}$`, 'm'),
      new RegExp(`^allowed-tools: ${tools}$`, 'm'),
    ]);
  }
});

test('generator accepts ep, mode, and shots and reads approved upstream inputs', () => {
  const text = source('generator');
  has(text, [
    /\$ARGUMENTS\[0\].*ep/,
    /\$ARGUMENTS\[1\].*full.*incremental/,
    /\$ARGUMENTS\[2\].*shots/,
    /storyboard\.md.*已审核/,
    /config\.md/,
    /assets\/\*\*\/\*\.md/,
    /creator-storyboard-sheet-prompts\/rules\.md/,
  ]);
});

test('generator owns only cards and defines full and incremental boundaries', () => {
  const text = source('generator');
  has(text, [
    /assets\/storyboard-sheets\/\{ep\}\/shotNN\.md/,
    /不修改.*storyboard\.md/,
    /不生图/,
    /full.*全覆盖/s,
    /full.*孤儿/s,
    /incremental.*仅.*shots/s,
    /编号变化.*full/,
    /missing asset.*上游错误/i,
    /created.*updated.*preserved.*deleted.*failed/s,
    /actual changed shots/i,
  ]);
});

test('card contract contains literal schema and converter-safe asset syntax', () => {
  const text = source('rules');
  has(text, [
    /## 基本信息/,
    /所属集数.*对应分镜.*时长.*类型：分镜板.*Panel数量/s,
    /## 引用资产/,
    /## 连续性参考/,
    /## Panel 规划/,
    /### PANEL01/,
    /时间码.*景别.*机位.*摄影机.*画面.*连续性/s,
    /## 图像生成提示/,
    /无 previous.*`无`/i,
    /links.*naked names.*slots/i,
  ]);
});

test('panel and board rules define temporal, visual, and safety boundaries', () => {
  const text = source('rules');
  has(text, [
    /Panel.*无上限/,
    /时间.*升序.*完整覆盖/,
    /时间边界.*cut.*机位.*景别.*运动.*姿态.*反应.*建立.*结束/s,
    /16:9.*等宽网格.*左.*右.*上.*下/s,
    /panel.*视频比例/i,
    /彩色.*风格/,
    /英文.*label/i,
    /当前.*shot.*全.*资产/,
    /相邻.*连续元素/,
    /不得复制.*前板.*网格.*panel.*构图.*机位/is,
    /raw HTML.*script.*pre.*style.*复杂.*link/is,
  ]);
});

test('reviewer checks the complete contract and writes append-only scoped rounds', () => {
  const text = source('review');
  has(text, [
    /\.review-storyboard-sheet-prompts\.md/,
    /一对一.*metadata.*timing.*count.*beats.*repetition.*assets.*previous.*board.*slots/is,
    /<!-- \/round-\{N\} -->/,
    /最后一轮.*通过.*短路/,
    /后续.*dirty/,
    /shot.*PANEL.*整板/,
    /owner=generator\|prompt-fix\|upstream-storyboard/,
    /pass.*needs_revision \{M\}/s,
  ]);
});

test('fix consumes only prompt-fix findings and changes only allowed sections', () => {
  const text = source('fix');
  has(text, [
    /最后一轮/,
    /owner=prompt-fix/,
    /只.*Panel 规划.*连续性参考.*图像生成提示/s,
    /不生图/,
    /owner=generator\|upstream-storyboard.*orchestrator/s,
    /changed shots/,
    /no_image_generated/,
  ]);
});

test('new skills stay unconnected so the legacy pipeline remains unchanged', () => {
  const pipeline = readFileSync(
    join(root, 'skills/generate-episode-pipeline/SKILL.md'),
    'utf8',
  );
  assert.doesNotMatch(pipeline, /storyboard-sheet/);
});
