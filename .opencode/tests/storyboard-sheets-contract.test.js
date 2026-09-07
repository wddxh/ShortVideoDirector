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
    'FAIL usage: generate-storyboard-sheets-dreamina.sh [--force] [--retry-missing-id] [--concurrency N] <card...>\n');
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

test('all seven public entry IDs survive scheduler retirement', () => {
  const entries = readdirSync(join(process.cwd(), 'skills'))
    .filter(name => existsSync(join(process.cwd(), 'skills', name, 'SKILL.md')))
    .map(name => frontmatter(read(`skills/${name}/SKILL.md`)))
    .filter(fm => fm['user-invocable'] === 'true')
    .map(fm => fm.name).sort();
  assert.deepEqual(entries, ['auto-video', 'check-video', 'edit-story',
    'generate-video', 'repair-story', 'series-video', 'short-video']);
  for (const name of ['series-video', 'short-video', 'edit-story', 'repair-story']) {
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    assert.equal(fm.agent, 'director');
    assert.equal(fm.context, undefined);
    assert.ok(fm['allowed-tools'].split(', ').includes('Task'));
    assert.ok(fm['argument-hint']);
  }
});

test('creation entries emit the pending preparatory approval schema', () => {
  for (const name of ['series-video', 'short-video']) {
    assert.deepEqual(firstJson(read(`skills/${name}/SKILL.md`)), {
      episode: 'ep01', required: ['outline'], approval: null,
    });
  }
});

test('review evidence and single results expose the helper schema', () => {
  const opening = firstJson(read('skills/_meta/rules/review-meta-rules.md'));
  assert.deepEqual(opening, {
    version: 1, kind: 'script',
    scope: ['story/episodes/ep01/script.md'], results: [],
  });
  for (const name of ['asset-prompt-single', 'asset-visual-single',
    'storyboard-sheet-visual-single']) {
    const text = read(`skills/director-review-${name}/SKILL.md`);
    assert.equal(frontmatter(text).agent, 'director');
    const result = firstJson(text);
    assert.equal(result.target, result.asset_path ?? result.card_path);
    assert.ok(['pass', 'needs_revision', 'unknown'].includes(result.status));
    assert.ok(Array.isArray(result.inputs));
    assert.ok(Array.isArray(result.blockers));
    assert.equal(result.status, 'needs_revision');
    assert.ok(result.blockers.length > 0);
  }
});

test('storyboard sheet leaves have stable frontmatter', () => {
  const cases = [
    [generator(), 'creator', 'sonnet', 'Read, Write, Edit, Glob, Grep, Bash, Skill'],
    [reviewer(), 'director', 'opus', 'Read, Write, Edit, Glob, Grep, Bash'],
    [fixer(), 'creator', 'sonnet', 'Read, Edit, Glob, Grep'],
  ];
  for (const [text, agent, model, tools] of cases) {
    assert.match(text, /^user-invocable: false$/m);
    assert.match(text, new RegExp(`^agent: ${agent}$`, 'm'));
    assert.match(text, new RegExp(`^model: ${model}$`, 'm'));
    assert.match(text, new RegExp(`^allowed-tools: ${tools}$`, 'm'));
  }
  for (const role of ['creator', 'director']) {
    const tools = frontmatter(read(`agents/${role}.md`)).tools.split(', ');
    for (const tool of ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Task', 'Skill']) {
      assert.ok(tools.includes(tool), `${role}: ${tool}`);
    }
  }
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
});

test('generator exposes the canonical card path and seven result fields', () => {
  const text = generator();
  assert.match(text, /assets\/storyboard-sheets\/\{ep\}\/shotNN\.md/);
  const fields = text.match(/```text\n([^`]+)\n```/)[1]
    .split('\n').map(line => line.slice(0, line.indexOf(':')));
  assert.deepEqual(fields, ['mode', 'created', 'updated', 'preserved',
    'deleted', 'failed', 'actual changed shots']);
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
});

test('handoff preserves review path and scoped owner findings', () => {
  const text = reviewer();
  assert.match(text, /review path: story\/episodes\/\{ep\}\/\.review-storyboard-sheet-prompts\.md/);
  assert.match(text, /generator mode: incremental/);
  assert.match(text, /generator cards: assets\/storyboard-sheets\/\{ep\}\/shot03\.md, assets\/storyboard-sheets\/\{ep\}\/shot08\.md, assets\/storyboard-sheets\/\{ep\}\/shot09\.md/);
});

test('prompt fix keeps a strict section whitelist', () => {
  const text = fixer();
  assert.match(text, /`## Panel 规划`/);
  assert.match(text, /`## 连续性参考`/);
  assert.match(text, /`## 图像生成提示`/);
  assert.match(text, /no_image_generated: true/);
  assert.match(text, /changed shots:/);
});

test('visual review capabilities retain roles and tools', () => {
  const cases = [
    [visual(), 'director', 'opus', 'Read, Write, Edit, Glob, Grep, Bash, Task'],
    [visualSingle(), 'director', 'opus', 'Read, Glob, Bash'],
    [imageFix(), 'creator', 'sonnet', 'Read, Edit, Glob, Grep, Bash, Skill'],
    [impact(), 'director', 'opus', 'Read, Glob, Bash'],
  ];
  for (const [text, agent, model, tools] of cases) {
    const fm = frontmatter(text);
    assert.equal(fm['user-invocable'], 'false');
    assert.equal(fm.agent, agent);
    assert.equal(fm.model, model);
    assert.equal(fm['allowed-tools'], tools);
  }
});

test('visual aggregate declares review paths, pairs and round footer', () => {
  const text = visual();
  assert.match(text, /story\/episodes\/\{ep\}\/\.review-storyboard-sheets-visual\.md/);
  assert.match(text, /assets\/storyboard-sheets\/\{ep\}\/shotNN\.md\|assets\/images\/storyboard-sheets\/\{ep\}\/shotNN\.png/);
  assert.match(text, /<!-- \/round-\{N\} -->/);
  assert.match(text, /dirty list.*无法判定/s);
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
  assert.deepEqual(Object.keys(singleJson),
    ['target', 'status', 'inputs', 'blockers', 'card_path', 'image_path', 'issues']);
  assert.equal(singleJson.status, 'needs_revision');
  assert.deepEqual(Object.keys(singleJson.issues[0]), ['location', 'issue', 'fix_direction']);

  const fixText = imageFix();
  assert.match(fixText, /card\|image/);
  assert.match(fixText, /successful regenerated shots:/);

  const impactText = impact();
  const impactJson = firstJson(impactText);
  assert.deepEqual(Object.keys(impactJson),
    ['upstream', 'downstream', 'status', 'reason', 'fix_direction']);
  assert.match(impactText, /no_dependency\|unaffected\|affected/);
  const failure = JSON.parse([...impactText.matchAll(/```json\n([^`]+)\n```/g)][1][1]);
  assert.equal(failure.status, 'unknown');
  assert.deepEqual(Object.keys(failure), ['upstream', 'downstream', 'status', 'reason']);
  assert.ok(failure.reason.length > 0);
  assert.doesNotMatch(frontmatter(impactText)['allowed-tools'], /Write|Edit|Task/);
});

test('impact findings preserve format without creating material acceptance', () => {
  const text = visual();
  assert.match(text, /### 连续性影响评估/);
  assert.match(text, /card\|image\|impact\|\{fix_direction\}/);
  const match = text.match(/## Impact Round 合同\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match);
  const contract = JSON.parse(match[1]);
  assert.equal(contract.affected_write, 'assigned findings only');
  assert.equal(contract.mutate_closed_pass, false);
  assert.deepEqual(contract.clean_statuses, ['no_dependency', 'unaffected']);
  assert.equal(contract.clean_write, 'findings only; no material pass');
  assert.equal(contract.clean_record, 'exact JSON with reason');
  assert.equal(contract.clean_dirty_count, 0);
  assert.equal(contract.repair_owner, 'production Director');
  assert.equal(contract.unknown_action, 'stop assessment; report blocker');
});

test('provider knowledge has one Creator entry and three resolvable guides', () => {
  const file = 'skills/creator-provider-dreamina/SKILL.md';
  const text = read(file);
  const fm = frontmatter(text);
  assert.equal(fm.name, 'creator-provider-dreamina');
  assert.equal(fm.agent, 'creator');
  assert.equal(fm.context, undefined);
  assert.equal(fm['user-invocable'], 'false');
  for (const guide of ['capabilities', 'image', 'video']) {
    assert.ok(text.includes(`](${guide}.md)`));
    assert.ok(existsSync(`skills/creator-provider-dreamina/${guide}.md`));
  }
});

test('generic asset reviews and fixes are basic-only', () => {
  for (const path of [
    'skills/director-review-asset-prompts/SKILL.md',
    'skills/director-review-asset-prompt-single/SKILL.md',
    'skills/director-review-assets-visual/SKILL.md',
    'skills/director-review-asset-visual-single/SKILL.md',
    'skills/creator-fix-asset-image/SKILL.md',
  ]) {
    assert.match(read(path), /basic-only|仅.*基础资产/, path);
  }
});

test('storyboard schema declares seven ordered fields and asset paths', () => {
  const rules = read('skills/storyboarder-storyboard/rules.md');
  const schema = rules.match(/```markdown\n([^`]+)\n```/)[1];
  const fields = [...schema.matchAll(/^- ([^：]+)：/gm)].map(match => match[1]);
  assert.deepEqual(fields,
    ['镜头类型', '镜头运动', '视频风格', '时长', '出场人物', '引用资产', '转场']);
  for (const type of ['characters', 'locations', 'items', 'buildings']) {
    assert.ok(schema.includes(`](assets/${type}/`), type);
  }
});

test('sheet card schema defines the complete panel label fields', () => {
  const rules = read('skills/creator-storyboard-sheet-prompts/rules.md');
  const schema = rules.slice(rules.indexOf('## 整板协议'), rules.indexOf('## Markdown 安全子集'));
  for (const field of ['Panel 编号', '时间码', '景别', '机位', '运动']) {
    assert.ok(schema.includes(field), field);
  }
  assert.ok(schema.includes('P03 · 5.0s · CU · LOW ANGLE · DOLLY IN'));
});

test('content fixers retain their owner metadata', () => {
  const cases = [
    ['writer-fix-novel', 'writer'],
    ['storyboarder-fix-storyboard', 'storyboarder'],
    ['scriptwriter-fix-script', 'scriptwriter'],
    ['creator-fix-storyboard-sheet-prompt', 'creator'],
  ];
  for (const [name, agent] of cases) {
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    assert.equal(fm.name, name);
    assert.equal(fm.agent, agent);
    assert.equal(fm['user-invocable'], 'false');
    assert.equal(fm.context, undefined);
  }
});

test('storyboard-sheets router uses the orphan reconcile helper', () => {
  const text = read('skills/creator-generate-images/SKILL.md');
  assert.ok(text.includes('reconcile-storyboard-sheet-images.sh'));
  assert.ok(text.includes('storyboard-sheets'));
});

test('deprecated novel word config is absent', () => {
  assert.doesNotMatch(read('README.md'), /^\| 每集小说字数 \|/m);
});

// Pending, force, receipts and actual output success are exercised with stubs in
// provider-image-execution.test.js and storyboard-sheet-generation-flow.test.js.
// Inventory and scoped evidence use parse-new-assets.test.js and review-evidence.test.js;
// reference ordering uses storyboard-sheet-to-prompt.test.js. Recommendations and
// positive-only examples belong to independent semantic review, not prose matching.
