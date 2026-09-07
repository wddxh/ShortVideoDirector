import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { settingsText } from './fixtures/image-project.js';

const SCRIPT = join(process.cwd(), 'scripts/storyboard-sheet-to-prompt.sh');

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  const sheet = /^assets\/storyboard-sheets\/(ep\d+)\/shot(\d+)\.md$/.exec(path);
  if (sheet) {
    const board = join(root, `story/episodes/${sheet[1]}/storyboard.md`);
    mkdirSync(dirname(board), { recursive: true });
    const existing = existsSync(board) ? readFileSync(board, 'utf8') : '';
    const number = Number(sheet[2]);
    if (!existing.includes(`### shot ${number}\n`)) writeFileSync(board,
      existing + `### shot ${number}\n- 时长：8s\n**画面与声音描述：**\nSOURCE_${number}\n\n`);
  }
}

function card(refs, continuity = '无', prompt = '生成彩色分镜板。') {
  return `# Sheet

${settingsText}

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

function runWithEnv(root, env, ...args) {
  return spawnSync('/bin/bash', [SCRIPT, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
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

test('composes complete source and panels with one normalized binding map, without PNGs', () => {
  project(root => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    const source = `### shot 2
- 时长：8s
- 引用资产：[Hall](assets/locations/hall.md)
- 出场人物：
  - [Hero](assets/characters/hero.md)

  - [Alias](assets/characters/./hero.md)
    声音特征：soft
- 自定义：keep${'  '}
**画面与声音描述：**
[0s-4s] [Face](assets/characters/hero.md): "Stay."

[4s-8s] VO: "Go." Hall remains bare.  `;
    const panels = '### PANEL 1 [0s-4s]\n[Face](../../characters/hero.md) waits.\n\n' +
      '### PANEL 2 [4s-8s]\n[Key](../../items/key.md) drops.  ';
    write(root, path, card('- [Key](../../items/key.md)',
      '- [shot01](./shot01.md)\n- 继承元素：light', 'Draw [Key](../../items/key.md).')
      .replace('测试', panels));
    write(root, 'story/episodes/ep01/storyboard.md', source + '\n\n## Next scene\nEXCLUDED');
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), ['assets/images/characters/hero.png',
      'assets/images/locations/hall.png', 'assets/images/items/key.png',
      'assets/images/storyboard-sheets/ep01/shot01.png']);
    const bind = text => text.replace(/\[([^\]]+)\]\([^)]*\/(hero|hall|key)\.md\)/g,
      (_, label, name) => `[${label}:{图片${{ hero: 1, hall: 2, key: 3 }[name]}}]`);
    assert.ok(result.stdout.includes(bind(source)));
    assert.ok(result.stdout.includes(bind(panels)));
    assert.ok(result.stdout.endsWith('Draw [Key:{图片3}].\n'));
    assert.ok(!result.stdout.includes('EXCLUDED'));
  });
});

test('sheet-only aliases bind bare Panel names without duplicating image uploads', () => {
  project(root => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    const panels = '### PANEL 1\nMasked stranger waits.\n' +
      '[Hidden face](../../characters/hero.md) turns.';
    write(root, path, card('- [Masked stranger](../../characters/./hero.md)\n' +
      '- [Masked stranger](../../characters/hero.md)').replace('测试', panels));
    write(root, 'story/episodes/ep01/storyboard.md',
      '### shot 1\n- 时长：8s\n- 出场人物：[Hero](assets/characters/hero.md)\n' +
      '**画面与声音描述：**\nHero waits.');
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), ['assets/images/characters/hero.png']);
    assert.equal(result.stdout.split('\n').find(line => line.startsWith('**参考资产：**')),
      '**参考资产：** [Hero:{图片1}]、[Masked stranger:{图片1}]');
    assert.ok(result.stdout.includes(panels.replace(
      '[Hidden face](../../characters/hero.md)', '[Hidden face:{图片1}]')));
  });
});

test('source declarations cannot be supplied by sheet extras; labels cannot conflict', () => {
  project(root => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('- [A](../../items/a.md)'));
    const board = 'story/episodes/ep01/storyboard.md';
    const source = '### shot 1\n- 时长：8s\n- 引用资产：[A](assets/items/a.md)\n' +
      '**画面与声音描述：**\n';
    write(root, board, source + '[B](assets/items/b.md)');
    write(root, path, card('- [B](../../items/b.md)'));
    fail(run(root, path), /undeclared reference/);
    write(root, board, source + 'Action');
    write(root, path, card('- [A](../../items/b.md)'));
    fail(run(root, path), /conflicting.*label/);
    write(root, path, card('- [B](../../items/b.md)', '无',
      '[A](../../items/b.md)'));
    fail(run(root, path), /conflicting.*label/);
  });
});

test('binds declared previous links to the last slot but rejects current sheet links', () => {
  project(root => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    const content = card('- [A](../../items/a.md)',
      '- [shot01](./shot01.md)\n- 继承元素：[A](../../items/a.md) position',
      'Use [prior](./shot01.md).').replace('测试',
      '### PANEL 1\nMatch [previous](./shot01.md).');
    write(root, path, content);
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('继承元素：[A:{图片1}] position'));
    assert.ok(result.stdout.includes('Match [previous:{图片2}].'));
    assert.ok(result.stdout.endsWith('Use [prior:{图片2}].\n'));
    write(root, path, content.replace('[previous](./shot01.md)', '[self](./shot02.md)'));
    fail(run(root, path), /undeclared reference|invalid asset link/);
  });
});

test('requires canonical source file and unique target shot', () => {
  project(root => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('- [A](../../items/a.md)'));
    const board = 'story/episodes/ep01/storyboard.md';
    rmSync(join(root, board));
    fail(run(root, path), /file not found/);
    write(root, board, '### shot 2\n');
    fail(run(root, path), /shot 1 not found/);
    write(root, board, '### shot 1\n### shot 1\n');
    fail(run(root, path), /duplicate shot 1/);
  });
});

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
    assert.match(result.stdout, /继承元素：服装、持有物/);
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
    assert.ok(result.stdout.startsWith('IMAGES:assets/images/characters/角色甲.png\n---\n'));
    assert.ok(result.stdout.endsWith('\n单行提示。\n'));
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
    assert.equal(result.stdout.split('\n').find(line => line.startsWith('**参考资产：**')),
      '**参考资产：** [角色乙:{图片1}]、[角色乙别名:{图片1}]、[角色甲:{图片2}]、' +
      '[地点:{图片3}]、[地点别名:{图片3}]、[道具:{图片4}]');
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
    assert.ok(result.stdout.endsWith(`${prompt.replace(/^\n+|\n+$/g, '')}\n`));
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
    fail(result, /noncanonical card:/);
  });
});

test('requires each schema section once and a nonempty prompt', () => {
  const refs = '- [甲](../../characters/甲.md)';
  const valid = card(refs);
  const cases = [
    valid.replace('## 引用资产', '## 其他资产'),
    valid.replace('## 连续性参考', '## 其他连续性'),
    valid.replace('## 图像生成提示', '## 其他提示'),
    valid.replace('## Panel 规划', '## Other'),
    `${valid}\n## Panel 规划\nDuplicate\n`,
    valid.replace('测试', ' \t '),
    `${valid}\n## 引用资产\n${refs}\n`,
    `${valid}\n## 连续性参考\n无\n`,
    `${valid}\n## 图像生成提示\n另一个提示\n`,
    card(refs, '无', '\n \t\n'),
  ];
  for (const [index, content] of cases.entries()) project((root) => {
    const path = `assets/storyboard-sheets/ep${String(index + 1).padStart(2, '0')}/shot01.md`;
    write(root, path, content);
    fail(run(root, path), /section|prompt/);
  });
});

test('shot-only references suffice without duplicating declarations in the card', () => {
  project(root => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('无'));
    write(root, 'story/episodes/ep01/storyboard.md',
      '### shot 1\n- 时长：8s\n- 引用资产：[A](assets/items/a.md)\n**画面与声音描述：**\nAction');
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), ['assets/images/items/a.png']);
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

test('requires a nonempty inheritance declaration with previous sheet', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    write(root, path, card('- [甲](../../characters/甲.md)', '- [shot01](./shot01.md)'));
    fail(run(root, path), /inheritance/);
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

test('rejects undeclared explicit links in board instructions', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    const prompt = '[非资产](../../vehicles/车.md) 保持正文。';
    write(root, path, card('- [甲](../../characters/甲.md)', '无', prompt));
    fail(run(root, path), /invalid asset link|undeclared reference/);
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

test('uses syntax accepted by Bash 3.2 when that interpreter is available', () => {
  const candidates = ['bash3.2', '/usr/local/bin/bash3.2', '/opt/homebrew/bin/bash'];
  const bash32 = candidates.find((candidate) => {
    if (candidate.includes('/') && !existsSync(candidate)) return false;
    const version = spawnSync(candidate, ['-c', 'printf %s "$BASH_VERSION"'], {
      encoding: 'utf8',
    });
    return version.status === 0 && version.stdout.startsWith('3.2');
  });
  if (!bash32) return;
  const result = spawnSync(bash32, ['-n', SCRIPT], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('shell wrapper contains no Bash regular-expression operator', () => {
  const source = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /\[\[[^\n]*=~/);
  assert.doesNotMatch(source, /--escape/);
  assert.ok(source.indexOf('detect-legacy-kf.sh') < source.lastIndexOf('node "$PARSER"'));
});

test('reports one failure when Node.js is unavailable', () => {
  project((root) => {
    const result = runWithEnv(root, { PATH: '/nonexistent' },
      'assets/storyboard-sheets/ep01/shot01.md');
    fail(result, /Node\.js is required/);
  });
});

test('validates episode syntax before checking for Node.js', () => {
  project((root) => {
    const result = runWithEnv(root, { PATH: '/nonexistent' },
      'assets/storyboard-sheets/ep1/shot01.md');
    fail(result, /noncanonical card:/);
  });
});

test('enforces canonical episode and shot names', () => {
  project((root) => {
    const content = card('- [甲](../../characters/甲.md)');
    const paths = [
      'assets/storyboard-sheets/ep1/shot01.md',
      'assets/storyboard-sheets/ep001/shot01.md',
      'assets/storyboard-sheets/ep00/shot01.md',
      'assets/storyboard-sheets/ep01/shot1.md',
      'assets/storyboard-sheets/ep01/shot001.md',
      'assets/storyboard-sheets/ep01/shot00.md',
    ];
    for (const path of paths) {
      write(root, path, content);
      fail(run(root, path), /noncanonical card:/);
    }
    for (const path of [
      'assets/storyboard-sheets/ep01/shot01.md',
      'assets/storyboard-sheets/ep100/shot100.md',
    ]) {
      write(root, path, content);
      assert.equal(run(root, path).status, 0);
    }
  });
});

test('rejects a card symlink escaping the expected episode directory', () => {
  project((root) => {
    write(root, 'outside/shot01.md', card('- [甲](../assets/characters/甲.md)'));
    mkdirSync(join(root, 'assets/storyboard-sheets/ep01'), { recursive: true });
    symlinkSync('../../../outside/shot01.md',
      join(root, 'assets/storyboard-sheets/ep01/shot01.md'));
    fail(run(root, 'assets/storyboard-sheets/ep01/shot01.md'), /card path escapes/);
  });
});

test('rejects an episode directory symlink escaping the project', () => {
  project((root) => {
    const outside = mkdtempSync(join(tmpdir(), 'svd outside sheet-'));
    try {
      write(outside, 'shot01.md', card('- [甲](../../characters/甲.md)'));
      mkdirSync(join(root, 'assets/storyboard-sheets'), { recursive: true });
      symlinkSync(outside, join(root, 'assets/storyboard-sheets/ep01'));
      fail(run(root, 'assets/storyboard-sheets/ep01/shot01.md'), /card path escapes/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test('rejects control bytes, commas, and absolute-path injection in asset fields', () => {
  const values = [
    ['name', `坏${String.fromCodePoint(0x7f)}名`, '../../characters/甲.md'],
    ['name', `坏${String.fromCodePoint(0x85)}名`, '../../characters/甲.md'],
    ['path', '甲', `../../characters/坏${String.fromCodePoint(1)}路.md`],
    ['path', '甲', `../../characters/坏${String.fromCodePoint(0x9b)}路.md`],
    ['path', '甲', '../../characters/甲,乙.md'],
    ['path', '甲', '/tmp/assets/characters/甲.md'],
  ];
  for (const [, name, assetPath] of values) project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card(`- [${name}](${assetPath})`));
    fail(run(root, path), /invalid asset/);
  });
});

test('rejects a raw NUL byte without corrupting diagnostics', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('- [甲](../../characters/坏\0路径.md)'));
    fail(run(root, path), /invalid asset/);
  });
});

test('only collects complete plain markdown-link bullets', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    const refs = `- [有效](../../characters/有效.md)
inline [忽略](../../characters/忽略.md)
- ![图片](../../characters/图片.md)
- \`[代码](../../characters/代码.md)\`
- \\[转义](../../characters/转义.md)
<!-- - [注释](../../characters/注释.md) -->`;
    write(root, path, card(refs));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), ['assets/images/characters/有效.png']);
    assert.doesNotMatch(result.stdout,
      /characters\/(忽略|图片|代码|转义|注释)|\[(忽略|图片|代码|转义|注释):/);
  });
});

test('ignores fake sections inside fences and HTML comments', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    const source = `\`\`\`
## 引用资产
- [假](../../characters/假.md)
\`\`\`
<!--
## 图像生成提示
假提示
-->
${card('- [真](../../characters/真.md)', '无', '真提示')}`;
    write(root, path, source);
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(images(result), ['assets/images/characters/真.png']);
    assert.match(result.stdout, /真提示\n$/);
  });
});

test('keeps fenced H2 text inside the image prompt', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    const prompt = `前文
\`\`\`text
## 不是真实边界
围栏内容
\`\`\`
后文`;
    write(root, path, card('- [甲](../../characters/甲.md)', '无', prompt));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /前文\n```text\n## 不是真实边界\n围栏内容\n```\n后文\n$/);
  });
});

test('normalizes CRLF and otherwise preserves the prompt body', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('- [甲](../../characters/甲.md)', '无', '\n第一行\n\n第二行\n')
      .replaceAll('\n', '\r\n'));
    const result = run(root, path);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /\r/);
    assert.match(result.stdout, /第一行\n\n第二行\n$/);
  });
});

test('rejects a bare carriage return as raw C0 input', () => {
  project((root) => {
    const path = 'assets/storyboard-sheets/ep01/shot01.md';
    write(root, path, card('- [甲](../../characters/甲.md)', '无', '前文\r后文'));
    fail(run(root, path), /invalid control byte/);
  });
});

test('helper source does not duplicate legacy detector signatures', () => {
  const helper = join(process.cwd(), 'scripts/storyboard-sheet-to-prompt.mjs');
  if (!existsSync(helper)) return;
  const source = readFileSync(helper, 'utf8');
  assert.doesNotMatch(source, /keyframes|KF-/);
});
