// Some assertions in this file are coupled to the source `agents/` directory
// (5 agents hardcoded: creator/director/scriptwriter/storyboarder/writer) and
// to `AGENT_BASH_CONFIG` in `.opencode/lib/load-agents.js` (5-agent permission
// matrix). If you add/remove/rename agents, expect failures — see
// `.opencode/README.md` § 维护契约 for the sync checklist.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAgentFile, convertAgentFrontmatter, buildPermissionForAgent, loadAllAgents } from '../lib/load-agents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures/agents/director.md');
const NO_FM = path.join(__dirname, 'fixtures/agents/no-frontmatter.md');
const QUOTED = path.join(__dirname, 'fixtures/agents/quoted-values.md');

describe('parseAgentFile', () => {
  test('parses frontmatter and body', async () => {
    const { frontmatter, body } = await parseAgentFile(FIXTURE);
    assert.equal(frontmatter.name, 'director');
    assert.ok(frontmatter.description);
    assert.ok(body.length > 100);
    assert.ok(!body.includes('---\nname:'));  // frontmatter 已剥离
  });

  test('handles frontmatter with tools field', async () => {
    const { frontmatter } = await parseAgentFile(FIXTURE);
    // CC 格式的 tools 是逗号分隔字符串
    if (frontmatter.tools !== undefined) {
      assert.equal(typeof frontmatter.tools, 'string');
    }
  });
});

describe('parseAgentFile error handling', () => {
  test('throws when frontmatter is missing', async () => {
    await assert.rejects(parseAgentFile(NO_FM), /No YAML frontmatter found/);
  });
});

describe('parseSimpleYaml via parseAgentFile', () => {
  test('strips matching double quotes', async () => {
    const { frontmatter } = await parseAgentFile(QUOTED);
    assert.equal(frontmatter.description, 'Quoted description value');
  });

  test('strips matching single quotes', async () => {
    const { frontmatter } = await parseAgentFile(QUOTED);
    assert.equal(frontmatter.single, 'single-quoted');
  });

  test('preserves unmatched quotes', async () => {
    const { frontmatter } = await parseAgentFile(QUOTED);
    assert.equal(frontmatter.mixed, '"no closing quote');
  });
});

describe('convertAgentFrontmatter', () => {
  test('drops tools field', () => {
    const out = convertAgentFrontmatter({
      name: 'director', description: 'Director', tools: 'Read, Write', model: 'inherit'
    });
    assert.equal(out.tools, undefined);
  });

  test('drops model:inherit', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'D', model: 'inherit' });
    assert.equal(out.model, undefined);
  });

  test('keeps model when not inherit', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'D', model: 'opus' });
    assert.equal(out.model, 'opus');
  });

  test('sets mode subagent', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'D' });
    assert.equal(out.mode, 'subagent');
  });

  test('passes through description', () => {
    const out = convertAgentFrontmatter({ name: 'd', description: 'My desc' });
    assert.equal(out.description, 'My desc');
  });
});

describe('buildPermissionForAgent', () => {
  const SCRIPTS = ['read-config.sh', 'asset-to-image-path.sh', 'image-gen-dreamina.sh',
                   'keyframe-to-prompt.sh', 'video-gen-dreamina.sh', 'word-count.sh',
                   'latest-episode.sh', 'check-episode.sh', 'storyboard-to-prompt.sh',
                   'video-check-dreamina.sh'];

  test('writer has bash deny-all', () => {
    const p = buildPermissionForAgent('writer', SCRIPTS);
    assert.equal(p.bash['*'], 'deny');
    assert.equal(p.task, 'allow');
    assert.equal(p.skill, 'allow');
    // All 5 agents now blanket-allow external_directory (zero-popup UX goal).
    assert.equal(p.external_directory, 'allow');
  });

  test('director allows read-config.sh only', () => {
    const p = buildPermissionForAgent('director', SCRIPTS);
    assert.equal(p.bash['bash $SVD_PLUGIN_DIR/scripts/read-config.sh*'], 'allow');
    assert.equal(p.bash['bash $SVD_PLUGIN_DIR/scripts/image-gen-dreamina.sh*'], undefined);
    assert.equal(p.bash['*'], 'deny');
  });

  test('creator allows all dreamina-related scripts + dreamina CLI', () => {
    const p = buildPermissionForAgent('creator', SCRIPTS);
    assert.equal(p.bash['bash $SVD_PLUGIN_DIR/scripts/image-gen-dreamina.sh*'], 'allow');
    assert.equal(p.bash['bash $SVD_PLUGIN_DIR/scripts/video-gen-dreamina.sh*'], 'allow');
    assert.equal(p.bash['dreamina user_credit'], 'allow');
    assert.equal(p.bash['dreamina query_result*'], 'allow');
    assert.equal(p.bash['mv /tmp/dreamina-pending/*'], 'allow');
    assert.equal(p.external_directory, 'allow');
  });

  test('scriptwriter & storyboarder mirror writer', () => {
    for (const a of ['scriptwriter', 'storyboarder']) {
      const p = buildPermissionForAgent(a, SCRIPTS);
      assert.equal(p.bash['*'], 'deny');
      assert.equal(p.external_directory, 'allow');
    }
  });

  test('all 5 agents have external_directory: allow (zero-popup UX)', () => {
    // Rationale: OC's permission evaluator uses findLast (last-match-wins).
    // Any object-based external_directory rule with even a single deny would
    // either block legitimate cache reads or trigger ask dialogs on other
    // external paths. Blanket allow is the only way to keep zero popups.
    for (const a of ['director', 'writer', 'scriptwriter', 'storyboarder', 'creator']) {
      const p = buildPermissionForAgent(a, SCRIPTS);
      assert.equal(p.external_directory, 'allow', `${a} should be 'allow'`);
    }
  });

  test('throws on unknown agent', () => {
    assert.throws(
      () => buildPermissionForAgent('unknown-agent', SCRIPTS),
      /Unknown agent.*unknown-agent/
    );
  });

  test('all agents inherit BASE_PERMISSION defaults', () => {
    for (const agent of ['director', 'writer', 'scriptwriter', 'storyboarder', 'creator']) {
      const p = buildPermissionForAgent(agent, SCRIPTS);
      assert.equal(p.read, 'allow', `${agent}.read`);
      assert.equal(p.edit, 'allow', `${agent}.edit`);
      assert.equal(p.write, 'allow', `${agent}.write`);
      assert.equal(p.task, 'allow', `${agent}.task`);
      assert.equal(p.skill, 'allow', `${agent}.skill`);
      assert.equal(p.webfetch, 'deny', `${agent}.webfetch`);
      assert.equal(p.websearch, 'deny', `${agent}.websearch`);
      assert.equal(p.todowrite, 'allow', `${agent}.todowrite`);
      assert.equal(p.question, 'allow', `${agent}.question`);
    }
  });
});

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('loadAllAgents (integration)', () => {
  test('loads all 5 agents from real project', async () => {
    const agents = await loadAllAgents(PROJECT_ROOT);
    assert.deepStrictEqual(Object.keys(agents).sort(), [
      'creator', 'director', 'scriptwriter', 'storyboarder', 'writer',
    ]);
  });

  test('each agent has required OC fields', async () => {
    const agents = await loadAllAgents(PROJECT_ROOT);
    for (const [name, def] of Object.entries(agents)) {
      assert.ok(def.description, `${name}.description`);
      assert.equal(def.mode, 'subagent', `${name}.mode`);
      assert.ok(def.prompt, `${name}.prompt`);
      assert.ok(def.permission, `${name}.permission`);
      assert.equal(def.permission.task, 'allow');
      assert.equal(def.permission.skill, 'allow');
    }
  });

  test('creator gets all script allowlist entries', async () => {
    const agents = await loadAllAgents(PROJECT_ROOT);
    const bash = agents.creator.permission.bash;
    assert.equal(bash['bash $SVD_PLUGIN_DIR/scripts/image-gen-dreamina.sh*'], 'allow');
    assert.equal(bash['bash $SVD_PLUGIN_DIR/scripts/video-gen-dreamina.sh*'], 'allow');
  });

  test('agent prompt includes OC execution contract', async () => {
    const agents = await loadAllAgents(PROJECT_ROOT);
    assert.ok(agents.director.prompt.includes('OC 执行契约'));
    assert.ok(agents.director.prompt.includes('skill({ name:'));
  });
});
