import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAgentFile, convertAgentFrontmatter } from '../load-agents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures/agents/director.md');
const NO_FM = path.join(__dirname, 'fixtures/agents/no-frontmatter.md');
const QUOTED = path.join(__dirname, 'fixtures/agents/quoted-values.md');

describe('parseAgentFile', () => {
  it('parses frontmatter and body', async () => {
    const { frontmatter, body } = await parseAgentFile(FIXTURE);
    expect(frontmatter.name).toBe('director');
    expect(frontmatter.description).toBeTruthy();
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toContain('---\nname:');  // frontmatter 已剥离
  });

  it('handles frontmatter with tools field', async () => {
    const { frontmatter } = await parseAgentFile(FIXTURE);
    // CC 格式的 tools 是逗号分隔字符串
    if (frontmatter.tools !== undefined) {
      expect(typeof frontmatter.tools).toBe('string');
    }
  });
});

describe('parseAgentFile error handling', () => {
  it('throws when frontmatter is missing', async () => {
    await expect(parseAgentFile(NO_FM)).rejects.toThrow(/No YAML frontmatter found/);
  });
});

describe('parseSimpleYaml via parseAgentFile', () => {
  it('strips matching double quotes', async () => {
    const { frontmatter } = await parseAgentFile(QUOTED);
    expect(frontmatter.description).toBe('Quoted description value');
  });

  it('strips matching single quotes', async () => {
    const { frontmatter } = await parseAgentFile(QUOTED);
    expect(frontmatter.single).toBe('single-quoted');
  });

  it('preserves unmatched quotes', async () => {
    const { frontmatter } = await parseAgentFile(QUOTED);
    expect(frontmatter.mixed).toBe('"no closing quote');
  });
});

describe('convertAgentFrontmatter', () => {
  it('drops tools field', () => {
    const out = convertAgentFrontmatter({
      name: 'director', description: 'Director', tools: 'Read, Write', model: 'inherit'
    });
    expect(out.tools).toBeUndefined();
  });

  it('drops model:inherit', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'D', model: 'inherit' });
    expect(out.model).toBeUndefined();
  });

  it('keeps model when not inherit', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'D', model: 'opus' });
    expect(out.model).toBe('opus');
  });

  it('sets mode subagent', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'D' });
    expect(out.mode).toBe('subagent');
  });

  it('passes through description', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'My desc' });
    expect(out.description).toBe('My desc');
  });
});
