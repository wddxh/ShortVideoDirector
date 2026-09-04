import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const removed = [
  'scripts/parse-storyboard-kf.sh',
  'scripts/keyframe-to-prompt.sh',
  'skills/creator-keyframe-prompts',
  '.opencode/tests/storyboard-kf-parsing.test.js',
];

function files(path) {
  const result = [];
  for (const entry of readdirSync(join(ROOT, path), { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) result.push(...files(child));
    else result.push(child);
  }
  return result;
}

test('legacy runtime files are removed', () => {
  for (const path of removed) assert.equal(existsSync(join(ROOT, path)), false, path);
});

test('active source surfaces contain no legacy runtime identifiers', () => {
  const active = [
    ...files('agents'),
    ...files('skills'),
    ...files('.opencode/lib'),
    ...files('.opencode/skill-overrides'),
    'README.md',
    '.opencode/README.md',
  ];
  const identifiers = [
    'assets/keyframes/',
    'assets/images/keyframes/',
    'keyframes.json',
    'parse-storyboard-kf.sh',
    'keyframe-to-prompt.sh',
    'creator-keyframe-prompts',
    'IMAGES_REORDERED',
    '单镜头资产上限',
  ];
  for (const path of active) {
    const text = readFileSync(join(ROOT, path), 'utf8');
    for (const identifier of identifiers) {
      assert.equal(text.includes(identifier), false, `${path}: ${identifier}`);
    }
  }
});

test('legacy signatures are centralized in detector only', () => {
  const scripts = files('scripts').filter((path) => path !== 'scripts/detect-legacy-kf.sh');
  for (const path of scripts) {
    const text = readFileSync(join(ROOT, path), 'utf8');
    assert.equal(text.includes('assets/images/keyframes/'), false, path);
    assert.equal(text.includes('assets/keyframes/'), false, path);
    assert.equal(text.includes('[KF-'), false, path);
  }
});
