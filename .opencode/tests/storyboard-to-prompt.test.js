import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupedVideo } from './fixtures/grouped-video.js';
import * as shared from '../../scripts/shot-inputs.mjs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const scripts = join(process.cwd(), 'scripts');
const run = (f, script, args) => spawnSync(script.endsWith('.sh') ? 'bash' : 'node',
  [join(scripts, script), ...args], { cwd: f.root, encoding: 'utf8' });

test('final resolver requires nonblank authored prompt text', t => {
  const f = groupedVideo(t);
  for (const prompt of [undefined, null, 42, {}, '', ' \r\n\t']) {
    f.write(f.input, JSON.stringify({ ...f.manifest, prompt }));
    const result = f.convert();
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /nonblank prompt string/);
  }
});

test('final entrypoints reject old materials and unknown/combined modes without aliases', t => {
  const f = groupedVideo(t);
  assert.equal('resolveTaskMaterials' in shared, false);
  for (const script of ['storyboard-to-prompt.mjs', 'storyboard-to-prompt.sh']) {
    for (const flags of [['--materials'], ['--unknown'], ['--json', '--materials'],
      ['--materials', '--json']]) {
      const result = run(f, script, [...flags, f.board, 'task01', 'ep01']);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, /^FAIL .*usage/i);
    }
  }
});

test('final CLI preserves arbitrary non-Dreamina prompt text and the final protocol exactly', t => {
  const f = groupedVideo(t);
  const prompt = ' \tFutureProvider <image:0> @clip-B\r\n' +
    '[未声明](assets/items/absent.md)\n[50s-99s] keep  \n\n';
  f.write(f.input, JSON.stringify({ ...f.manifest, prompt }));
  f.write(f.board, f.blocks.map((block, i) => block.replace('视频风格：写实',
    `视频风格：style ${i}`).replace('[0s-2.5s]', '[-1s-99s]') +
    '\n[undeclared](assets/items/absent.md)').join('\n\n'));
  for (const script of ['storyboard-to-prompt.mjs', 'storyboard-to-prompt.sh']) {
    for (const flags of [[], ['--json']]) {
      const result = run(f, script, [...flags, f.board, 'task01', 'ep01']);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { ...f.resolved, prompt });
      assert.deepEqual(Object.keys(JSON.parse(result.stdout)).sort(), ['assetCards', 'duration',
        'inputPath', 'prompt', 'references', 'shots', 'sources', 'task_id', 'timeline']);
    }
  }
});
