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
  creator: 'agents/creator.md',
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
    /\$ARGUMENTS\[2\.\.\.\].*shots/,
    /storyboard\.md.*已审核/,
    /config\.md/,
    /assets\/\*\*\/\*\.md/,
    /creator-storyboard-sheet-prompts\/rules\.md/,
  ]);
});

test('generator has effective CC tools and explicit directory lifecycle commands', () => {
  assert.match(source('creator'), /^tools: Read, Write, Edit, Glob, Grep, Bash$/m);
  const text = source('generator');
  assert.match(text, /mkdir -p ["']?assets\/storyboard-sheets\/\{ep\}["']?/);
  assert.match(text, /Bash `rm -- "\{orphan_path\}"`/);
  assert.match(text, /allowed-tools[\s\S]*不能[\s\S]*agent.*tools/i);
  assert.doesNotMatch(text, /Bash 仅可用于只读校验及在 `full` 中删除/);
});

test('incremental consumes canonical unique tokens from all remaining arguments', () => {
  const text = source('generator');
  assert.match(text, /\$ARGUMENTS\[2\.\.\.\]/);
  assert.match(text, /incremental shot03 shot08/);
  assert.match(text, /每个 token[\s\S]*canonical `shotNN`/);
  assert.match(text, /非法[\s\S]*重复[\s\S]*拒绝/);
});

test('generator owns only cards and defines full and incremental boundaries', () => {
  const text = source('generator');
  assert.match(text, /文件名.*shotNN\.md.*对应分镜.*shot N.*PANEL 01/s);
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
  for (const literal of [
    '# shotNN Storyboard Sheet',
    '- 对应分镜：shot N',
    '- Panel 数量：M',
    '### PANEL 01',
  ]) assert.ok(text.includes(literal), `missing literal schema: ${literal}`);
  assert.doesNotMatch(text, /^# shotNN 分镜板$/m);
  assert.doesNotMatch(text, /^- 对应分镜：shotNN$/m);
  assert.doesNotMatch(text, /^- Panel数量：N$/m);
  assert.doesNotMatch(text, /^### PANEL01$/m);
  has(text, [
    /## 基本信息/,
    /所属集数.*对应分镜.*时长.*类型：分镜板.*Panel 数量/s,
    /## 引用资产/,
    /## 连续性参考/,
    /## Panel 规划/,
    /### PANEL 01/,
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
  assert.match(text, /### dirty list\n- assets\/storyboard-sheets\/\{ep\}\/shot03\.md/);
  assert.match(text, /dirty list.*完整.*card path/is);
  assert.doesNotMatch(text, /### dirty list\n- shot03(?:\n|$)/);
  has(text, [
    /\.review-storyboard-sheet-prompts\.md/,
    /一对一.*metadata.*timing.*count.*beats.*repetition.*assets.*previous.*board.*slots/is,
    /<!-- \/round-\{N\} -->/,
    /最后一轮.*通过.*短路/,
    /最后一轮需修改.*dirty/,
    /shot.*PANEL.*整板/,
    /owner=generator\|prompt-fix\|upstream-storyboard/,
    /pass.*needs_revision \{M\}/s,
  ]);
});

test('review pass is content-addressed and always rechecks the global card set', () => {
  const text = source('review');
  assert.match(text, /### reviewed inputs/);
  assert.match(text, /sorted `card path \| sha256`/);
  assert.match(text, /sha256sum[\s\S]*shasum -a 256/);
  assert.match(text, /集合[\s\S]*hash[\s\S]*完全一致[\s\S]*短路/);
  assert.match(text, /变化[\s\S]*新一轮审核/);
  assert.match(text, /每轮[\s\S]*全局[\s\S]*一对一/);
});

test('review emits ordered mixed-owner orchestrator handoff', () => {
  const text = source('review');
  assert.match(text, /### orchestrator handoff/);
  assert.match(text, /upstream-storyboard[\s\S]*generator[\s\S]*prompt-fix[\s\S]*一次 review/);
  assert.match(text, /每个 owner[\s\S]*完整 card path/);
  assert.match(text, /review path/);
  assert.match(text, /Fix 不得先跑/);
  assert.match(text, /generator: assets\/storyboard-sheets\/\{ep\}\/shot03\.md, assets\/storyboard-sheets\/\{ep\}\/shot08\.md/);
  assert.match(text, /upstream-storyboard: assets\/storyboard-sheets\/\{ep\}\/shot09\.md/);
  assert.match(text, /prompt-fix: assets\/storyboard-sheets\/\{ep\}\/shot10\.md/);
  assert.match(text, /invoke: \{ep\} incremental shot03 shot08/);
  assert.match(text, /location: shot03\/整板[\s\S]*owner=generator[\s\S]*location: shot08\/整板[\s\S]*owner=generator[\s\S]*location: shot09\/整板[\s\S]*owner=upstream-storyboard[\s\S]*location: shot10\/PANEL 02[\s\S]*owner=prompt-fix/);
  assert.match(text, /### reviewed inputs\n- assets\/storyboard-sheets\/\{ep\}\/shot01\.md \| \{sha256\}\n- assets\/storyboard-sheets\/\{ep\}\/shot03\.md \| \{sha256\}\n- assets\/storyboard-sheets\/\{ep\}\/shot08\.md \| \{sha256\}\n- assets\/storyboard-sheets\/\{ep\}\/shot09\.md \| \{sha256\}\n- assets\/storyboard-sheets\/\{ep\}\/shot10\.md \| \{sha256\}/);
  assert.match(text, /返回简报[\s\S]*orchestrator handoff[\s\S]*review path/);
});

test('fix consumes only prompt-fix findings and changes only allowed sections', () => {
  const text = source('fix');
  assert.match(text, /dirty list.*assets\/storyboard-sheets\/\{ep\}\/shotNN\.md/is);
  assert.match(text, /完整.*card path/);
  assert.match(text, /orchestrator handoff/);
  assert.match(text, /upstream-storyboard[\s\S]*generator[\s\S]*prompt-fix/);
  assert.match(text, /Fix 不得先跑/);
  assert.match(text, /核验[\s\S]*upstream-storyboard[\s\S]*generator[\s\S]*已解决[\s\S]*prompt-fix/);
  assert.doesNotMatch(text, /只要 upstream-storyboard 或 generator 列表非空.*blocked/);
  assert.match(text, /orchestrator handles owner=generator: assets\/storyboard-sheets\/\{ep\}\/shot03\.md, assets\/storyboard-sheets\/\{ep\}\/shot08\.md/);
  assert.match(text, /orchestrator handles owner=upstream-storyboard: assets\/storyboard-sheets\/\{ep\}\/shot09\.md/);
  assert.match(text, /orchestrator handles owner=prompt-fix: assets\/storyboard-sheets\/\{ep\}\/shot10\.md/);
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
