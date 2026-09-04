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
    'FAIL usage: generate-storyboard-sheets-dreamina.sh <resolution> <model> [--force] <card...>\n');
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
  for (const field of ['mode:', 'created:', 'updated:', 'deleted:']) {
    assert.ok(text.includes(field), field);
  }
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

test('visual scope preserves pending work and only short-circuits pure pass without explicit scope', () => {
  const text = visual();
  const match = text.match(/## Scope 优先级协议\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match, 'missing visual scope precedence contract');
  const contract = JSON.parse(match[1]);
  assert.deepEqual(contract.candidate_sources, ['explicit', 'previous_dirty', 'previous_unknown']);
  assert.equal(contract.deduplicate_by, 'card_path');
  assert.equal(contract.pure_pass_without_explicit, 'short_circuit');
  assert.equal(contract.pure_pass_with_explicit, 'dispatch_explicit');
  const previous = { dirty: ['shot01'], unknown: ['shot02'] };
  const candidate = [...new Set([
    'shot03', ...previous.dirty, ...previous.unknown,
  ])];
  assert.deepEqual(candidate, ['shot03', 'shot01', 'shot02']);
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
  assert.ok(fixText.includes('creator-generate-images` skill，参数 `{ep} paths'));
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

test('all episode modes use the same ordered sheet subchain', () => {
  const steps = [
    'storyboarder-storyboard',
    'director-review-storyboard',
    'creator-storyboard-sheet-prompts',
    'director-review-storyboard-sheet-prompts',
    'creator-generate-images',
    'director-review-storyboard-sheets-visual',
  ];
  for (const file of ['new-series.md', 'continue-series.md', 'short.md']) {
    const text = read(`skills/generate-episode-pipeline/${file}`);
    const ep = file === 'continue-series.md' ? '{ep}' : 'ep01';
    let previous = -1;
    for (const step of steps) {
      const index = text.indexOf(step, previous + 1);
      assert.ok(index > previous, `${file}: ${step}`);
      previous = index;
    }
    assert.match(text, /creator-generate-images[^\n]*storyboard-sheets/);
    assert.ok(text.includes(
      `使用 Skill tool 调用 \`creator-generate-images\` skill，参数 \`${ep} basic\``),
      `${file}: basic image scope`,
    );
    assert.match(text, /upstream-storyboard[\s\S]*generator[\s\S]*prompt-fix/);
    assert.match(text, /fix_attempts[\s\S]*2/);
    assert.match(text, /首次生成[\s\S]*不.*impact/);
    assert.match(text, /图像模型.*none[\s\S]*card[\s\S]*跳过.*PNG/);
  }
});

test('image routing exposes basic, storyboard-sheets, and paths scopes', () => {
  const router = read('skills/creator-generate-images/SKILL.md');
  for (const scope of ['basic', 'storyboard-sheets', 'paths']) {
    assert.ok(router.includes(`\`${scope}\``), scope);
  }
  assert.match(router, /storyboard-sheets[\s\S]*creator-image-/);
  assert.match(read('skills/creator-image-dreamina/SKILL.md'), /generate-storyboard-sheets-dreamina\.sh/);
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

test('storyboard ownership and seven-field contract are separated from panels', () => {
  const rules = read('skills/storyboarder-storyboard/rules.md');
  const schema = rules.slice(rules.indexOf('### shot 1'), rules.indexOf('### shot 2'));
  for (const field of ['镜头类型', '镜头运动', '视频风格', '时长', '出场人物', '引用资产', '转场']) {
    assert.ok(schema.includes(field), field);
  }
  assert.match(rules, /引用资产.*location.*item.*building/s);
  assert.match(rules, /动作终态.*朝向.*空间/);
  assert.doesNotMatch(rules, /PANEL 01/);
  assert.match(read('agents/storyboarder.md'), /不.*panel/);
  assert.match(read('agents/creator.md'), /storyboard sheet.*panel/i);
  assert.match(read('agents/director.md'), /storyboard sheet.*review/i);
});

test('edit and repair expose direct-impact and ordered recovery contracts', () => {
  for (const mode of ['series.md', 'short.md']) {
    const edit = read(`skills/edit-story/${mode}`);
    assert.match(edit, /直接引用/);
    assert.match(edit, /dirty batch/);
    assert.match(edit, /impact/);
    const repair = read(`skills/repair-story/${mode}`);
    const order = ['基础资产卡', '基础资产图片', 'storyboard', 'sheet.md', 'sheet.png'];
    let previous = -1;
    for (const item of order) {
      const index = repair.indexOf(item, previous + 1);
      assert.ok(index > previous, `${mode}: ${item}`);
      previous = index;
    }
    assert.match(repair, /none[\s\S]*skipped/);
  }
});

test('edit mode guides expose executable entry and routing tables', () => {
  const expected = {
    'series.md': ['outline', 'novel', 'script', 'base-asset-card', 'base-asset-image', 'storyboard', 'sheet-prompt', 'sheet-image', 'impact'],
    'short.md': ['outline', 'script', 'base-asset-card', 'base-asset-image', 'storyboard', 'sheet-prompt', 'sheet-image', 'impact'],
  };
  for (const [file, nodes] of Object.entries(expected)) {
    const text = read(`skills/edit-story/${file}`);
    const entry = text.slice(text.indexOf('## 可执行入口表'), text.indexOf('## 节点路由表'));
    const routes = text.slice(text.indexOf('## 节点路由表'));
    const firstColumn = (table) => new Set(table.split('\n')
      .filter((line) => line.startsWith('|'))
      .map((line) => line.split('|')[1].trim()));
    const entryNodes = firstColumn(entry);
    const routeNodes = firstColumn(routes);
    for (const node of nodes) {
      assert.ok(entryNodes.has(node), `${file} entry ${node}`);
      assert.ok(routeNodes.has(node), `${file} route ${node}`);
    }
    assert.ok(routes.includes('使用 Skill tool 调用'));
    assert.ok(routes.includes('creator-generate-images` skill，参数 `{ep} paths'));
    for (const skill of [
      'creator-storyboard-sheet-prompts',
      'director-review-storyboard-sheet-prompts',
      'creator-fix-storyboard-sheet-prompt',
      'director-review-storyboard-sheets-visual',
      'creator-fix-storyboard-sheet-image',
      'director-review-storyboard-sheet-impact',
    ]) assert.ok(text.includes(`\`${skill}\``), `${file}: ${skill}`);
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

test('content fixers expose review and direct CLI modes', () => {
  const cases = [
    ['writer-fix-novel', 'ep + --direct + target + instruction'],
    ['storyboarder-fix-storyboard', 'ep + --direct + target + instruction'],
    ['scriptwriter-fix-script', 'mode + ep + --direct + target + instruction'],
    ['creator-fix-storyboard-sheet-prompt', 'ep + --direct + card + instruction'],
  ];
  for (const [name, cli] of cases) {
    const text = read(`skills/${name}/SKILL.md`);
    assert.ok(text.includes(cli), name);
    assert.ok(text.includes('review mode'), name);
    assert.ok(text.includes('direct mode'), name);
  }
});

test('pipeline fixer calls remain in review mode', () => {
  const text = read('skills/generate-episode-pipeline/SKILL.md');
  for (const fixer of ['storyboarder-fix-storyboard', 'creator-fix-storyboard-sheet-prompt']) {
    const line = text.split('\n').find((value) => value.includes(`\`${fixer}\``));
    assert.ok(line, fixer);
    assert.equal(line.includes('--direct'), false, fixer);
  }
});

test('edit routes direct modifications and asset creation in dependency order', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/edit-story/${mode}`);
    for (const fixer of ['storyboarder-fix-storyboard', 'scriptwriter-fix-script',
      'creator-fix-storyboard-sheet-prompt']) {
      assert.ok(text.includes(`${fixer}\` skill，参数`), `${mode}: ${fixer}`);
      assert.ok(text.includes('--direct'), `${mode}: direct mode`);
    }
    const create = text.indexOf('creator-create-assets` skill');
    const update = text.indexOf('creator-update-records` skill');
    const image = text.indexOf('creator-generate-images` skill');
    assert.ok(create >= 0 && image > create, `${mode}: create before image`);
    if (mode === 'series.md') assert.ok(update > create && update < image);
  }
  assert.ok(read('skills/edit-story/series.md').includes('writer-fix-novel` skill，参数 `{ep} --direct'));
});

test('series outline review mode is selected by episode number', () => {
  const text = read('skills/edit-story/series.md');
  const marker = 'outline review mode map';
  const start = text.indexOf(marker);
  assert.ok(start >= 0);
  const lines = text.slice(start).split('\n').slice(0, 4).join('\n');
  assert.ok(lines.includes('ep01=new-series'));
  assert.ok(lines.includes('ep02+=continue-series'));
  const reviewerCall = lines.split('\n').find((line) => line.includes('director-review-outline'));
  assert.ok(reviewerCall.includes('{outline_review_mode} {ep}'));
  assert.equal(reviewerCall.includes('参数 `series'), false);
});

test('repair routes failed sheet review states to the matching review loop', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    assert.ok(text.includes('storyboard-sheet-prompt-review:missing|needs_revision'), mode);
    assert.ok(text.includes('creator-fix-storyboard-sheet-prompt'), mode);
    assert.ok(text.includes('visual missing recovery'), mode);
    assert.ok(text.includes('visual needs_revision recovery'), mode);
    assert.ok(text.includes('creator-fix-storyboard-sheet-image'), mode);
  }
});

test('repair prompt review owner loop uses one ordered budget', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('prompt owner loop');
    assert.ok(start >= 0, mode);
    const block = text.slice(start);
    let previous = -1;
    for (const owner of ['upstream-storyboard', 'generator', 'prompt-fix',
      'director-review-storyboard-sheet-prompts']) {
      const index = block.indexOf(owner, previous + 1);
      assert.ok(index > previous, `${mode}: ${owner}`);
      previous = index;
    }
    assert.ok(block.includes('fix_attempts=2'));
    assert.ok(block.includes('orchestrator handoff'));
    for (const skill of ['storyboarder-fix-storyboard', 'director-review-storyboard',
      'creator-storyboard-sheet-prompts', 'creator-fix-storyboard-sheet-prompt']) {
      assert.ok(block.includes(`使用 Skill tool 调用 \`${skill}\` skill`), `${mode}: ${skill}`);
    }
  }
});

test('regeneration callers scope visual review to actual successes', () => {
  const cases = [
    ['skills/generate-episode-pipeline/SKILL.md', '{successful_shots...}'],
    ['skills/edit-story/series.md', '{successful_shots...}'],
    ['skills/edit-story/short.md', '{successful_shots...}'],
    ['skills/check-video/SKILL.md', '{successful_shots...}'],
    ['skills/repair-story/series.md', '{successful_shots...}'],
    ['skills/repair-story/short.md', '{successful_shots...}'],
    ['skills/director-review-storyboard-sheets-visual/SKILL.md', '{successful_regenerated_shots...}'],
  ];
  for (const [path, scope] of cases) {
    const text = read(path);
    assert.ok(text.includes('successful shots') || text.includes('successful regenerated shots'), path);
    assert.ok(text.includes(`director-review-storyboard-sheets-visual\` skill，参数`), path);
    assert.ok(text.includes(scope), `${path}: ${scope}`);
  }
});

test('asset creation reads script in both modes and novel only for series', () => {
  const text = read('skills/creator-create-assets/SKILL.md');
  assert.ok(text.includes('script.md` — 必须读取'));
  assert.ok(text.includes('novel.md` — series mode'));
});

test('targeted sheet generation is forceful while basic paths retain existing policy', () => {
  const router = read('skills/creator-generate-images/SKILL.md');
  assert.ok(router.includes('sheet card paths: force'));
  assert.ok(router.includes('basic asset paths: caller-managed'));
  assert.ok(read('skills/creator-image-dreamina/SKILL.md').includes(
    'generate-storyboard-sheets-dreamina.sh "{图片分辨率}" "{模型版本}" --force'));
  assert.ok(read('skills/creator-image-dreamina/SKILL.md').includes(
    'pending success resume: no --force'));
  assert.ok(read('skills/creator-image-dreamina/SKILL.md').includes(
    'successful shots: shotNN ... | none'));
  const fix = imageFix();
  assert.equal(fix.includes('rm '), false);
  assert.ok(fix.includes('router owns targeted PNG deletion'));
});

test('repair generation steps do not use unscoped visual review', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const generation = text.indexOf('creator-generate-images` skill');
    const scoped = text.indexOf('{successful_shots...}', generation);
    assert.ok(generation >= 0 && scoped > generation, mode);
  }
});

test('repair reviews all canonical sheets when visual review is missing', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const missing = text.slice(text.indexOf('visual missing recovery'),
      text.indexOf('visual needs_revision recovery'));
    const stages = ['creator-generate-images', 'all_canonical_sheet_shots',
      'director-review-storyboard-sheets-visual'];
    let previous = -1;
    for (const stage of stages) {
      const index = missing.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
  }
});

test('repair needs-revision visual recovery passes successful scope for aggregate union', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const block = text.slice(text.indexOf('visual needs_revision recovery'));
    assert.ok(block.includes('successful_shots'), mode);
    assert.ok(block.includes('previous dirty + previous unknown'), mode);
    assert.ok(block.includes('director-review-storyboard-sheets-visual` skill，参数'), mode);
  }
});

test('edit flows order prompt review and regeneration by entry type', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/edit-story/${mode}`);
    const direct = text.indexOf('direct sheet sequence');
    const storyboard = text.indexOf('storyboard sequence');
    assert.ok(direct >= 0 && storyboard >= 0, mode);
    const directBlock = text.slice(direct, storyboard);
    const directOrder = ['creator-fix-storyboard-sheet-prompt',
      'director-review-storyboard-sheet-prompts', 'creator-generate-images'];
    let previous = -1;
    for (const step of directOrder) {
      const index = directBlock.indexOf(step, previous + 1);
      assert.ok(index > previous, `${mode}: direct ${step}`);
      previous = index;
    }
    const boardBlock = text.slice(storyboard);
    assert.ok(boardBlock.indexOf('creator-storyboard-sheet-prompts') <
      boardBlock.indexOf('director-review-storyboard-sheet-prompts'));
  }
});

test('storyboard edit explicitly regenerates actual changed cards before review and impact', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/edit-story/${mode}`);
    const block = text.slice(text.indexOf('storyboard sequence'));
    const stages = [
      'creator-storyboard-sheet-prompts',
      'director-review-storyboard-sheet-prompts',
      'creator-generate-images` skill，参数',
      'actual_changed_card_paths',
      'successful shots',
      'director-review-storyboard-sheets-visual',
      'director-review-storyboard-sheet-impact',
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
  }
});

test('storyboard deletion reconciles orphans without routing deleted cards through paths', () => {
  for (const path of ['skills/edit-story/series.md', 'skills/edit-story/short.md',
    'skills/check-video/SKILL.md', 'skills/repair-story/series.md',
    'skills/repair-story/short.md']) {
    const text = read(path);
    const start = text.indexOf('generator summary routing');
    assert.ok(start >= 0, path);
    const block = text.slice(start);
    const force = block.indexOf('paths {existing_changed_card_paths...}');
    const reconcile = block.indexOf('storyboard-sheets', force);
    assert.ok(force >= 0 && reconcile > force, path);
    assert.ok(block.includes('created + updated'));
    assert.ok(block.includes('deleted'));
    assert.ok(block.includes('mode=full'));
    assert.ok(block.includes('renumbered'));
    assert.ok(block.includes('deleted cards never enter paths'));
    assert.ok(block.includes('successful shots union'));
  }
});

test('storyboard-sheets router uses the orphan reconcile helper', () => {
  const text = read('skills/creator-generate-images/SKILL.md');
  assert.ok(text.includes('reconcile-storyboard-sheet-images.sh'));
  assert.ok(text.includes('storyboard-sheets'));
});

test('repair owner changes force sheet regeneration before scoped review and impact', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const block = text.slice(text.indexOf('prompt owner loop'));
    const stages = ['changed_card_paths', 'creator-generate-images` skill，参数',
      'paths {changed_card_paths...}', 'successful shots',
      'director-review-storyboard-sheets-visual', 'director-review-storyboard-sheet-impact'];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
    assert.ok(block.includes('图像模型 `none`'));
  }
});

test('basic image pending contract drains each tier before advancing', () => {
  const text = read('skills/creator-image-dreamina/SKILL.md');
  const match = text.match(/## Basic Pending 状态合同\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match);
  const contract = JSON.parse(match[1]);
  assert.deepEqual(contract.tuple, ['submit_id', 'asset_path', 'output_path']);
  assert.deepEqual(contract.statuses, ['success', 'fail', 'querying']);
  assert.equal(contract.max_rounds, 5);
  assert.equal(contract.persist_path, 'assets/images/pending.json');
  assert.equal(contract.advance_when_pending, false);
  assert.equal(contract.resubmit_pending, false);
});

test('repair basic image recovery runs scoped visual fix loop in both modes', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('basic visual recovery');
    assert.ok(start >= 0, mode);
    const block = text.slice(start, text.indexOf('storyboard recovery', start));
    const stages = ['creator-generate-images', 'director-review-assets-visual',
      '--type=characters,locations,items,buildings', 'creator-fix-asset-image'];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
    assert.ok(block.includes('fix_attempts=2'));
    assert.ok(block.includes('图像模型 `none`'));
  }
});

test('short repair restores script and asset cards before basic images', () => {
  const text = read('skills/repair-story/short.md');
  const block = text.slice(text.indexOf('## 恢复顺序'),
    text.indexOf('basic visual recovery'));
  const stages = [
    'script:missing|incomplete',
    'scriptwriter-script` skill，参数 `short ep01`',
    'director-review-script` skill，参数 `short ep01`',
    'scriptwriter-fix-script` skill，参数 `short ep01`',
    'assets:missing',
    'creator-create-assets` skill，参数 `ep01`',
  ];
  let previous = -1;
  for (const stage of stages) {
    const index = block.indexOf(stage, previous + 1);
    assert.ok(index > previous, stage);
    previous = index;
  }
  const afterFix = block.slice(block.indexOf('scriptwriter-fix-script'));
  assert.ok(afterFix.includes(
    'director-review-script` skill，参数 `short ep01`'));
});

test('basic visual reviewer supports explicit paths without changing its default', () => {
  const text = read('skills/director-review-assets-visual/SKILL.md');
  const match = text.match(/## Scope 合同\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match);
  const contract = JSON.parse(match[1]);
  assert.equal(contract.argument_parser, 'complete $ARGUMENTS token sequence');
  assert.equal(contract.default_source, 'parse-new-assets.sh');
  assert.equal(contract.explicit_source, 'remaining asset path tokens');
  assert.equal(contract.explicit_replaces_default, true);
  assert.equal(contract.explicit_may_include_existing, true);
  assert.equal(contract.validate_path_type, true);
  assert.doesNotMatch(text, /\$ARGUMENTS\[[0-9]+\.\.\.?\]/);
});

test('basic image routing reports actual successful asset paths', () => {
  for (const path of [
    'skills/creator-generate-images/SKILL.md',
    'skills/creator-image-dreamina/SKILL.md',
  ]) {
    const text = read(path);
    assert.ok(text.includes('successful asset paths: {asset_path...} | none'), path);
    assert.ok(text.includes('本次实际落盘成功'), path);
  }
  const router = read('skills/creator-generate-images/SKILL.md');
  assert.match(router,
    /图像模型.*none[^\n]*successful asset paths: none/);
  assert.ok(read('skills/creator-fix-asset-image/SKILL.md').includes(
    'successful asset paths: {asset_path...} | none'));
});

test('repair reviews only actual regenerated base asset paths', () => {
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('basic visual recovery');
    const block = text.slice(start, text.indexOf('storyboard recovery', start));
    const stages = [
      'creator-generate-images',
      'successful asset paths',
      'director-review-assets-visual',
      '{successful_asset_paths...}',
      'creator-fix-asset-image',
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
    const afterFix = block.slice(block.indexOf('creator-fix-asset-image'));
    assert.ok(afterFix.includes('successful asset paths'), `${mode}: fix output`);
    assert.ok(afterFix.includes(
      'director-review-assets-visual` skill，参数'), `${mode}: re-review`);
    assert.ok(afterFix.includes('{successful_fixed_asset_paths...}'),
      `${mode}: fixed scope`);
  }
});

test('asset-list recovery reruns its script owner before assets in both modes', () => {
  for (const [mode, scriptArgs] of [
    ['short.md', 'short ep01'],
    ['series.md', '{series_script_mode} {ep}'],
  ]) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('asset-list:missing');
    assert.ok(start >= 0, mode);
    const block = text.slice(start, text.indexOf('storyboard recovery', start));
    const stages = [
      `scriptwriter-script\` skill，参数 \`${scriptArgs}\``,
      `director-review-script\` skill，参数 \`${scriptArgs}\``,
      'scriptwriter-fix-script` skill',
      `director-review-script\` skill，参数 \`${scriptArgs}\``,
      'creator-create-assets` skill',
      'basic visual recovery',
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
  }
});

test('series repair maps episode mode and passes legal content arguments', () => {
  const text = read('skills/repair-story/series.md');
  assert.ok(text.includes('ep01=new-series'));
  assert.ok(text.includes('ep02+=continue-series'));
  const block = text.slice(text.indexOf('novel:missing|incomplete'),
    text.indexOf('asset-list:missing'));
  const stages = [
    'writer-novel` skill，参数 `{ep}`',
    'director-review-novel` skill，参数 `{ep}`',
    'writer-fix-novel` skill，参数 `{ep}`',
    'scriptwriter-script` skill，参数 `{series_script_mode} {ep}`',
    'director-review-script` skill，参数 `{series_script_mode} {ep}`',
    'scriptwriter-fix-script` skill，参数 `{series_script_mode} {ep}`',
  ];
  let previous = -1;
  for (const stage of stages) {
    const index = block.indexOf(stage, previous + 1);
    assert.ok(index > previous, stage);
    previous = index;
  }
  const numbered = ['3. `asset-list:missing`', '4. `assets:missing`',
    '5. basic visual recovery', '6. storyboard recovery'];
  previous = -1;
  for (const stage of numbered) {
    const index = text.indexOf(stage, previous + 1);
    assert.ok(index > previous, stage);
    previous = index;
  }
  assert.ok(text.includes('步骤 5 基础图、步骤 8 sheet.png'));
});

test('repair storyboard recovery uses explicit ordered calls in both modes', () => {
  for (const [mode, ep] of [['short.md', 'ep01'], ['series.md', '{ep}']]) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('storyboard recovery');
    const block = text.slice(start, text.indexOf('visual missing recovery', start));
    const stages = [
      `storyboarder-storyboard\` skill，参数 \`${ep}\``,
      `director-review-storyboard\` skill，参数 \`${ep}\``,
      `storyboarder-fix-storyboard\` skill，参数 \`${ep}\``,
      `director-review-storyboard\` skill，参数 \`${ep}\``,
      `creator-storyboard-sheet-prompts\` skill，参数 \`${ep} full\``,
      `director-review-storyboard-sheet-prompts\` skill，参数 \`${ep}\``,
      'prompt owner loop',
      `storyboarder-fix-storyboard\` skill，参数 \`${ep}\``,
      `director-review-storyboard\` skill，参数 \`${ep}\``,
      `creator-storyboard-sheet-prompts\` skill，参数 \`${ep} incremental {shots...}\``,
      `creator-fix-storyboard-sheet-prompt\` skill，参数 \`${ep}\``,
      `director-review-storyboard-sheet-prompts\` skill，参数 \`${ep}\``,
      'storyboard repair sheet rebuild',
      `creator-generate-images\` skill，参数 \`${ep} paths {existing_changed_card_paths...}\``,
      `creator-generate-images\` skill，参数 \`${ep} storyboard-sheets\``,
      `director-review-storyboard-sheets-visual\` skill，参数 \`${ep} {successful_shots_union...}\``,
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
  }
});

test('storyboard repair rebuilds changed sheets before scoped visual review', () => {
  for (const [mode, ep] of [['short.md', 'ep01'], ['series.md', '{ep}']]) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('storyboard repair sheet rebuild');
    assert.ok(start >= 0, mode);
    const block = text.slice(start, text.indexOf('visual missing recovery', start));
    const stages = [
      'saved_full_generator_summary',
      'mode/created/updated/deleted',
      'existing_changed_card_paths',
      `creator-generate-images\` skill，参数 \`${ep} paths {existing_changed_card_paths...}\``,
      `creator-generate-images\` skill，参数 \`${ep} storyboard-sheets\``,
      'successful shots union',
      `director-review-storyboard-sheets-visual\` skill，参数 \`${ep} {successful_shots_union...}\``,
    ];
    let previous = -1;
    for (const stage of stages) {
      const index = block.indexOf(stage, previous + 1);
      assert.ok(index > previous, `${mode}: ${stage}`);
      previous = index;
    }
    assert.ok(block.includes('旧 PNG'));
    assert.ok(block.includes('历史 pass'));
    assert.ok(block.includes('owner generator summaries'));
    assert.equal(block.includes(
      `director-review-storyboard-sheets-visual\` skill，参数 \`${ep}\``), false,
    `${mode}: unscoped review`);
  }
});

test('repair routes storyboard invalid through the standard recovery entry', () => {
  const main = read('skills/repair-story/SKILL.md');
  assert.ok(main.includes('storyboard:invalid:{详情}'));
  assert.match(main, /storyboard:missing\|incomplete\|invalid/);
  for (const mode of ['series.md', 'short.md']) {
    const text = read(`skills/repair-story/${mode}`);
    const start = text.indexOf('storyboard recovery');
    const block = text.slice(start, text.indexOf('prompt owner loop', start));
    assert.ok(block.includes('storyboard:missing|incomplete|invalid'), mode);
    assert.ok(block.includes('使用 Skill tool 调用 `storyboarder-storyboard` skill'), mode);
  }
});
