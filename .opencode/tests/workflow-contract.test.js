import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
function frontmatter(text) {
  const end = text.indexOf('\n---', 4);
  return Object.fromEntries(text.slice(4, end).trim().split('\n').map(line => {
    const colon = line.indexOf(':');
    return [line.slice(0, colon), line.slice(colon + 1).trim()];
  }));
}
const firstJson = text => JSON.parse(text.match(/```json\n([^`]+)\n```/)[1]);

test('provider knowledge retains Creator entry and resolvable guides', () => {
  const text = read('skills/creator-provider-dreamina/SKILL.md');
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

test('storyboard schema retains seven ordered fields and basic asset paths', () => {
  const schema = read('skills/storyboarder-storyboard/rules.md').match(/```markdown\n([^`]+)\n```/)[1];
  assert.deepEqual([...schema.matchAll(/^- ([^：]+)：/gm)].map(m => m[1]),
    ['镜头类型', '镜头运动', '视频风格', '时长', '出场人物', '引用资产', '转场']);
  for (const type of ['characters', 'locations', 'items', 'buildings']) assert.ok(schema.includes(`](assets/${type}/`));
});

test('content fixers retain owner metadata and deprecated config stays absent', () => {
  for (const [name, agent] of [['writer-fix-novel', 'writer'],
    ['storyboarder-fix-storyboard', 'storyboarder'], ['scriptwriter-fix-script', 'scriptwriter']]) {
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    assert.equal(fm.name, name);
    assert.equal(fm.agent, agent);
    assert.equal(fm['user-invocable'], 'false');
    assert.equal(fm.context, undefined);
  }
  assert.doesNotMatch(read('README.md'), /^\| 每集小说字数 \|/m);
});

test('single reviewer examples supply judgment payloads without helper-owned fingerprints', () => {
  for (const name of ['asset-prompt-single', 'asset-visual-single']) {
    const text = read(`skills/reviewer-review-${name}/SKILL.md`);
    assert.equal(frontmatter(text).agent, 'reviewer');
    const payload = firstJson(text);
    assert.deepEqual(Object.keys(payload).sort(), ['commentary', 'result']);
    assert.equal(typeof payload.commentary, 'string');
    const result = payload.result;
    assert.equal(typeof result.asset_path, 'string');
    assert.equal(Object.hasOwn(result, 'target'), false);
    assert.equal(Object.hasOwn(result, 'inputs'), false);
    assert.equal(result.status, 'needs_revision');
    assert.ok(result.blockers.length > 0);
  }
});

test('reviewers retain Bash and Task skills have Task-enabled owners', () => {
  const covered = new Set();
  for (const name of readdirSync('skills')) {
    if (!existsSync(`skills/${name}/SKILL.md`)) continue;
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    if (name.startsWith('reviewer-review-') && fm['allowed-tools'] !== undefined) {
      assert.match(fm['allowed-tools'], /(?:^|, )Bash(?:,|$)/, name);
    }
    if (!fm.agent || !fm['allowed-tools']?.split(', ').includes('Task')) continue;
    assert.ok(frontmatter(read(`agents/${fm.agent}.md`)).tools.split(', ').includes('Task'), name);
    covered.add(fm.agent);
  }
  assert.ok(covered.has('reviewer'));
  for (const role of ['creator', 'reviewer']) {
    const tools = frontmatter(read(`agents/${role}.md`)).tools.split(', ');
    for (const tool of ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'Task', 'Skill']) assert.ok(tools.includes(tool));
  }
});

test('all seven public entry IDs survive production retirement', () => {
  const entries = readdirSync('skills').filter(n => existsSync(`skills/${n}/SKILL.md`))
    .map(n => frontmatter(read(`skills/${n}/SKILL.md`)))
    .filter(fm => fm['user-invocable'] === 'true').map(fm => fm.name).sort();
  assert.deepEqual(entries, ['auto-video', 'check-video', 'edit-story',
    'generate-video', 'repair-story', 'series-video', 'short-video']);
  for (const name of entries) {
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    assert.equal(fm.agent, undefined, name);
    assert.equal(fm.context, undefined);
    assert.ok(fm['allowed-tools'].split(', ').includes('Task'));
    assert.ok(fm['argument-hint']);
  }
});

test('planning stays local and acceptance belongs to registered reviewer', () => {
  const names = readdirSync('skills').filter(n => existsSync(`skills/${n}/SKILL.md`));
  assert.ok(names.includes('director-orchestrate'));
  assert.equal(existsSync('agents/director.md'), false);
  assert.deepEqual(readdirSync('agents').filter(n => n.endsWith('.md')).sort(),
    ['creator.md', 'reviewer.md', 'scriptwriter.md', 'storyboarder.md', 'writer.md']);
  const reviews = names.filter(n => n.startsWith('reviewer-review-'));
  assert.deepEqual(reviews.sort(), ['arc', 'asset-prompt-single', 'asset-prompts',
    'asset-visual-single', 'assets-visual', 'novel', 'outline', 'script',
    'shot-inputs', 'storyboard'].map(n => `reviewer-review-${n}`));
  assert.equal(names.some(n => n.startsWith('director-review-')), false);
  for (const name of names.filter(n => n.startsWith('director-')).concat(reviews)) {
    const fm = frontmatter(read(`skills/${name}/SKILL.md`));
    assert.equal(fm.name, name);
    assert.equal(fm.agent, name.startsWith('reviewer-') ? 'reviewer' : undefined, name);
    assert.equal(fm.context, undefined, name);
    assert.equal(fm['user-invocable'], 'false', name);
  }
});

test('creation entries emit pending preparatory approval schema', () => {
  for (const name of ['series-video', 'short-video']) {
    assert.deepEqual(firstJson(read(`skills/${name}/SKILL.md`)), {
      episode: 'ep01', required: ['outline'], approval: null,
    });
  }
});
