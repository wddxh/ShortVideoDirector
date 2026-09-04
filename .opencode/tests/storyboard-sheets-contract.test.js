import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
const generator = () => read('skills/creator-storyboard-sheet-prompts/SKILL.md');
const reviewer = () => read('skills/director-review-storyboard-sheet-prompts/SKILL.md');
const fixer = () => read('skills/creator-fix-storyboard-sheet-prompt/SKILL.md');
const visual = () => read('skills/director-review-storyboard-sheets-visual/SKILL.md');
const visualSingle = () => read('skills/director-review-storyboard-sheet-visual-single/SKILL.md');
const imageFix = () => read('skills/creator-fix-storyboard-sheet-image/SKILL.md');
const impact = () => read('skills/director-review-storyboard-sheet-impact/SKILL.md');

test('storyboard sheet generator script exposes a stable CLI', () => {
  const script = join(process.cwd(), 'scripts/generate-storyboard-sheets-dreamina.sh');
  assert.ok(existsSync(script));
  const result = spawnSync('bash', [script], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr,
    'FAIL usage: generate-storyboard-sheets-dreamina.sh <resolution> <model> <card...>\n');
});

function frontmatter(text) {
  const end = text.indexOf('\n---', 4);
  return Object.fromEntries(text.slice(4, end).trim().split('\n').map((line) => {
    const colon = line.indexOf(':');
    return [line.slice(0, colon), line.slice(colon + 1).trim()];
  }));
}

function firstJson(text) {
  return JSON.parse(text.match(/```json\n([^`]+)\n```/)[1]);
}

test('storyboard sheet leaves have stable frontmatter', () => {
  const cases = [
    [generator(), 'creator', 'sonnet', 'Read, Write, Edit, Glob, Grep, Bash'],
    [reviewer(), 'director', 'opus', 'Read, Write, Edit, Glob, Grep, Bash'],
    [fixer(), 'creator', 'sonnet', 'Read, Edit, Glob, Grep'],
  ];
  for (const [text, agent, model, tools] of cases) {
    assert.match(text, /^user-invocable: false$/m);
    assert.match(text, /^context: fork$/m);
    assert.match(text, new RegExp(`^agent: ${agent}$`, 'm'));
    assert.match(text, new RegExp(`^model: ${model}$`, 'm'));
    assert.match(text, new RegExp(`^allowed-tools: ${tools}$`, 'm'));
  }
  assert.match(read('agents/creator.md'), /^tools: Read, Write, Edit, Glob, Grep, Bash, Task$/m);
  assert.match(read('agents/director.md'), /^tools: Read, Write, Edit, Glob, Grep, Bash, Task$/m);
});

test('standard director reviewers allow deterministic Bash checks', () => {
  const root = join(process.cwd(), 'skills');
  const names = readdirSync(root).filter((name) => name.startsWith('director-review-'));
  for (const name of names) {
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    if (fm['allowed-tools'] !== undefined) {
      assert.match(fm['allowed-tools'], /(?:^|, )Bash(?:,|$)/, name);
    }
  }
});

test('skills that allow Task have Task-enabled agents', () => {
  const root = join(process.cwd(), 'skills');
  const covered = new Set();
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(join(root, entry.name, 'SKILL.md'))) continue;
    const text = read(`skills/${entry.name}/SKILL.md`);
    const fm = frontmatter(text);
    if (!fm.agent || !fm['allowed-tools']?.split(', ').includes('Task')) continue;
    const agent = frontmatter(read(`agents/${fm.agent}.md`));
    assert.ok(agent.tools.split(', ').includes('Task'), entry.name);
    covered.add(fm.agent);
  }
  assert.ok(covered.has('director'));
  assert.ok(covered.has('creator'));
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

test('visual review leaves have isolated roles and tools', () => {
  const cases = [
    [visual(), 'director', 'opus', 'Read, Write, Edit, Glob, Grep, Bash, Task'],
    [visualSingle(), 'director', 'opus', 'Read, Glob, Bash'],
    [imageFix(), 'creator', 'sonnet', 'Read, Edit, Glob, Grep, Bash, Task'],
    [impact(), 'director', 'opus', 'Read, Glob, Bash'],
  ];
  for (const [text, agent, model, tools] of cases) {
    const fm = frontmatter(text);
    assert.equal(fm['user-invocable'], 'false');
    assert.equal(fm.context, 'fork');
    assert.equal(fm.agent, agent);
    assert.equal(fm.model, model);
    assert.equal(fm['allowed-tools'], tools);
  }
});

test('visual aggregate persists rounds and dispatches isolated singles', () => {
  const text = visual();
  assert.match(text, /story\/episodes\/\{ep\}\/\.review-storyboard-sheets-visual\.md/);
  assert.match(text, /assets\/storyboard-sheets\/\{ep\}\/shotNN\.md\|assets\/images\/storyboard-sheets\/\{ep\}\/shotNN\.png/);
  assert.match(text, /每批.*≤ ?5/);
  assert.match(text, /重试 1 次/);
  assert.match(text, /<!-- \/round-\{N\} -->/);
  assert.match(text, /dirty list.*无法判定/s);
  assert.match(text, /Task.*director-review-storyboard-sheet-visual-single/s);
  assert.match(text, /严禁.*PNG/s);
});

test('unknown-only visual round stays nonterminal and retries unknown scope', () => {
  const text = visual();
  const match = text.match(/## Round 收敛协议\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match, 'missing round convergence contract');
  const contract = JSON.parse(match[1]);
  const shot = 'assets/storyboard-sheets/ep01/shot02.md';
  const previous = { dirty: [shot], unknown: [shot] };
  const terminal = (dirtyCount, unknownCount) =>
    dirtyCount === contract.terminal.dirty_count &&
    unknownCount === contract.terminal.unknown_count;
  const scope = [...new Set(contract.retry_scope_sources.flatMap(
    (source) => previous[source],
  ))];

  assert.equal(terminal(0, 1), false);
  assert.equal(terminal(0, 0), true);
  assert.deepEqual(contract.retry_scope_sources, ['dirty', 'unknown']);
  assert.deepEqual(scope, [shot]);
  assert.equal(contract.deduplicate_by, 'card_path');
});

test('single, image fix, and impact expose stable machine contracts', () => {
  const singleJson = firstJson(visualSingle());
  assert.deepEqual(Object.keys(singleJson), ['card_path', 'image_path', 'issues']);
  assert.deepEqual(Object.keys(singleJson.issues[0]), ['location', 'issue', 'fix_direction']);

  const fixText = imageFix();
  assert.match(fixText, /card\|image/);
  assert.match(fixText, /creator-generate-images \{ep\} paths/);
  assert.match(fixText, /successful regenerated shots:/);

  const impactText = impact();
  const impactJson = firstJson(impactText);
  assert.deepEqual(Object.keys(impactJson),
    ['upstream', 'downstream', 'status', 'reason', 'fix_direction']);
  assert.match(impactText, /no_dependency\|unaffected\|affected/);
  assert.doesNotMatch(frontmatter(impactText)['allowed-tools'], /Write|Edit|Task/);
});

test('visual handoff records impact without contaminating clean statuses', () => {
  const text = visual();
  assert.match(text, /### 连续性影响评估/);
  assert.match(text, /card\|image\|impact\|\{fix_direction\}/);
  assert.match(text, /creator-fix-storyboard-sheet-image \{ep\} \{review-path\} shotNN/);
  assert.match(text, /affected.*dirty/s);
  assert.match(text, /no_dependency.*unaffected.*不.*dirty/s);
  assert.match(text, /成功.*enqueue/s);
  assert.match(text, /失败.*停止/s);
});

test('legacy pipeline remains unconnected', () => {
  assert.doesNotMatch(
    read('skills/generate-episode-pipeline/SKILL.md'),
    /storyboard-sheet/,
  );
});
