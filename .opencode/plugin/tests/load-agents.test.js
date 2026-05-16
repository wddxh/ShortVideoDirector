import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAgentFile } from '../load-agents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures/agents/director.md');

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
