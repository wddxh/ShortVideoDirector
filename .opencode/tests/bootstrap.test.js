import { describe, it, expect } from 'vitest';
import { generateBootstrap } from '../lib/bootstrap.js';

describe('generateBootstrap', () => {
  const sampleAgents = {
    director: { description: 'Senior director' },
    writer: { description: 'Novel writer' },
    scriptwriter: { description: 'Script writer' },
    storyboarder: { description: 'Storyboard' },
    creator: { description: 'Creator' },
  };

  it('contains SVD_BOOTSTRAP_MARKER', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    expect(out).toContain('SVD_BOOTSTRAP_MARKER');
  });

  it('lists all 5 agent names', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    for (const name of ['director', 'writer', 'scriptwriter', 'storyboarder', 'creator']) {
      expect(out).toContain(name);
    }
  });

  it('lists user-invocable entry workflows', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    expect(out).toContain('series-video');
    expect(out).toContain('short-video');
    expect(out).toContain('auto-video');
  });

  it('wraps in EXTREMELY_IMPORTANT', () => {
    const out = generateBootstrap('/fake/root', sampleAgents);
    expect(out).toMatch(/<EXTREMELY_IMPORTANT>/);
    expect(out).toMatch(/<\/EXTREMELY_IMPORTANT>/);
  });
});
