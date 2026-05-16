import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSkillFile, rewriteFrontmatter, rewriteBashPaths, rewriteSkillCalls } from '../lib/transform-skills.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('parseSkillFile', () => {
  it('parses frontmatter and body', async () => {
    const fp = path.join(__dirname, 'fixtures/skills/simple-leaf/SKILL.md');
    const { frontmatter, body } = await parseSkillFile(fp);
    expect(frontmatter.name).toBe('simple-leaf');
    expect(frontmatter.agent).toBe('director');
    expect(frontmatter.context).toBe('fork');
    expect(body).toContain('简单 leaf');
  });
});

describe('rewriteFrontmatter', () => {
  it('keeps name and description, drops context/agent/user-invocable/allowed-tools/model', () => {
    const fm = rewriteFrontmatter({
      name: 'x', description: 'd', 'context': 'fork', agent: 'director',
      'user-invocable': 'true', 'allowed-tools': 'Read, Write', model: 'opus'
    });
    expect(fm).toMatchObject({
      name: 'x',
      description: 'd',
    });
    expect(fm.context).toBeUndefined();
    expect(fm.agent).toBeUndefined();
  });

  it('moves dropped fields to metadata', () => {
    const fm = rewriteFrontmatter({
      name: 'x', description: 'd', agent: 'director', context: 'fork',
      'user-invocable': 'true', model: 'sonnet'
    });
    expect(fm.metadata['svd-agent']).toBe('director');
    expect(fm.metadata['svd-context']).toBe('fork');
    expect(fm.metadata['svd-user-invocable']).toBe('true');
    expect(fm.metadata['svd-model']).toBe('sonnet');
  });

  it('clips description to 1024 chars', () => {
    const fm = rewriteFrontmatter({ name: 'x', description: 'a'.repeat(2000) });
    expect(fm.description.length).toBe(1024);
  });
});

describe('rewriteBashPaths', () => {
  it('prefixes scripts/ with $SVD_PLUGIN_DIR/', () => {
    const out = rewriteBashPaths('bash scripts/foo.sh arg1 arg2');
    expect(out).toBe('bash $SVD_PLUGIN_DIR/scripts/foo.sh arg1 arg2');
  });

  it('handles multiple occurrences', () => {
    const input = 'bash scripts/a.sh\nbash scripts/b.sh';
    const out = rewriteBashPaths(input);
    expect(out).toBe('bash $SVD_PLUGIN_DIR/scripts/a.sh\nbash $SVD_PLUGIN_DIR/scripts/b.sh');
  });

  it('does not touch already-prefixed paths', () => {
    const input = 'bash $SVD_PLUGIN_DIR/scripts/foo.sh';
    expect(rewriteBashPaths(input)).toBe(input);
  });

  it('does not touch non-scripts paths', () => {
    const input = 'bash other/foo.sh';
    expect(rewriteBashPaths(input)).toBe(input);
  });

  it('does not touch markdown prose mentions of scripts/', () => {
    const input = '本步骤需要项目中的 scripts/foo.sh 脚本';
    expect(rewriteBashPaths(input)).toBe(input);
  });
});

describe('rewriteSkillCalls', () => {
  const skillMeta = {
    'director-arc': { agent: 'director', fork: true },
    'creator-image-dreamina': { agent: 'creator', fork: true },
    'series-video': { agent: null, fork: false },
  };

  it('fork-skill call becomes task() invocation', () => {
    const input = '2. 使用 Skill tool 调用 `director-arc` skill, 传递参数: topic=xxx, episode=1';
    const out = rewriteSkillCalls(input, skillMeta);
    expect(out).toContain('task(');
    expect(out).toContain('subagent_type: "director"');
    expect(out).toContain('director-arc');
  });

  it('non-fork skill call becomes skill() invocation', () => {
    const input = '1. 使用 Skill tool 调用 series-video skill';
    const out = rewriteSkillCalls(input, skillMeta);
    expect(out).toContain('skill({ name: "series-video" })');
    expect(out).not.toContain('task(');
  });

  it('does not affect prose mentions', () => {
    const input = '说明：series-video skill 是入口；director-arc 是其下游';
    const out = rewriteSkillCalls(input, skillMeta);
    expect(out).toBe(input);
  });

  it('throws on unknown skill reference', () => {
    const input = '使用 Skill tool 调用 nonexistent-skill';
    expect(() => rewriteSkillCalls(input, skillMeta)).toThrow(/nonexistent-skill/);
  });

  it('skips matches inside fenced code blocks', () => {
    const input = [
      '正文：使用 Skill tool 调用 director-arc',
      '```',
      '示例代码：使用 Skill tool 调用 director-arc',
      '```',
      '继续：使用 Skill tool 调用 series-video',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    expect(out).toContain('task(');
    expect(out).toContain('示例代码：使用 Skill tool 调用 director-arc');
    expect(out).toContain('skill({ name: "series-video" })');
  });

  it('skips matches inside quote blocks (lines starting with >)', () => {
    const input = [
      '正文：使用 Skill tool 调用 director-arc',
      '> 引用：使用 Skill tool 调用 director-arc',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    expect(out).toContain('task(');
    expect(out).toContain('> 引用：使用 Skill tool 调用 director-arc');
  });

  it('rewrites multiple calls in same document', () => {
    const input = [
      '步骤 1：使用 Skill tool 调用 director-arc skill',
      '步骤 2：使用 Skill tool 调用 series-video skill',
      '步骤 3：使用 Skill tool 调用 creator-image-dreamina skill',
    ].join('\n');
    const out = rewriteSkillCalls(input, skillMeta);
    expect(out).toContain('director-arc');
    expect(out).toContain('series-video');
    expect(out).toContain('creator-image-dreamina');
    // Two fork dispatches → two task() blocks with subagent_type
    expect((out.match(/subagent_type:/g) || []).length).toBe(2);
    // Non-fork series-video becomes a top-level `调用 \`skill({ name: "series-video" })\``
    expect(out).toContain('调用 `skill({ name: "series-video" })`');
  });
});

import { injectLeafHint } from '../lib/transform-skills.js';

describe('injectLeafHint', () => {
  it('inserts hint at top of body for fork leaf', () => {
    const body = '# Title\n\n正文段落';
    const out = injectLeafHint(body, { fork: true, agent: 'director' });
    expect(out).toMatch(/^> \*\*执行上下文\*\*/);
    expect(out).toContain('director');
    expect(out).toContain(body);
  });

  it('does not inject for non-fork skill', () => {
    const body = '# Title\n\n正文';
    const out = injectLeafHint(body, { fork: false, agent: null });
    expect(out).toBe(body);
  });
});

import { injectEntryWorkflowGuidance } from '../lib/transform-skills.js';

describe('injectEntryWorkflowGuidance', () => {
  it('injects for user-invocable entry workflow', () => {
    const body = '# series-video\n\n正文';
    const out = injectEntryWorkflowGuidance(body, {
      name: 'series-video', userInvocable: true
    });
    expect(out).toContain('写入约束');
    expect(out).toContain('3000 字符');
    expect(out).toContain(body);
  });

  it('does not inject for non-entry skill', () => {
    const body = '# director-arc\n\n正文';
    const out = injectEntryWorkflowGuidance(body, {
      name: 'director-arc', userInvocable: false
    });
    expect(out).toBe(body);
  });

  it('does not inject for user-invocable skill NOT in entry list', () => {
    const body = '# some-future-skill\n\n正文';
    const out = injectEntryWorkflowGuidance(body, {
      name: 'some-future-skill', userInvocable: true
    });
    expect(out).toBe(body);
  });
});

import { rewriteAutoVideoCron } from '../lib/transform-skills.js';

describe('rewriteAutoVideoCron', () => {
  it('replaces CronCreate/List/Delete sections with bash crontab body', () => {
    const body = '## 安装\n\n调用 CronCreate(...) 创建。\n\n## 查询\n\n调用 CronList(...).';
    const out = rewriteAutoVideoCron(body);
    expect(out).not.toContain('CronCreate');
    expect(out).not.toContain('CronList');
    expect(out).not.toContain('CronDelete');
    expect(out).toContain('crontab');
    expect(out).toContain('opencode run --session');
  });
});
