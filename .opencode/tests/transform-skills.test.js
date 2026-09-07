// Some assertions in this file are coupled to specific source skills such as
// `director-arc`, `auto-video`, and `writer-novel/rules.md`. See
// `.opencode/README.md` § 维护契约 for the sync checklist.
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtemp, readFile as readFileAsync, rm, readdir, mkdir, writeFile } from 'fs/promises';
import os from 'os';
import { NATIVE_QUESTION_GUIDANCE } from '../lib/tool-mapping.js';
import {
  parseSkillFile,
  rewriteFrontmatter,
  rewriteSkillCalls,
  injectDispatchDiscipline,
  transformAllSkills,
} from '../lib/transform-skills.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('parseSkillFile', () => {
  test('parses frontmatter and body', async () => {
    const fp = path.join(__dirname, 'fixtures/skills/simple-leaf/SKILL.md');
    const { frontmatter, body } = await parseSkillFile(fp);
    assert.equal(frontmatter.name, 'simple-leaf');
    assert.equal(frontmatter.agent, 'director');
    assert.equal(frontmatter.context, 'fork');
    assert.ok(body.includes('简单 leaf'));
  });
});

describe('rewriteFrontmatter', () => {
  test('source role capabilities preserve descriptions and association without fork', async () => {
    const roles = new Set(['director', 'creator', 'writer', 'scriptwriter', 'storyboarder']);
    let checked = 0;
    for (const entry of await readdir(path.join(PROJECT_ROOT, 'skills'))) {
      if (![...roles].some(role => entry.startsWith(`${role}-`))) continue;
      const file = path.join(PROJECT_ROOT, 'skills', entry, 'SKILL.md');
      if (!await readFileAsync(file).then(() => true, () => false)) continue;
      const { frontmatter } = await parseSkillFile(file);
      assert.ok(roles.has(frontmatter.agent), entry);
      assert.equal(frontmatter.context, undefined, entry);
      const mapped = rewriteFrontmatter(frontmatter);
      assert.equal(mapped.description, frontmatter.description);
      assert.equal(mapped.metadata['svd-agent'], frontmatter.agent);
      checked++;
    }
    assert.ok(checked > 0);
  });

  test('keeps name and description, drops context/agent/user-invocable/allowed-tools/model', () => {
    const fm = rewriteFrontmatter({
      name: 'x', description: 'd', 'context': 'fork', agent: 'director',
      'user-invocable': 'true', 'allowed-tools': 'Read, Write', model: 'opus'
    });
    assert.equal(fm.name, 'x');
    assert.equal(fm.description, 'd');
    assert.equal(fm.context, undefined);
    assert.equal(fm.agent, undefined);
  });

  test('moves dropped fields to metadata', () => {
    const fm = rewriteFrontmatter({
      name: 'x', description: 'd', agent: 'director', context: 'fork',
      'user-invocable': 'true', model: 'sonnet'
    });
    assert.equal(fm.metadata['svd-agent'], 'director');
    assert.equal(fm.metadata['svd-context'], 'fork');
    assert.equal(fm.metadata['svd-user-invocable'], 'true');
    assert.equal(fm.metadata['svd-model'], 'sonnet');
  });

  test('clips description to 1024 chars', () => {
    const fm = rewriteFrontmatter({ name: 'x', description: 'a'.repeat(2000) });
    assert.equal(fm.description.length, 1024);
  });
});

describe('rewriteSkillCalls', () => {
  const skillMeta = {
    'director-arc': { agent: 'director', fork: true },
    'creator-provider-dreamina': { agent: 'creator', fork: false },
    'writer-novel': { agent: 'writer', fork: true },
    'series-video': { agent: null, fork: false },
  };

  test('role skill loads locally even with legacy fork metadata', () => {
    const input = '使用 Skill tool 调用 `director-arc` skill，评估当前系列转折。';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.equal(out, '调用 `skill({ name: "director-arc" })`，评估当前系列转折。');
  });

  test('local load preserves the natural-language commission', () => {
    const input = '使用 Skill tool 调用 `writer-novel` skill，参考 ep01/notes.md，只诊断动机。';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.equal(out, '调用 `skill({ name: "writer-novel" })`，参考 ep01/notes.md，只诊断动机。');
  });

  test('non-fork skill call becomes skill() invocation', () => {
    const input = '1. 使用 Skill tool 调用 series-video skill';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('skill({ name: "series-video" })'));
    assert.ok(!out.includes('task('));
  });

  test('entry load preserves mixed references and intent', () => {
    const input = '使用 Skill tool 调用 `series-video` skill，继续下一集，参考 "notes two.md"。';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('skill({ name: "series-video" })'));
    assert.ok(out.endsWith('，继续下一集，参考 "notes two.md"。'));
  });

  test('does not affect prose mentions', () => {
    const input = '说明：series-video skill 是入口；director-arc 是其下游';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.equal(out, input);
  });

  test('throws on unknown skill reference', () => {
    const input = '使用 Skill tool 调用 nonexistent-skill';
    assert.throws(() => rewriteSkillCalls(input, skillMeta), /nonexistent-skill/);
  });

  test('skips matches inside fenced code blocks', () => {
    const input = [
      '正文：使用 Skill tool 调用 director-arc',
      '```',
      '示例代码：使用 Skill tool 调用 director-arc',
      '```',
      '继续：使用 Skill tool 调用 series-video',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('skill({ name: "director-arc" })'));
    assert.ok(out.includes('示例代码：使用 Skill tool 调用 director-arc'));
    assert.ok(out.includes('skill({ name: "series-video" })'));
  });

  test('skips matches inside quote blocks (lines starting with >)', () => {
    const input = [
      '正文：使用 Skill tool 调用 director-arc',
      '> 引用：使用 Skill tool 调用 director-arc',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('skill({ name: "director-arc" })'));
    assert.ok(out.includes('> 引用：使用 Skill tool 调用 director-arc'));
  });

  test('skips templated skill references (name followed by {)', () => {
    const input = '6. 使用 Skill tool 调用 `creator-image-{图像模型值}` skill, 传递参数：路径';
    const out = rewriteSkillCalls(input, skillMeta);
    // Templated ref preserved verbatim — no throw, no rewrite
    assert.equal(out, input);
  });

  test('rewrites multiple calls in same document', () => {
    const input = [
      '步骤 1：使用 Skill tool 调用 director-arc skill',
      '步骤 2：使用 Skill tool 调用 series-video skill',
      '步骤 3：使用 Skill tool 调用 creator-provider-dreamina skill',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('director-arc'));
    assert.ok(out.includes('series-video'));
    assert.ok(out.includes('creator-provider-dreamina'));
    assert.equal((out.match(/skill\(\{/g) || []).length, 3);
    assert.ok(!out.includes('task('));
    assert.ok(out.includes('调用 `skill({ name: "series-video" })`'));
  });
});

describe('injectDispatchDiscipline', () => {
  test('injects for user-invocable entry workflow', () => {
    for (const name of ['short-video', 'series-video']) {
      const body = `# ${name}\n\nBody`;
      const out = injectDispatchDiscipline(body, { name, userInvocable: true });
      assert.ok(out.includes(NATIVE_QUESTION_GUIDANCE), name);
      assert.ok(out.endsWith(body));
    }
  });

  test('does not inject for non-entry skill', () => {
    const body = '# director-arc\n\n正文';
    const out = injectDispatchDiscipline(body, {
      name: 'director-arc', userInvocable: false
    });
    assert.equal(out, body);
  });

  test('does not inject for user-invocable skill NOT in entry list', () => {
    const body = '# some-future-skill\n\n正文';
    const out = injectDispatchDiscipline(body, {
      name: 'some-future-skill', userInvocable: true
    });
    assert.equal(out, body);
  });
});

describe('transformAllSkills (integration)', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'svd-cache-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('retired scheduler and route guides are absent from source and cache', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    for (const root of [path.join(PROJECT_ROOT, 'skills'), tmpDir]) {
      for (const relative of [
        'generate-episode-pipeline/SKILL.md',
        'generate-episode-pipeline/new-series.md',
        'generate-episode-pipeline/continue-series.md',
        'generate-episode-pipeline/short.md',
        'edit-story/series.md', 'edit-story/short.md',
        'repair-story/series.md', 'repair-story/short.md',
      ]) {
        await assert.rejects(readFileAsync(path.join(root, relative)), { code: 'ENOENT' });
      }
    }
  });

  test('produces one SKILL.md for every source skill', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const skillNames = async (root) => {
      const entries = await readdir(root, { withFileTypes: true });
      const names = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skill = path.join(root, entry.name, 'SKILL.md');
        const exists = await readFileAsync(skill).then(() => true).catch(() => false);
        if (exists) names.push(entry.name);
      }
      return names.sort();
    };
    assert.deepEqual(
      await skillNames(tmpDir),
      await skillNames(path.join(PROJECT_ROOT, 'skills')),
    );
  });

  test('provider package retains sibling guides and retires old entries', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const dir = path.join(tmpDir, 'creator-provider-dreamina');
    const { body } = await parseSkillFile(path.join(dir, 'SKILL.md'));
    const transformed = await readFileAsync(path.join(dir, 'SKILL.md'), 'utf8');
    assert.match(transformed, /svd-agent: "creator"/);
    for (const name of ['capabilities', 'image', 'video']) {
      assert.ok(body.includes(`](${name}.md)`));
      const guide = await readFileAsync(path.join(dir, `${name}.md`), 'utf8');
      const source = await readFileAsync(path.join(
        PROJECT_ROOT, 'skills/creator-provider-dreamina', `${name}.md`), 'utf8');
      assert.equal(guide, source
        .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/', `${tmpDir}/`)
        .replaceAll('${CLAUDE_PLUGIN_ROOT}', PROJECT_ROOT));
    }
    for (const name of ['creator-image-dreamina', 'creator-video-dreamina']) {
      await assert.rejects(readFileAsync(path.join(tmpDir, name, 'SKILL.md')), { code: 'ENOENT' });
    }
  });

  test('director-arc cache file has correct frontmatter', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'director-arc/SKILL.md'), 'utf-8'
    );
    assert.match(content, /^---\nname: "director-arc"/);
    assert.ok(!content.includes('\ncontext: fork'));
    assert.ok(content.includes('svd-agent: "director"'));
    assert.ok(!content.includes('svd-context'));
  });

  test('auto-video cache uses OC override (no CronCreate, no crontab)', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'auto-video/SKILL.md'), 'utf-8'
    );
    // OC override 标志：含 nohup loop + task tool 提及
    assert.ok(content.includes('nohup'));
    assert.ok(content.includes('task tool'));
    // CC 专属机制不应出现
    assert.ok(!content.includes('CronCreate'));
    assert.ok(!content.includes('系统 crontab'));
  });

  test('series-video cache has dispatch discipline directive at top of body', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'series-video/SKILL.md'), 'utf-8'
    );
    assert.ok(content.includes('派发约束（OC 专用'));
    // I-2: ensure injection lands AT TOP of body — i.e., `派发约束` is the
    // FIRST `## ` heading in the body (no other heading before it).
    const fmOpen = content.indexOf('---');
    const fmClose = content.indexOf('\n---', fmOpen + 3);
    const bodyStart = fmClose + 4;
    const firstHeadingIdx = content.indexOf('## ', bodyStart);
    const dispatchHeadingIdx = content.indexOf('## 派发约束', bodyStart);
    assert.ok(firstHeadingIdx > 0 && firstHeadingIdx === dispatchHeadingIdx,
      'dispatch discipline directive should be the FIRST ## heading in body');
    const { body } = await parseSkillFile(path.join(PROJECT_ROOT, 'skills/series-video/SKILL.md'));
    assert.ok(content.includes(body
      .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/', `${tmpDir}/`)
      .replaceAll('${CLAUDE_PLUGIN_ROOT}', PROJECT_ROOT)));
  });

  test('decision references retain complete source content in the cache', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    for (const relative of [
      'short-video/config-template.md', 'series-video/config-template.md',
      'director-input-confirm/short.md', 'director-input-confirm/series.md',
      'director-plot-options/short.md', 'director-plot-options/series.md',
      'director-outline/reference-workflows.md',
    ]) {
      const source = await readFileAsync(path.join(PROJECT_ROOT, 'skills', relative), 'utf8');
      const cached = await readFileAsync(path.join(tmpDir, relative), 'utf8');
      assert.equal(cached, source
        .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/', `${tmpDir}/`)
        .replaceAll('${CLAUDE_PLUGIN_ROOT}', PROJECT_ROOT), relative);
    }
  });

  test('standard skill calls in aux markdown are transformed', async () => {
    const source = path.join(tmpDir, 'source');
    const cache = path.join(tmpDir, 'cache');
    const skillDir = path.join(source, 'skills/creator-create-assets');
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, 'SKILL.md'),
      '---\nname: creator-create-assets\ndescription: fixture\nagent: creator\n---\nBody');
    await writeFile(path.join(skillDir, 'rules.md'),
      '使用 Skill tool 调用 `creator-create-assets` skill，只诊断当前剧本的资产缺口。');
    await transformAllSkills(source, cache);
    const content = await readFileAsync(
      path.join(cache, 'creator-create-assets/rules.md'), 'utf-8'
    );
    assert.equal(content, '调用 `skill({ name: "creator-create-assets" })`，只诊断当前剧本的资产缺口。');
  });

  test('main skill resolves and reads transformed aux from cache', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const main = await readFileAsync(
      path.join(tmpDir, 'creator-create-assets/SKILL.md'), 'utf8');
    const expected = path.join(tmpDir, 'creator-create-assets/rules.md');
    assert.ok(main.includes(`\`${expected}\``));
    assert.ok(!main.includes(
      `${PROJECT_ROOT}/skills/creator-create-assets/rules.md`));
    const aux = await readFileAsync(expected, 'utf8');
    const source = await readFileAsync(
      path.join(PROJECT_ROOT, 'skills/creator-create-assets/rules.md'), 'utf8');
    assert.equal(aux, source
      .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/', `${tmpDir}/`)
      .replaceAll('${CLAUDE_PLUGIN_ROOT}', PROJECT_ROOT));
  });

  test('.md aux files have ${CLAUDE_PLUGIN_ROOT} inline-substituted', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    // 扫描所有 cache 内的 .md aux（非 SKILL.md），断言无字面残留
    const skillDirs = await readdir(tmpDir);
    let checkedAny = false;
    for (const sd of skillDirs) {
      const skillPath = path.join(tmpDir, sd);
      const files = await readdir(skillPath).catch(() => []);
      for (const f of files) {
        if (f === 'SKILL.md' || !f.endsWith('.md')) continue;
        const content = await readFileAsync(path.join(skillPath, f), 'utf-8');
        checkedAny = true;
        assert.ok(!content.includes('${CLAUDE_PLUGIN_ROOT}'),
          `aux 文件 ${sd}/${f} 仍含字面 \${CLAUDE_PLUGIN_ROOT}`);
        // 若源文件含此 token，则 cache 必含已替换的 PROJECT_ROOT 路径
      }
    }
    assert.ok(checkedAny, '应至少检查到一个 .md aux 文件');
  });

  test('OC override 文件被使用并覆盖 CC 源', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'auto-video/SKILL.md'), 'utf-8'
    );
    // OC 版关键标记：task tool + 前置条件
    assert.ok(content.includes('task tool'),
      'OC override 内容应含 "task tool"');
    assert.ok(content.includes('## 前置条件'),
      'OC override 内容应含 "## 前置条件"');
    // 旧 cron 实现不应再出现
    assert.ok(!content.includes('系统 crontab'),
      'cache 不应再含 "系统 crontab"');
    assert.ok(!content.includes('opencode run --session'),
      'cache 不应再含 "opencode run --session"');
  });

  test('OC override 目录的 aux 文件复制到 cache', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const loopSh = path.join(tmpDir, 'auto-video/loop.sh');
    const cronPrompt = path.join(tmpDir, 'auto-video/cron-prompt.txt');
    const { access } = await import('fs/promises');
    await access(loopSh);  // 应抛错就是 fail
    await access(cronPrompt);
    // 内容 sanity
    const loopContent = await readFileAsync(loopSh, 'utf-8');
    assert.ok(loopContent.includes('FAIL_COUNT'),
      'loop.sh 应含 FAIL_COUNT 健康检查');
    const promptContent = await readFileAsync(cronPrompt, 'utf-8');
    assert.ok(promptContent.includes('{{TARGET}}'),
      'cron-prompt.txt 应含 {{TARGET}} 模板占位符');
  });
});

describe('monitor adapter metadata', () => {
  test('both hosts retain the public monitor ID and task capability', async () => {
    const ccPath = path.join(PROJECT_ROOT, 'skills/auto-video/SKILL.md');
    const ocPath = path.join(
      PROJECT_ROOT, '.opencode/skill-overrides/auto-video/SKILL.md'
    );
    for (const file of [ccPath, ocPath]) {
      const { frontmatter } = await parseSkillFile(file);
      assert.equal(frontmatter.name, 'auto-video');
      assert.equal(String(frontmatter['user-invocable']), 'true');
      assert.ok(frontmatter['allowed-tools'].split(', ').includes('Task'));
    }

  });
});
