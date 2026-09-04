import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/detect-legacy-kf.sh');

function project() {
  return mkdtempSync(join(tmpdir(), 'svd legacy kf-'));
}

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function run(root, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function withProject(fn) {
  const root = project();
  try {
    fn(root);
  } finally {
    rmSync(root, { recursive: true });
  }
}

function assertLegacy(result, ...evidence) {
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.split('\n').filter(Boolean).length, 1);
  assert.match(result.stderr, /^FAIL legacy KF contract detected:/);
  assert.match(result.stderr, /当前版本不兼容/);
  assert.match(result.stderr, /旧 release/);
  assert.match(result.stderr, /人工迁移/);
  const prefix = 'FAIL legacy KF contract detected: ';
  assert.equal(result.stderr.slice(prefix.length, result.stderr.indexOf(';')),
    evidence.join(', '));
}

test('accepts a current project when optional files are missing', () => {
  withProject((root) => {
    const result = run(root, 'ep01');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });
});

test('accepts current storyboard and tasks content', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep12/storyboard.md',
      '# storyboard\n- 引用资产: assets/storyboard-sheets/ep12/shot01.md\n');
    write(root, 'story/episodes/ep12/videos/tasks.json',
      '{"image":"assets/images/storyboard-sheets/ep12/shot01.png"}\n');
    const result = run(root, 'ep12');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });
});

test('detects the legacy episode keyframes manifest', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep01/keyframes.json', '{}');
    assertLegacy(run(root, 'ep01'), 'story/episodes/ep01/keyframes.json');
  });
});

test('treats an empty assets/keyframes directory as evidence', () => {
  withProject((root) => {
    mkdirSync(join(root, 'assets/keyframes'), { recursive: true });
    assertLegacy(run(root, 'ep01'), 'assets/keyframes/');
  });
});

test('treats an empty assets/images/keyframes directory as evidence', () => {
  withProject((root) => {
    mkdirSync(join(root, 'assets/images/keyframes'), { recursive: true });
    assertLegacy(run(root, 'ep01'), 'assets/images/keyframes/');
  });
});

test('detects a legacy inline KF marker in the storyboard', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep01/storyboard.md', '首帧是 [KF-EP01-001]\n');
    assertLegacy(run(root, 'ep01'), 'story/episodes/ep01/storyboard.md:[KF-...]');
  });
});

test('detects a legacy asset link in the storyboard', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep01/storyboard.md',
      '[参考](assets/keyframes/ep01/KF-EP01-001.md)\n');
    assertLegacy(run(root, 'ep01'), 'story/episodes/ep01/storyboard.md:assets/keyframes/');
  });
});

test('detects a legacy image path in tasks JSON text', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep01/videos/tasks.json',
      '{"image":"assets/images/keyframes/ep01/KF-EP01-001.png"}\n');
    assertLegacy(run(root, 'ep01'),
      'story/episodes/ep01/videos/tasks.json:assets/images/keyframes/');
  });
});

test('collects all evidence once in a stable comma-separated order', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep07/keyframes.json', '{}');
    mkdirSync(join(root, 'assets/keyframes'), { recursive: true });
    mkdirSync(join(root, 'assets/images/keyframes'), { recursive: true });
    write(root, 'story/episodes/ep07/storyboard.md',
      '[KF-EP07-001](assets/keyframes/ep07/KF-EP07-001.md)\n');
    write(root, 'story/episodes/ep07/videos/tasks.json',
      '{"image":"assets/images/keyframes/ep07/KF-EP07-001.png"}\n');

    assertLegacy(run(root, 'ep07'),
      'story/episodes/ep07/keyframes.json',
      'assets/keyframes/',
      'assets/images/keyframes/',
      'story/episodes/ep07/storyboard.md:[KF-...]',
      'story/episodes/ep07/storyboard.md:assets/keyframes/',
      'story/episodes/ep07/videos/tasks.json:assets/images/keyframes/');
  });
});

test('reports custom absolute paths containing spaces as repo-relative', () => {
  withProject((root) => {
    const storyboard = 'custom input/board one.md';
    const tasks = 'custom input/tasks one.json';
    write(root, storyboard, '[KF-CUSTOM-1]\n');
    write(root, tasks, '{"path":"assets/images/keyframes/old.png"}\n');

    assertLegacy(run(root, 'ep02', join(root, storyboard), join(root, tasks)),
      'custom input/board one.md:[KF-...]',
      'custom input/tasks one.json:assets/images/keyframes/');
  });
});

test('rejects missing and malformed episode arguments without legacy report', () => {
  withProject((root) => {
    for (const args of [[], ['01'], ['ep'], ['ep1x'], ['ep01', 'a', 'b', 'c']]) {
      const result = run(root, ...args);
      assert.equal(result.status, 1, `${args}: ${result.stderr}`);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /^FAIL /);
      assert.doesNotMatch(result.stderr, /legacy KF contract detected/);
    }
  });
});

test('does not mutate legacy files or directories', () => {
  withProject((root) => {
    write(root, 'story/episodes/ep03/keyframes.json', '{"keep":true}\n');
    write(root, 'assets/keyframes/keep me.md', 'unchanged\n');
    write(root, 'story/episodes/ep03/storyboard.md', '[KF-EP03-001]\n');
    const manifest = join(root, 'story/episodes/ep03/keyframes.json');
    const asset = join(root, 'assets/keyframes/keep me.md');
    const beforeManifest = readFileSync(manifest, 'utf8');
    const beforeAsset = readFileSync(asset, 'utf8');

    const result = run(root, 'ep03');

    assert.equal(result.status, 2);
    assert.equal(readFileSync(manifest, 'utf8'), beforeManifest);
    assert.equal(readFileSync(asset, 'utf8'), beforeAsset);
    assert.deepEqual(readdirSync(join(root, 'assets/keyframes')), ['keep me.md']);
  });
});
