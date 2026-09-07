import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readStoryboardShot } from '../../scripts/storyboard-shot.mjs';

const SCRIPT = join(process.cwd(), 'scripts/storyboard-to-prompt.sh');

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function project(fn) {
  const root = mkdtempSync(join(tmpdir(), 'svd-video-prompt-'));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

function shot(number = 1, duration = 8) {
  return `### shot ${number}
- 镜头类型：中景
- 镜头运动：跟
- 视频风格：写实
- 时长：${duration}s
- 出场人物：
  - [阿青](assets/characters/阿青.md)
    声音特征：清亮
  - [阿青](assets/characters/阿青.md)
    声音特征：清亮
- 引用资产：
  - [古城](assets/locations/古城.md)
  - [铜镜](assets/items/铜镜.md)
- 转场：切

**画面与声音描述：**
[0s-${duration}s] 阿青向画面右侧走到铜镜前，最终面向古城城门停下。
阿青 (压低声音): "别回头。"
远处钟声响起。`;
}

function validProject(root, block = shot()) {
  write(root, 'story/episodes/ep01/storyboard.md', `# ep01 分镜\n\n${block}\n`);
  for (const n of [1, 2]) write(root, `story/episodes/ep01/shot-inputs/shot0${n}.json`, JSON.stringify({
    references: [{ kind: 'local', media: 'video', path: 'references/motion.mp4',
      use: 'Motion', sources: ['references/scene.blend'] }],
  }));
  write(root, 'references/motion.mp4', 'MP4');
  write(root, 'references/scene.blend', 'scene');
  for (const file of ['assets/characters/阿青.md', 'assets/characters/阿明.md',
    'assets/locations/古城.md', 'assets/items/铜镜.md']) write(root, file, 'card');
  for (const path of [
    'assets/images/characters/阿青.png',
    'assets/images/locations/古城.png',
    'assets/images/items/铜镜.png',
  ]) write(root, path, 'png');
}

function run(root, shotNumber = 1) {
  return spawnSync('bash', [SCRIPT, 'story/episodes/ep01/storyboard.md', String(shotNumber)], {
    cwd: root,
    encoding: 'utf8',
  });
}

function fail(result, pattern, status = 1) {
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^FAIL /);
  assert.match(result.stderr, pattern);
}

test('emits stable deduplicated assets, local MP4 and complete bound shot', () => {
  project((root) => {
    const block = shot();
    validProject(root, block);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const { prompt, references, duration } = JSON.parse(result.stdout);
    assert.equal(duration, 8);
    assert.deepEqual(references.map(r => r.path), ['assets/images/characters/阿青.png',
      'assets/images/locations/古城.png', 'assets/images/items/铜镜.png', 'references/motion.mp4']);
    const expected = block.replaceAll('[阿青](assets/characters/阿青.md)', '[阿青:{图片1}]')
      .replaceAll('[古城](assets/locations/古城.md)', '[古城:{图片2}]')
      .replaceAll('[铜镜](assets/items/铜镜.md)', '[铜镜:{图片3}]');
    assert.equal(prompt.split('\n').slice(5).join('\n'), expected);
    assert.ok(!prompt.includes('assets/'));
  });
});

test('shared shot reader returns complete source, duration and raw header aliases', () => {
  project(root => {
    const block = shot().replace('  - [铜镜]', '\n  - [镜面]');
    const file = join(root, 'board.md');
    write(root, 'board.md', `${block}\n\n## Next scene\nEXCLUDED\n`);
    assert.deepEqual(readStoryboardShot(file, 1), {
      block, duration: 8,
      headerRefs: [
        { name: '阿青', markdown: 'assets/characters/阿青.md' },
        { name: '阿青', markdown: 'assets/characters/阿青.md' },
        { name: '古城', markdown: 'assets/locations/古城.md' },
        { name: '镜面', markdown: 'assets/items/铜镜.md' },
      ],
    });
  });
});

test('blank lines within declared lists preserve reference order and the complete shot', () => {
  for (const blank of ['', ' \t ']) project((root) => {
    const block = shot().replace('    声音特征：清亮\n  - [阿青]',
      `    声音特征：清亮\n${blank}\n  - [阿明]`)
      .replace('[阿明](assets/characters/阿青.md)', '[阿明](assets/characters/阿明.md)')
      .replace('  - [铜镜]', `${blank}\n  - [铜镜]`);
    validProject(root, block);
    write(root, 'assets/images/characters/阿明.png', 'png');
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).references.map(r => r.path), [
      'assets/images/characters/阿青.png', 'assets/images/characters/阿明.png',
      'assets/images/locations/古城.png', 'assets/images/items/铜镜.png',
      'references/motion.mp4',
    ]);
    const expected = block.replaceAll('[阿青](assets/characters/阿青.md)', '[阿青:{图片1}]')
      .replaceAll('[阿明](assets/characters/阿明.md)', '[阿明:{图片2}]')
      .replaceAll('[古城](assets/locations/古城.md)', '[古城:{图片3}]')
      .replaceAll('[铜镜](assets/items/铜镜.md)', '[铜镜:{图片4}]');
    assert.equal(JSON.parse(result.stdout).prompt.split('\n').slice(6).join('\n'), expected);
  });
});

test('selects only an exact unique shot heading', () => {
  project((root) => {
    validProject(root, `${shot(1)}\n\n### shot 10\n- 时长：5s\n`);
    assert.equal(run(root, 1).status, 0);
    write(root, 'story/episodes/ep01/storyboard.md', `${shot(1)}\n\n${shot(1)}\n`);
    fail(run(root, 1), /duplicate shot 1/);
    fail(run(root, 2), /shot 2 not found/);
  });
});

test('rewrites declared paths throughout the shot without changing local text or alias labels', () => {
  project((root) => {
    const block = shot().replace('- 转场：切', '- 转场：切\n  保持门框位置  \n- 自定义：原样保留') +
      '\n[0.5s-1s] [镜面](assets/items/铜镜.md)映出[阿青](assets/characters/阿青.md)。  ' +
      '\n\t声音继续；[说明](https://example.com)与未绑定的木凳保持原文。  ';
    validProject(root, block);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const expected = block.replaceAll('[阿青](assets/characters/阿青.md)', '[阿青:{图片1}]')
      .replaceAll('[古城](assets/locations/古城.md)', '[古城:{图片2}]')
      .replaceAll('[铜镜](assets/items/铜镜.md)', '[铜镜:{图片3}]')
      .replaceAll('[镜面](assets/items/铜镜.md)', '[镜面:{图片3}]');
    assert.equal(JSON.parse(result.stdout).prompt.split('\n').slice(5).join('\n'), expected);
  });
});

test('undeclared explicit asset links fail before output even when their PNG exists', () => {
  for (const location of ['header', 'prose']) project((root) => {
    const link = '[铜镜](assets/items/另一面镜.md)';
    const block = location === 'header' ? shot().replace('- 转场：切', `- 转场：切\n- 自定义：${link}`)
      : shot() + `\n${link}反光。`;
    validProject(root, block);
    write(root, 'assets/images/items/另一面镜.png', 'png');
    fail(run(root), /Undeclared shot reference.*assets\/items\/另一面镜\.md/);
  });
});

test('scene and trailing section boundaries preserve only the selected shot content', () => {
  project((root) => {
    const source = readFileSync(new URL('./fixtures/storyboard-boundaries.md', import.meta.url), 'utf8');
    validProject(root, source);
    write(root, 'assets/images/characters/阿明.png', 'png');
    const first = run(root);
    assert.equal(first.status, 0, first.stderr);
    const block = source.slice(source.indexOf('### shot 1'), source.indexOf('\n\n## 场景 5'));
    const expected = block.replaceAll('[阿青](assets/characters/阿青.md)', '[阿青:{图片1}]')
      .replaceAll('[阿明](assets/characters/阿明.md)', '[阿明:{图片2}]')
      .replaceAll('[铜镜](assets/items/铜镜.md)', '[铜镜:{图片3}]');
    assert.equal(JSON.parse(first.stdout).prompt.split('\n').slice(5).join('\n'), expected);
    assert.doesNotMatch(first.stdout, /SOURCE_|NEXT_|TRAILING_/);
    const last = run(root, 2);
    assert.equal(last.status, 0, last.stderr);
    assert.ok(JSON.parse(last.stdout).prompt.endsWith('[0s-7s] NEXT_SHOT_SENTINEL'));
    assert.ok(!last.stdout.includes('TRAILING_'));
  });
});

test('prose ends at section headings, separators, comment footers or EOF', () => {
  for (const boundary of ['', '\n\n# Notes', '\n\n### Notes', '\n\n---', '\n\n<!-- footer -->']) {
    project((root) => {
      validProject(root, shot() + (boundary ? boundary + '\nTRAILING_SENTINEL' : ''));
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(JSON.parse(result.stdout).prompt.endsWith(shot().split('**画面与声音描述：**')[1]));
      assert.ok(!result.stdout.includes('TRAILING_SENTINEL'));
    });
  }
});

test('fails before output when duration, manifest, local MP4, or base PNG is missing', () => {
  const cases = [
    ['duration', (root) => write(root, 'story/episodes/ep01/storyboard.md', `${shot().replace('- 时长：8s\n', '')}\n`)],
    ['shot01.json', (root) => rmSync(join(root, 'story/episodes/ep01/shot-inputs/shot01.json'))],
    ['motion.mp4', (root) => rmSync(join(root, 'references/motion.mp4'))],
    ['铜镜.png', (root) => rmSync(join(root, 'assets/images/items/铜镜.png'))],
  ];
  for (const [message, mutate] of cases) project((root) => {
    validProject(root);
    mutate(root);
    fail(run(root), new RegExp(message));
  });
});
