import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSkillFile } from '../lib/transform-skills.js';

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
