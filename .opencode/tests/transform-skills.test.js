// Some assertions in this file are coupled to specific source skills such as
// `director-arc`, `auto-video`, and `writer-novel/rules.md`. See
// `.opencode/README.md` § 维护契约 for the sync checklist.
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtemp, readFile as readFileAsync, rm, readdir } from 'fs/promises';
import os from 'os';
import {
  parseSkillFile,
  rewriteFrontmatter,
  rewriteSkillCalls,
  injectLeafHint,
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
    'creator-image-dreamina': { agent: 'creator', fork: true },
    'writer-novel': { agent: 'writer', fork: true },
    'series-video': { agent: null, fork: false },
  };

  test('fork-skill call becomes task() invocation', () => {
    const input = '2. 使用 Skill tool 调用 `director-arc` skill, 传递参数: topic=xxx, episode=1';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('task('));
    assert.ok(out.includes('subagent_type: "director"'));
    assert.ok(out.includes('director-arc'));
  });

  test('fork-skill task prompt receives explicit standard call parameters', () => {
    const input = '使用 Skill tool 调用 `writer-novel` skill，参数 `{ep}`。';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('参数：\n{ep}\n'));
    assert.ok(!out.includes('<由调用方填充>'));
  });

  test('non-fork skill call becomes skill() invocation', () => {
    const input = '1. 使用 Skill tool 调用 series-video skill';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('skill({ name: "series-video" })'));
    assert.ok(!out.includes('task('));
  });

  test('non-fork skill call preserves explicit standard call parameters', () => {
    const input = '使用 Skill tool 调用 `series-video` skill，参数 `ep02`。';
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('skill({ name: "series-video" })'));
    assert.ok(out.includes('参数 `ep02`'));
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
    assert.ok(out.includes('task('));
    assert.ok(out.includes('示例代码：使用 Skill tool 调用 director-arc'));
    assert.ok(out.includes('skill({ name: "series-video" })'));
  });

  test('skips matches inside quote blocks (lines starting with >)', () => {
    const input = [
      '正文：使用 Skill tool 调用 director-arc',
      '> 引用：使用 Skill tool 调用 director-arc',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('task('));
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
      '步骤 3：使用 Skill tool 调用 creator-image-dreamina skill',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    assert.ok(out.includes('director-arc'));
    assert.ok(out.includes('series-video'));
    assert.ok(out.includes('creator-image-dreamina'));
    // Two fork dispatches → two task() blocks with subagent_type
    assert.equal((out.match(/subagent_type:/g) || []).length, 2);
    // Non-fork series-video becomes a top-level `调用 \`skill({ name: "series-video" })\``
    assert.ok(out.includes('调用 `skill({ name: "series-video" })`'));
  });
});

describe('injectLeafHint', () => {
  test('inserts hint at top of body for fork leaf', () => {
    const body = '# Title\n\n正文段落';
    const out = injectLeafHint(body, { fork: true, agent: 'director' });
    assert.match(out, /^> \*\*执行上下文\*\*/);
    assert.ok(out.includes('director'));
    assert.ok(out.includes(body));
  });

  test('does not inject for non-fork skill', () => {
    const body = '# Title\n\n正文';
    const out = injectLeafHint(body, { fork: false, agent: null });
    assert.equal(out, body);
  });
});

describe('injectDispatchDiscipline', () => {
  test('injects for user-invocable entry workflow', () => {
    const body = '# series-video\n\n正文';
    const out = injectDispatchDiscipline(body, {
      name: 'series-video', userInvocable: true
    });
    assert.ok(out.includes('派发约束'));
    assert.ok(out.includes('分段策略'));
    assert.ok(out.includes('反例'));
    assert.ok(out.includes(body));
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

  test('director-arc cache file has correct frontmatter', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'director-arc/SKILL.md'), 'utf-8'
    );
    assert.match(content, /^---\nname: "director-arc"/);
    assert.ok(!content.includes('\ncontext: fork'));
    assert.ok(content.includes('svd-context'));
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
    // I-3: source `失败处理（核心规则）` section must survive plugin transform
    assert.ok(content.includes('失败处理（核心规则）'),
      '失败处理 section from source SKILL.md must survive plugin transform');
  });

  test('aux files (rules.md) are copied', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const rulesPath = path.join(tmpDir, 'writer-novel/rules.md');
    const exists = await readFileAsync(rulesPath, 'utf-8').then(() => true).catch(() => false);
    assert.equal(exists, true);
  });

  test('standard skill calls in aux markdown are transformed', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'generate-episode-pipeline/new-series.md'), 'utf-8'
    );
    assert.ok(content.includes('description: "执行 creator-storyboard-sheet-prompts"'));
    assert.ok(content.includes('subagent_type: "creator"'));
    assert.ok(!content.includes('使用 Skill tool 调用 `creator-storyboard-sheet-prompts` skill'));
  });

  test('main skill resolves and reads transformed aux from cache', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const main = await readFileAsync(
      path.join(tmpDir, 'generate-episode-pipeline/SKILL.md'), 'utf8');
    const expected = path.join(tmpDir, 'generate-episode-pipeline/new-series.md');
    assert.ok(main.includes(`\`${expected}\``));
    assert.ok(!main.includes(
      `${PROJECT_ROOT}/skills/generate-episode-pipeline/new-series.md`));
    const aux = await readFileAsync(expected, 'utf8');
    assert.ok(aux.includes('description: "执行 creator-storyboard-sheet-prompts"'));
    assert.ok(aux.includes('subagent_type: "creator"'));
  });

  test('short repair standard recovery calls become OpenCode tasks', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'repair-story/short.md'), 'utf8');
    for (const [skill, agent] of [
      ['scriptwriter-script', 'scriptwriter'],
      ['director-review-script', 'director'],
      ['scriptwriter-fix-script', 'scriptwriter'],
      ['creator-create-assets', 'creator'],
    ]) {
      assert.ok(content.includes(`description: "执行 ${skill}"`), skill);
      assert.ok(content.includes(`subagent_type: "${agent}"`), agent);
    }
    assert.ok(content.includes('short ep01'));
  });

  test('repair aux tasks embed actual content-stage parameters', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    for (const [file, expected] of [
      ['short.md', ['short ep01', 'ep01']],
      ['series.md', ['{ep}', '{series_script_mode} {ep}']],
    ]) {
      const content = await readFileAsync(
        path.join(tmpDir, `repair-story/${file}`), 'utf8');
      const beforeImages = content.slice(0, content.indexOf('basic visual recovery'));
      assert.ok(!beforeImages.includes('<由调用方填充>'), file);
      for (const params of expected) {
        assert.ok(beforeImages.includes(`参数：\n${params}\n`),
          `${file}: ${params}`);
      }
    }
  });

  test('sheet image fix routes generation through a creator task', async () => {
    await transformAllSkills(PROJECT_ROOT, tmpDir);
    const content = await readFileAsync(
      path.join(tmpDir, 'creator-fix-storyboard-sheet-image/SKILL.md'), 'utf-8'
    );
    assert.ok(content.includes('description: "执行 creator-generate-images"'));
    assert.ok(content.includes('subagent_type: "creator"'));
    assert.ok(content.includes('{ep} paths {cards...}'));
    assert.ok(content.includes('router owns targeted PNG deletion'));
    assert.equal(content.includes('rm -f'), false);
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

describe('OC auto-video override shares core sections with CC source', () => {
  // 共享段：必须在两个 SKILL.md 里 byte-for-byte 一致
  // 注：`### 阶段 1: 解析参数` 不在此列 —— Task 1 重写了其 step 3
  // （CC: 秒→分钟 cron 换算；OC: INTERVAL ≥60 校验），属设计性分歧。
  const SHARED_HEADINGS = [
    '## 失败处理（核心规则）',
    '## 使用示例',
    '## 约束',
  ];

  test('shared sections byte-for-byte identical between CC and OC', async () => {
    const ccPath = path.join(PROJECT_ROOT, 'skills/auto-video/SKILL.md');
    const ocPath = path.join(
      PROJECT_ROOT, '.opencode/skill-overrides/auto-video/SKILL.md'
    );
    const cc = await readFileAsync(ccPath, 'utf-8');
    const oc = await readFileAsync(ocPath, 'utf-8');

    // 按 markdown heading 切分段（每段从 heading 开始到下一个同级或更高级 heading）
    const extractSection = (text, heading) => {
      const idx = text.indexOf('\n' + heading + '\n');
      if (idx === -1) return null;
      const start = idx + 1;
      // 找下一个 ## 或 ### heading（同级或更高级）
      const level = heading.match(/^#+/)[0].length;
      const nextHeadingRe = new RegExp(
        `\\n#{1,${level}} `, 'g'
      );
      nextHeadingRe.lastIndex = start + heading.length + 1;
      const m = nextHeadingRe.exec(text);
      const end = m ? m.index : text.length;
      return text.slice(start, end).trimEnd();
    };

    for (const heading of SHARED_HEADINGS) {
      const ccSection = extractSection(cc, heading);
      const ocSection = extractSection(oc, heading);
      assert.ok(ccSection, `CC SKILL.md 缺 heading: ${heading}`);
      assert.ok(ocSection, `OC override SKILL.md 缺 heading: ${heading}`);
      assert.equal(
        ocSection, ccSection,
        `共享段 "${heading}" 在 OC override 与 CC 源不一致。\n` +
        `CC 改了共享段后，请同步到 .opencode/skill-overrides/auto-video/SKILL.md。\n` +
        `CC 内容:\n${ccSection}\n\nOC override 内容:\n${ocSection}`
      );
    }
  });
});
