import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readStoryboardShot } from '../../scripts/storyboard-shot.mjs';
import { groupedVideo } from './fixtures/grouped-video.js';

const SCRIPT = join(process.cwd(), 'scripts/storyboard-materials-dreamina.mjs');
const INPUT = 'story/episodes/ep01/task-inputs/task01.json';

test('Dreamina numbers image and video slots independently with and without identity images', t => {
  const f = groupedVideo(t);
  const local = (media, file) => ({ kind: 'local', media, path: `references/${file}`,
    use: 'Motion and composition control', sources: ['references/scene.blend'] });
  const refs = [local('video', 'motion.mp4'), local('image', 'layout, draft.png'), local('video', 'camera.mp4')];
  for (const ref of refs) f.write(ref.path, ref.media);
  f.write(f.input, JSON.stringify({ shots: [1, 2, 3], references: refs }));
  for (const identity of [true, false]) {
    const blocks = f.blocks.map(block => identity ? block : block.replace(
      '- 引用资产：[lamp](assets/items/lamp.md)', '- 引用资产：无'));
    f.write(f.board, blocks.join('\n\n'));
    const r = JSON.parse(f.material().stdout);
    assert.deepEqual(r.materials.referenceSlots, [
      ...(identity ? [{ media: 'image', path: f.image, slot: '{图片1}',
        name: 'lamp', markdown: 'assets/items/lamp.md' }] : []),
      ...refs.map(({ media, path, use }, i) => ({ media, path, use,
        slot: i === 1 ? `{图片${identity ? 2 : 1}}` : `{视频${i === 0 ? 1 : 2}}` })),
    ]);
    assert.deepEqual(r.sources, ['references/scene.blend']);
    if (!identity) assert.equal(r.materials.shotBlocks[0].block,
      blocks[0].replace('- 视频风格：写实\n', ''));
  }
});

test('Dreamina rebases structural cues while preserving whitespace, dialogue and inline local time', t => {
  const f = groupedVideo(t);
  const original = JSON.parse(f.material().stdout);
  const verify = (blocks, duration) => {
    f.write(f.board, blocks.join('\n\n'));
    const r = JSON.parse(f.material().stdout);
    assert.equal(r.duration, duration);
    assert.equal(r.materials.style, '- 视频风格：写实');
    for (const [i, block] of blocks.entries()) {
      const offset = r.timeline[i].start;
      const expected = block.replace('- 视频风格：写实\n', '')
        .replaceAll('[lamp](assets/items/lamp.md)', '[lamp:{图片1}]')
        .replace('[0s-2.5s]', `[${offset}s-${offset + 2.5}s]`)
        .replace(`[1s-${r.timeline[i].end - offset}s]`, `[${offset + 1}s-${r.timeline[i].end}s]`);
      assert.deepEqual(r.materials.shotBlocks[i], { shot: i + 1, block: expected });
    }
  };
  verify(f.blocks, 12);
  f.write(f.board, f.blocks.join('\r\n\r\n').replace(/(?<!\r)\n/g, '\r\n'));
  assert.deepEqual(JSON.parse(f.material().stdout), original);
  const blocks = [...f.blocks];
  blocks[1] = blocks[1].replace('- 时长：4s', '- 时长：6s').replace('[1s-4s]', '[1s-6s]');
  verify(blocks, 14);
});

test('asset union follows member first use and each linked asset needs its own header', t => {
  const f = groupedVideo(t);
  const card = 'assets/items/key.md', image = 'assets/images/items/key.png';
  f.write(card, 'card'); f.write(image, 'PNG');
  const blocks = [...f.blocks];
  blocks[1] = blocks[1].replace('- 引用资产：[lamp](assets/items/lamp.md)',
    `- 引用资产：[key](${card}) [lamp](assets/items/lamp.md)`);
  blocks[2] += `\n[key](${card}) in prose but absent from own header.`;
  f.write(f.board, blocks.join('\n\n'));
  fail(f.material(), /Undeclared shot reference: shot 3/);
  blocks[2] = blocks[2].replace('- 引用资产：[lamp](assets/items/lamp.md)',
    `- 引用资产：[lamp](assets/items/lamp.md) [key](${card})`);
  f.write(f.board, blocks.join('\n\n'));
  const r = JSON.parse(f.material().stdout);
  assert.deepEqual(r.assetCards, ['assets/items/lamp.md', card]);
  assert.deepEqual(r.references.map(ref => ref.path), [f.image, image, f.video]);
  assert.deepEqual(r.materials.referenceSlots.filter(ref => ref.markdown === card), [
    { media: 'image', path: image, slot: '{图片2}', name: 'key', markdown: card },
  ]);
});

test('style references require every member declaration and existing assets', t => {
  const f = groupedVideo(t);
  const styled = f.blocks.map(block => block.replace('视频风格：写实',
    '视频风格：写实 [lamp](assets/items/lamp.md)'));
  const missingMember = styled.map((block, i) => i === 1
    ? block.replace('- 引用资产：[lamp](assets/items/lamp.md)', '- 引用资产：无') : block);
  const missingAsset = styled.map(block => block.replaceAll('assets/items/lamp.md', 'assets/items/missing.md'));
  for (const blocks of [missingMember, missingAsset]) {
    f.write(f.board, blocks.join('\n\n'));
    fail(f.material(), /Undeclared shot reference|ENOENT/);
  }
});

test('Dreamina rejects differing baselines, invalid source cues and undeclared member links', t => {
  const f = groupedVideo(t);
  for (const changed of [f.blocks[1].replace('视频风格：写实', '视频风格：动画'),
    f.blocks[1].replace('[0s-2.5s]', '[-1s-2.5s]'),
    f.blocks[1].replace('[0s-2.5s]', '[0s-5s]'),
    f.blocks[1].replace('[0s-2.5s]', '[2s-2s]'),
    f.blocks[1].replace('- 引用资产：[lamp](assets/items/lamp.md)', '- 引用资产：无') +
      '\n[lamp](assets/items/lamp.md) stays.']) {
    f.write(f.board, [f.blocks[0], changed, f.blocks[2]].join('\n\n'));
    fail(f.material(), /Different video-style|Invalid temporal cue|Undeclared shot reference/);
  }
});

test('shared style links bind before extraction', t => {
  const f = groupedVideo(t);
  const original = JSON.parse(f.material().stdout).materials;
  f.write(f.board, f.blocks.map(block => block.replace('视频风格：写实',
    '视频风格：写实 [lamp](assets/items/lamp.md)')).join('\n\n'));
  assert.deepEqual(JSON.parse(f.material().stdout).materials, {
    ...original, style: '- 视频风格：写实 [lamp:{图片1}]',
  });
});

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
  for (const n of [...block.matchAll(/^### shot ([1-9]\d*)$/gm)].map(m => Number(m[1]))) {
    write(root, `story/episodes/ep01/task-inputs/task${String(n).padStart(2, '0')}.json`, JSON.stringify({
    shots: [n], references: [{ kind: 'local', media: 'video', path: 'references/motion.mp4',
      use: 'Motion', sources: ['references/scene.blend'] }],
  }));
  }
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
  return spawnSync('node', [SCRIPT, 'story/episodes/ep01/storyboard.md', `task${String(shotNumber).padStart(2, '0')}`, 'ep01'], {
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

test('Dreamina materials retain their pack shape without a final prompt', () => {
  project(root => {
    validProject(root);
    const draft = JSON.parse(readFileSync(join(root, INPUT), 'utf8'));
    const materials = JSON.parse(run(root).stdout);
    assert.deepEqual(Object.keys(materials).sort(), ['assetCards', 'duration', 'inputPath',
      'materials', 'references', 'shots', 'sources', 'task_id', 'timeline']);
    assert.deepEqual(Object.keys(materials.materials).sort(), ['referenceSlots', 'shotBlocks', 'style']);
    for (const prompt of [null, 42, {}, '', ' \r\n\t', 'Authored final prompt']) {
      write(root, INPUT, JSON.stringify({ ...draft, prompt }));
      assert.deepEqual(JSON.parse(run(root).stdout), materials);
    }
    write(root, INPUT, JSON.stringify({ ...draft, duration: 8 }));
    fail(run(root), /requires shots and references/);
  });
});

test('Dreamina material CLI accepts exactly three positional arguments', () => {
  project(root => {
    validProject(root);
    for (const args of [['--unknown'], ['--json'], ['--materials'], [],
      ['story/episodes/ep01/storyboard.md', 'task01']]) {
      const result = spawnSync('node', [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
      fail(result, /Usage/);
    }
  });
});

test('materials emit stable deduplicated assets, local MP4 and complete bound shot', () => {
  project((root) => {
    const block = shot();
    validProject(root, block);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const { materials, references, duration } = JSON.parse(result.stdout);
    assert.equal(duration, 8);
    assert.deepEqual(references.map(r => r.path), ['assets/images/characters/阿青.png',
      'assets/images/locations/古城.png', 'assets/images/items/铜镜.png', 'references/motion.mp4']);
    const expected = block.replaceAll('[阿青](assets/characters/阿青.md)', '[阿青:{图片1}]')
      .replaceAll('[古城](assets/locations/古城.md)', '[古城:{图片2}]')
      .replaceAll('[铜镜](assets/items/铜镜.md)', '[铜镜:{图片3}]');
    assert.deepEqual(materials.shotBlocks, [{ shot: 1, block: expected.replace('- 视频风格：写实\n', '') }]);
    assert.equal(materials.style, '- 视频风格：写实');
    assert.ok(!materials.shotBlocks[0].block.includes('assets/'));
  });
});

test('shared shot reader returns complete source, duration and raw header aliases', () => {
  project(root => {
    const block = shot().replace('  - [铜镜]', '\n  - [镜面]');
    const file = join(root, 'board.md');
    write(root, 'board.md', `${block}\n\n## Next scene\nEXCLUDED\n`);
    assert.deepEqual(readStoryboardShot(file, 1), {
      block, duration: 8, style: '- 视频风格：写实',
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
    const blockResult = JSON.parse(result.stdout).materials.shotBlocks[0].block;
    assert.equal(blockResult, expected.replace('- 视频风格：写实\n', ''));
  });
});

test('selects only an exact unique shot heading', () => {
  project((root) => {
    validProject(root, `${shot(1)}\n\n### shot 10\n- 时长：5s\n`);
    assert.equal(run(root, 1).status, 0);
    write(root, 'story/episodes/ep01/storyboard.md', `${shot(1)}\n\n${shot(1)}\n`);
    fail(run(root, 1), /unique and increasing/);
    fail(run(root, 2), /unique and increasing/);
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
    const blockResult = JSON.parse(result.stdout).materials.shotBlocks[0].block;
    assert.equal(blockResult, expected.replace('- 视频风格：写实\n', ''));
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
    const blockResult = JSON.parse(first.stdout).materials.shotBlocks[0].block;
    assert.equal(blockResult, expected.replace(/^- 视频风格：[^\n]+\n/m, ''));
    assert.doesNotMatch(first.stdout, /SOURCE_|NEXT_|TRAILING_/);
    const last = run(root, 2);
    assert.equal(last.status, 0, last.stderr);
    assert.ok(JSON.parse(last.stdout).materials.shotBlocks[0].block.endsWith('[0s-7s] NEXT_SHOT_SENTINEL'));
    assert.ok(!last.stdout.includes('TRAILING_'));
  });
});

test('prose ends at section headings, separators, comment footers or EOF', () => {
  for (const boundary of ['', '\n\n# Notes', '\n\n### Notes', '\n\n---', '\n\n<!-- footer -->']) {
    project((root) => {
      validProject(root, shot() + (boundary ? boundary + '\nTRAILING_SENTINEL' : ''));
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
      assert.ok(JSON.parse(result.stdout).materials.shotBlocks[0].block.endsWith(shot().split('**画面与声音描述：**')[1]));
      assert.ok(!result.stdout.includes('TRAILING_SENTINEL'));
    });
  }
});

test('fails before output when duration, manifest, local MP4, or base PNG is missing', () => {
  const cases = [
    ['duration', (root) => write(root, 'story/episodes/ep01/storyboard.md', `${shot().replace('- 时长：8s\n', '')}\n`)],
    ['task01.json', (root) => rmSync(join(root, 'story/episodes/ep01/task-inputs/task01.json'))],
    ['motion.mp4', (root) => rmSync(join(root, 'references/motion.mp4'))],
    ['铜镜.png', (root) => rmSync(join(root, 'assets/images/items/铜镜.png'))],
  ];
  for (const [message, mutate] of cases) project((root) => {
    validProject(root);
    mutate(root);
    fail(run(root), new RegExp(message));
  });
});
