import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBootstrap } from '../lib/bootstrap.js';

describe('generateBootstrap', () => {
  const sampleAgents = {
    director: { description: 'Senior director' },
    writer: { description: 'Novel writer' },
    scriptwriter: { description: 'Script writer' },
    storyboarder: { description: 'Storyboard' },
    creator: { description: 'Creator' },
  };

  test('contains SVD_BOOTSTRAP_MARKER', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.ok(out.includes('SVD_BOOTSTRAP_MARKER'));
  });

  test('lists all 5 agent names', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    for (const name of ['director', 'writer', 'scriptwriter', 'storyboarder', 'creator']) {
      assert.ok(out.includes(name), `bootstrap should contain agent name "${name}"`);
    }
  });

  test('lists user-invocable entry workflows', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.ok(out.includes('series-video'));
    assert.ok(out.includes('short-video'));
    assert.ok(out.includes('auto-video'));
  });

  test('wraps in EXTREMELY_IMPORTANT', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    assert.match(out, /<EXTREMELY_IMPORTANT>/);
    assert.match(out, /<\/EXTREMELY_IMPORTANT>/);
  });
});
