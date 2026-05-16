import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAgentFile, convertAgentFrontmatter, buildPermissionForAgent } from '../load-agents.js';

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

describe('buildPermissionForAgent', () => {
  const SCRIPTS = ['read-config.sh', 'asset-to-image-path.sh', 'image-gen-dreamina.sh',
                   'keyframe-to-prompt.sh', 'video-gen-dreamina.sh', 'word-count.sh',
                   'latest-episode.sh', 'check-episode.sh', 'storyboard-to-prompt.sh',
                   'video-check-dreamina.sh'];

  it('writer has bash deny-all', () => {
    const p = buildPermissionForAgent('writer', SCRIPTS);
    expect(p.bash['*']).toBe('deny');
    expect(p.task).toBe('allow');
    expect(p.skill).toBe('allow');
    expect(p.external_directory).toBe('deny');
  });

  it('director allows read-config.sh only', () => {
    const p = buildPermissionForAgent('director', SCRIPTS);
    expect(p.bash['bash $SVD_PLUGIN_DIR/scripts/read-config.sh*']).toBe('allow');
    expect(p.bash['bash $SVD_PLUGIN_DIR/scripts/image-gen-dreamina.sh*']).toBeUndefined();
    expect(p.bash['*']).toBe('deny');
  });

  it('creator allows all dreamina-related scripts + dreamina CLI', () => {
    const p = buildPermissionForAgent('creator', SCRIPTS);
    expect(p.bash['bash $SVD_PLUGIN_DIR/scripts/image-gen-dreamina.sh*']).toBe('allow');
    expect(p.bash['bash $SVD_PLUGIN_DIR/scripts/video-gen-dreamina.sh*']).toBe('allow');
    expect(p.bash['dreamina user_credit']).toBe('allow');
    expect(p.bash['dreamina query_result*']).toBe('allow');
    expect(p.bash['mv /tmp/dreamina-pending/*']).toBe('allow');
    expect(p.external_directory).toBe('allow');
  });

  it('scriptwriter & storyboarder mirror writer', () => {
    for (const a of ['scriptwriter', 'storyboarder']) {
      const p = buildPermissionForAgent(a, SCRIPTS);
      expect(p.bash['*']).toBe('deny');
      expect(p.external_directory).toBe('deny');
    }
  });

  it('throws on unknown agent', () => {
    expect(() => buildPermissionForAgent('unknown-agent', SCRIPTS))
      .toThrow(/Unknown agent.*unknown-agent/);
  });

  it('all agents inherit BASE_PERMISSION defaults', () => {
    for (const agent of ['director', 'writer', 'scriptwriter', 'storyboarder', 'creator']) {
      const p = buildPermissionForAgent(agent, SCRIPTS);
      expect(p.read, `${agent}.read`).toBe('allow');
      expect(p.edit, `${agent}.edit`).toBe('allow');
      expect(p.write, `${agent}.write`).toBe('allow');
      expect(p.task, `${agent}.task`).toBe('allow');
      expect(p.skill, `${agent}.skill`).toBe('allow');
      expect(p.webfetch, `${agent}.webfetch`).toBe('deny');
      expect(p.websearch, `${agent}.websearch`).toBe('deny');
      expect(p.todowrite, `${agent}.todowrite`).toBe('allow');
      expect(p.question, `${agent}.question`).toBe('allow');
    }
  });
});
