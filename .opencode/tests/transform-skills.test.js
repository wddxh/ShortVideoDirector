import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSkillFile, rewriteFrontmatter } from '../lib/transform-skills.js';

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
