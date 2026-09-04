import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/storyboard-sheet-to-prompt.sh');

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function card(refs, continuity = '无', prompt = '生成彩色分镜板。') {
  return `# Sheet

## 引用资产
${refs}

## 连续性参考
${continuity}

## Panel 规划
测试

## 图像生成提示

${prompt}
`;
}

function run(root, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
}

function project(fn) {
  const root = mkdtempSync(join(tmpdir(), 'svd sheet prompt-'));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

function fail(result, pattern, status = 1) {
  assert.equal(result.status, status, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.split('\n').filter(Boolean).length, 1);
  assert.match(result.stderr, /^FAIL /);
  assert.match(result.stderr, pattern);
  assert.doesNotMatch(result.stderr.trimEnd(), /[\u0000-\u001f\u007f-\u009f]/);
}

function images(result) {
  assert.match(result.stdout, /^IMAGES:/);
  return result.stdout.split('\n')[0].slice(7).split(',');
}

test('converts full sheet with ordered assets and previous sheet last', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep07/shot02.md';
    const prompt = '\n\n第一行。\n\n  第二行两端空格保留。  \n\n';
    write(root, path, card(`- [古 城](../../locations/../locations/古 城.md)
- [阿青](../../characters/阿青.md)
- [铜 镜](../../items/./铜 镜.md)
- [小白](../../characters/小白.md)
- [阿青别名](../../characters/./阿青.md)
- [钟楼](../../buildings/钟楼.md)`, `- [shot01](./shot01.md)
- 继承元素：服装、持有物`, prompt));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.deepEqual(images(result), [
      'assets/images/characters/阿青.png',
      'assets/images/characters/小白.png',
      'assets/images/locations/古 城.png',
      'assets/images/items/铜 镜.png',
      'assets/images/buildings/钟楼.png',
      'assets/images/storyboard-sheets/ep07/shot01.png',
    ]);
    assert.match(result.stdout, /\*\*参考资产：\*\* \[阿青:\{图片1\}\].*\[PREVIOUS_SHOT_SHEET:\{图片6\}\]/);
    assert.match(result.stdout, /只继承本卡声明元素，不复制前板网格、panel、构图、机位/);
    assert.match(result.stdout, /第一行。\n\n  第二行两端空格保留。  \n$/);
  });
});

test('无 continuity omits constraint and emits exact protocol', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('- [角色甲](../../characters/角色甲.md)', '无', '单行提示。'));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout, `IMAGES:assets/images/characters/角色甲.png
---
**参考资产：** [角色甲:{图片1}]

单行提示。
`);
  });
});

test('character-first sort and normalized path dedupe are stable', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot03.md';
    write(root, path, card(`- [地点](../../locations/地点.md)
- [角色乙](../../characters/角色乙.md)
- [道具](../../items/道具.md)
- [角色甲](../../characters/角色甲.md)
- [地点别名](../../locations/./地点.md)
- [角色乙别名](../../characters/x/../角色乙.md)`));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), [
      'assets/images/characters/角色乙.png',
      'assets/images/characters/角色甲.png',
      'assets/images/locations/地点.png',
      'assets/images/items/道具.png',
    ]);
    assert.match(result.stdout, /\[角色乙:\{图片1\}\]、\[角色甲:\{图片2\}\]、\[地点:\{图片3\}\]、\[道具:\{图片4\}\]/);
    assert.doesNotMatch(result.stdout, /别名/);
  });
});

test('resolves relative dot segments and supports CJK and spaces', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep12/shot01.md';
    write(root, path, card(`- [林 小满](../../characters/配角/../林 小满.md)
- [旧 车站](../../locations/北方/./旧 车站.md)`));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), [
      'assets/images/characters/林 小满.png',
      'assets/images/locations/北方/旧 车站.png',
    ]);
  });
});

test('preserves eleven references without checking PNG files', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot100.md';
    const refs = ['- [角色](../../characters/角色.md)',
      ...Array.from({ length: 10 }, (_, i) =>
        `- [道具${i + 1}](../../items/道具${i + 1}.md)`)].join('\n');
    write(root, path, card(refs));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(images(result).length, 11);
    assert.match(result.stdout, /\[道具10:\{图片11\}\]/);
  });
});

test('preserves prompt metacharacters and only trims outer blank lines', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep03/shot01.md';
    const prompt = '\n\n-n $HOME $(touch X) `uname` * ? [x] \\\n\n  保留缩进和尾空格  \n\n';
    write(root, path, card('- [角色](../../characters/角色.md)', '无', prompt));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.slice(result.stdout.indexOf('\n\n') + 2),
      `${prompt.replace(/^\n+|\n+$/g, '')}\n`);
    assert.equal(result.stderr, '');
  });
});

test('rejects wrong arguments and missing files on stderr only', () => {
  project((root) => {
    fail(run(root), /usage:/);
    fail(run(root, 'a', 'b'), /usage:/);
    fail(run(root, 'assets/storyboard-sheets/ep01/shot01.md'), /file not found:/);
  });
});

test('requires repo-relative canonical path and canonical shot name', () => {
  project((root) => {
    const valid = card('- [甲](../../characters/甲.md)');
    const paths = [
      './assets/storyboard-sheets/ep01/shot01.md',
      'assets/storyboard-sheets/ep01/shot1.md',
      'assets/storyboard-sheets/ep01/shot001.md',
      'assets/storyboard-sheets/ep01/shot999999999999999999999999.md',
      'assets/storyboard-sheets/ep01/shot00.md',
      'assets/storyboard-sheets/not-ep/shot01.md',
      'assets/other/ep01/shot01.md',
      join(root, 'assets/storyboard-sheets/ep01/shot01.md'),
      '-assets/storyboard-sheets/ep01/shot01.md',
    ];
    for (const path of paths) {
      if (!path.startsWith('-')) write(root, path, valid);
      fail(run(root, path), /noncanonical card:/);
    }
  });
});

test('escapes control characters in path diagnostics', () => {
  project((root) => {
    const result = run(root, 'assets/storyboard-sheets/ep01/shot01.md\nrow\tend');
    fail(result, /noncanonical card: .*\\n.*\\t/);
  });
});

test('requires each schema section once and a nonempty prompt', () => {
  const refs = '- [甲](../../characters/甲.md)';
  const valid = card(refs);
  const cases = [
    valid.replace('## 引用资产', '## 其他资产'),
    valid.replace('## 连续性参考', '## 其他连续性'),
    valid.replace('## 图像生成提示', '## 其他提示'),
    `${valid}\n## 引用资产\n${refs}\n`,
    `${valid}\n## 连续性参考\n无\n`,
    `${valid}\n## 图像生成提示\n另一个提示\n`,
    card(refs, '无', '\n \t\n'),
  ];
  for (const [index, content] of cases.entries()) project((root) => {
    const path = `assets/storyboard-sheets/ep${index + 1}/shot01.md`;
    write(root, path, content);
    fail(run(root, path), /section|prompt/);
  });
});

test('requires at least one base asset reference', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    write(root, path, card('无', '- [shot01](./shot01.md)'));
    fail(run(root, path), /no base asset/);
  });
});

test('rejects links outside the four asset markdown categories', () => {
  const links = [
    '[车](../../vehicles/车.md)',
    '[图片](../../characters/图片.png)',
    '[越界](../../../characters/角色.md)',
    '[网址](https://example.com/assets/characters/角色.md)',
    '[绝对](/assets/characters/角色.md)',
    '[控制](../../characters/坏\t路径.md)',
  ];
  for (const link of links) project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card(`- ${link}`));
    fail(run(root, path), /invalid asset link:/);
  });
});

test('requires 无 when continuity has no dependency', () => {
  for (const continuity of ['', 'none', '- 继承元素：服装']) project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    write(root, path, card('- [甲](../../characters/甲.md)', continuity));
    fail(run(root, path), /continuity/);
  });
});

test('rejects multiple, non-adjacent, malformed, and shot01 previous links', () => {
  const cases = [
    ['shot03.md', '- [shot02](./shot02.md)\n- [shot01](./shot01.md)'],
    ['shot03.md', '- [shot01](./shot01.md)'],
    ['shot03.md', '- [previous](./shot02.md)'],
    ['shot03.md', '- [shot02](../ep01/shot02.md)'],
    ['shot03.md', 'prefix [shot02](./shot02.md)'],
    ['shot01.md', '- [shot00](./shot00.md)'],
  ];
  for (const [name, continuity] of cases) project((root) => {
    const path = `assets/storyboard-sheets/ep01/${name}`;
    write(root, path, card('- [甲](../../characters/甲.md)', continuity));
    fail(run(root, path), /continuity|previous/);
  });
});

test('ignores links outside 引用资产 and preserves them in prompt', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    const prompt = '[非资产](../../vehicles/车.md) 保持正文。';
    write(root, path, card('- [甲](../../characters/甲.md)', '无', prompt));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), ['assets/images/characters/甲.png']);
    assert.match(result.stdout, /\[非资产\]\(\.\.\/\.\.\/vehicles\/车\.md\)/);
  });
});

test('runs legacy detection first and propagates exit 2 unchanged', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep09/shot01.md';
    write(root, path, 'invalid card that must not be parsed\n');
    write(root, 'story/episodes/ep09/storyboard.md', '[KF-EP09-001]\n');
    const result = run(root, path);
    fail(result, /^FAIL legacy KF contract detected:.*story\/episodes\/ep09\/storyboard\.md/, 2);
  });
});

test('passes actual default tasks path and propagates detector exit 1', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep04/shot01.md';
    write(root, path, card('- [甲](../../characters/甲.md)'));
    write(root, 'story/episodes/ep04/videos/tasks.json', '[broken');
    const result = run(root, path);
    fail(result, /^FAIL invalid tasks JSON: story\/episodes\/ep04\/videos\/tasks\.json\n$/);
  });
});
