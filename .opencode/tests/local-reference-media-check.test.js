import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scripts = fileURLToPath(new URL('../../scripts/', import.meta.url));
function command(bin, args) {
  const r = spawnSync(bin, args, { encoding: 'utf8' });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}
function fixture(t) {
  const root = mkdtempSync('/tmp/opencode/local-reference-check-test-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => {
    const file = join(root, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const spec = (ep, w, h, fps) => `- ${ep} 本地参考宽度: ${w}\n- ${ep} 本地参考高度: ${h}\n- ${ep} 本地参考fps: ${fps}\n`;
  write('settings/chosen config.md', spec('ep01', 320, 180, '5/2') + spec('ep02', 256, 144, '12'));
  write('config.md', spec('ep01', 640, 360, '30'));
  write('references/source.txt', 'fixture source');
  const media = (name, size = '320x180', fps = '5/2', duration = 2, extra = []) => {
    command('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
      `color=c=red:s=${size}:r=${fps}:d=${duration}`, ...extra,
      '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', join(root, name)]);
  };
  media('references/partial.mp4', '320x180', '5/2', 0.8);
  media('references/selected.mp4');
  media('references/ep02.mp4', '256x144', '12');
  const manifest = ep => `story/episodes/${ep}/task-inputs/task09.json`;
  for (const ep of ['ep01', 'ep02']) {
    write(`story/episodes/${ep}/storyboard.md`,
      '### shot 7\n- 视频风格：写实\n- 时长：2s\n- 引用资产：无\n\n**画面与声音描述：**\nAction.\n');
    write(manifest(ep), { shots: [7], prompt: 'Final prompt.',
      references: (ep === 'ep01' ? ['partial', 'selected'] : ['ep02']).map(name => ({
        kind: 'local', media: 'video', path: `references/${name}.mp4`,
        use: 'Camera layout', sources: ['references/source.txt'] })) });
  }
  const cli = (ep = 'ep01', video = 'references/selected.mp4', config = join(root, 'settings/chosen config.md')) =>
    spawnSync('node', [join(scripts, 'local-reference-media-check.mjs'), ep, 'task09', '--video', video],
      { cwd: root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: config } });
  return { root, write, spec, media, manifest, cli };
}

function result(r, status = 0, pattern) {
  assert.ifError(r.error);
  assert.equal(r.status, status, r.stderr);
  const info = JSON.parse(r.stdout);
  if (pattern) assert.match(r.stderr, pattern);
  return info;
}

test('explicit final local MP4, canonical source duration and per-episode saved specs', t => {
  const f = fixture(t);
  const config = join(f.root, 'settings/chosen config.md');
  const before = readFileSync(config);
  const info = result(f.cli());
  assert.equal(info.config, 'settings/chosen config.md');
  assert.equal(info.task_id, 'task09');
  assert.deepEqual(info.shots, [7]);
  assert.deepEqual(info.expected, { width: 320, height: 180, fps: '5/2', duration: 2 });
  assert.equal(info.actual.frames, 5);
  assert.equal(info.actual.cfr, true);
  assert.deepEqual(info.errors, []);
  const other = result(f.cli('ep02', 'references/ep02.mp4'));
  assert.deepEqual(other.expected, { width: 256, height: 144, fps: '12', duration: 2 });
  assert.equal(other.actual.frames, 24);
  result(f.cli('ep01', 'references/partial.mp4'), 1, /duration mismatch/);
  result(f.cli('ep01', 'references/ep02.mp4'), 1, /not a declared local video/);
  const manifest = JSON.parse(readFileSync(join(f.root, f.manifest('ep01'))));
  f.write(f.manifest('ep01'), { ...manifest, prompt: ' ' });
  result(f.cli(), 1, /final task input requires/);
  assert.deepEqual(readFileSync(config), before);
});

test('real media rejects wrong dimensions, fps, frame duration and presentation metadata', t => {
  const f = fixture(t);
  for (const [size, fps, duration, extra, pattern] of [
    ['256x144', '5/2', 2, [], /dimensions mismatch/],
    ['320x180', '5', 2, [], /fps mismatch/],
    ['320x180', '5/2', 4, [], /duration mismatch/],
    ['320x180', '5/2', 2, ['-vf', 'setsar=2'], /square pixels/],
    ['320x180', '10', 2, ['-vf', 'settb=1/1000,setpts=100*N+13*mod(N\\,3)',
      '-vsync', '0', '-enc_time_base', '1/1000'], /VFR/],
  ]) {
    f.media('references/selected.mp4', size, fps, duration, extra);
    const info = result(f.cli(), 1, pattern);
    assert.equal(info.config, 'settings/chosen config.md');
  }
  f.media('references/selected.mp4');
  command('ffmpeg', ['-v', 'error', '-i', join(f.root, 'references/selected.mp4'),
    '-c', 'copy', '-metadata:s:v:0', 'rotate=90', join(f.root, 'references/rotated.mp4')]);
  writeFileSync(join(f.root, 'references/selected.mp4'), readFileSync(join(f.root, 'references/rotated.mp4')));
  result(f.cli(), 1, /rotation/);
});

test('missing or invalid saved spec fails with config/key, without defaults', t => {
  const f = fixture(t);
  for (const [w, h, fps, pattern] of [
    [320, 180, '', /本地参考fps: missing saved value/],
    [321, 180, '10', /本地参考宽度: expected positive even/],
    [320, 0, '10', /本地参考高度: expected positive even/],
    [320, 180, '1\/0', /本地参考fps: expected positive rational/],
    [320, 180, '0', /本地参考fps: expected positive rational/],
  ]) {
    f.write('settings/chosen config.md', f.spec('ep01', w, h, fps));
    result(f.cli(), 1, pattern);
  }
  result(f.cli('ep02', 'references/ep02.mp4'), 1, /ep02 本地参考宽度: missing/);
  result(f.cli('ep01', 'references/selected.mp4', ''), 1, /Missing config path/);
  f.write('settings/chosen config.md', f.spec('ep01', 320, 180, '2.5'));
  assert.equal(result(f.cli()).expected.fps, '5/2');
});
