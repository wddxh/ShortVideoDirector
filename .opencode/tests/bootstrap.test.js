import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBootstrap } from '../lib/bootstrap.js';
import { ROLE_HANDOFF_GUIDANCE } from '../lib/tool-mapping.js';

describe('generateBootstrap', () => {
  const sampleAgents = {
    reviewer: { description: 'Independent reviewer' },
    scriptwriter: { description: 'Script writer' },
    storyboarder: { description: 'Storyboard' },
    creator: { description: 'Creator' },
  };

  test('contains SVD_BOOTSTRAP_MARKER', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.ok(out.includes('SVD_BOOTSTRAP_MARKER'));
  });

  test('includes the same role handoff guidance as agent and entry injection', () => {
    assert.ok(generateBootstrap('/fake/root', sampleAgents).includes(ROLE_HANDOFF_GUIDANCE));
  });

  test('lists all 4 agent names', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.deepEqual([...out.matchAll(/^- \*\*([a-z]+)\*\*/gm)].map(m => m[1]),
      ['reviewer', 'scriptwriter', 'storyboarder', 'creator']);
  });

  test('lists two public creation workflows and keeps internal operations available', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    const section = out.split('## 公开创作入口（')[1].split('## 如何启动')[0];
    assert.ok(section.startsWith('2 个 user-invocable skills）'));
    assert.deepEqual([...section.matchAll(/^- `([^`]+)`$/gm)].map(m => m[1]),
      ['series-video', 'short-video']);
    for (const name of ['edit-story', 'repair-story', 'generate-video', 'check-video', 'auto-video']) {
      assert.ok(out.includes(`\`${name}\``));
    }
  });

  test('wraps in EXTREMELY_IMPORTANT', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.match(out, /<EXTREMELY_IMPORTANT>/);
    assert.match(out, /<\/EXTREMELY_IMPORTANT>/);
  });

  test('documents the OpenCode nohup HTTP monitor', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.match(out, /nohup/);
    assert.match(out, /HTTP session\/prompt/);
    assert.doesNotMatch(out, /crontab|opencode run --session/);
  });
});
