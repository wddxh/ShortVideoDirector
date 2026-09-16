import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
  readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scripts = fileURLToPath(new URL('../../scripts/', import.meta.url));
const font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
function command(bin, args, binary = false) {
  const r = spawnSync(bin, args, { encoding: binary ? null : 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr?.toString());
  return r.stdout;
}
const ffmpeg = args => command('ffmpeg', ['-v', 'error', '-nostdin', '-y', ...args]);
const probe = file => JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file])).streams;
function fixture(t, { duration = 2, rate = '10', audio = true } = {}) {
  const root = mkdtempSync('/tmp/opencode/episode-previs-test-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, content) => {
    const file = join(root, name);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  };
  const base = 'story/episodes/ep01';
  const board = `${base}/storyboard.md`;
  const manifest = id => `${base}/task-inputs/${id}.json`;
  write('fixture-config.md', `- ep01 本地参考宽度: 320\n- ep01 本地参考高度: 180\n- ep01 本地参考fps: ${rate}\n`);
  write(board, [1, 2, 3].map(n => `### shot ${n}\n- 视频风格：写实\n- 时长：${n === 3 ? duration : 1}s\n- 引用资产：无\n\n**画面与声音描述：**\nAction ${n}.\n`).join('\n'));
  write('references/source.txt', 'isolated fixture');
  const parts = ['task09', 'task02'].map((id, index) => {
    const video = `references/${id}.mp4`, plan = `plans/${id}.json`;
    write(manifest(id), { shots: index ? [3] : [1, 2], prompt: 'Final fixture prompt.',
      references: [{ kind: 'local', media: 'video', path: video, use: 'Clean layout',
        sources: ['references/source.txt'] }] });
    write(plan, { segments: [{ speaker: '旁白', text: '等3秒，正文保持。',
      spans: [[0.2, 0.6], [0.8, 1.2]] }] });
    return { video, plan };
  });
  const media = (index, seconds = index ? duration : 2, fps = rate,
    withAudio = audio && index === 1, audioDuration = seconds, timing = [], size = '320x180') => {
    const args = ['-f', 'lavfi', '-i', `color=c=${index ? 'blue' : 'red'}:s=${size}:r=${fps}:d=${seconds}`];
    if (withAudio) args.push('-f', 'lavfi', '-i', `sine=frequency=660:duration=${audioDuration}`);
    ffmpeg([...args, ...timing, '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', join(root, parts[index].video)]);
  };
  parts.forEach((_, i) => media(i));
  write('parts.json', parts);
  const output = join(root, 'episode.mp4');
  const cli = (extra = [], env = {}) => spawnSync('node', [join(scripts, 'episode-previs.mjs'), 'ep01',
    '--parts', 'parts.json', '--output', 'episode.mp4', '--font', font, ...extra],
  { cwd: root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: join(root, 'fixture-config.md'), ...env } });
  return { root, write, board, manifest, parts, media, output, cli };
}
function success(r) {
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
function failure(f, pattern) {
  const r = f.cli();
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, pattern);
  assert.equal(existsSync(f.output), false);
}
const frame = (file, time, crop) => command('ffmpeg', ['-v', 'error', '-ss', String(time),
  '-i', file, '-vf', `crop=${crop}`, '-frames:v', '1', '-threads', '1',
  '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], true);
function samples(file) {
  const pcm = command('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0',
    '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'], true);
  return Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2));
}
const energy = data => data.reduce((s, x) => s + x * x, 0) / data.length;

test('real episode: source order, rebased spans/cuts, picture size, mixed audio and immutable inputs', t => {
  const f = fixture(t);
  const files = f.parts.flatMap(p => [p.video, p.plan]);
  const before = files.map(p => readFileSync(join(f.root, p)));
  const info = success(f.cli());
  assert.deepEqual(info.tasks, ['task09', 'task02']);
  assert.deepEqual(info.shots, [1, 2, 3]);
  assert.equal(info.duration, 4);
  assert.equal(info.fps, '10');
  assert.deepEqual(info.mapping.map(p => [p.start, p.end]), [[0, 2], [2, 4]]);
  assert.deepEqual(info.mapping.map(p => p.dimensions), [
    { width: 320, height: 180 }, { width: 320, height: 180 }]);
  assert.equal(info.config, 'fixture-config.md');
  assert.equal(info.dimensions.width, 320);
  assert.equal(info.dimensions.picture_height, 180);
  assert.equal(info.dimensions.height, 180 + info.dimensions.band_height);
  const payload = info.mapping.map(p => ({ ...p,
    segments: JSON.parse(readFileSync(join(f.root, f.parts[p.part - 1].plan))).segments }));
  const plan = JSON.parse(command('python3', ['-c',
    'import runpy,json,sys; m=runpy.run_path(sys.argv[1]); print(json.dumps(m["episode_plan"](json.loads(sys.argv[2]))))',
    join(scripts, 'episode-previs.py'), JSON.stringify(payload)]));
  assert.deepEqual(plan.segments.filter(s => s.section !== 'context').map(s => s.spans), [
    [[0.2, 0.6], [0.8, 1.2]], [[0, 1]], [[1, 2]],
    [[2.2, 2.6], [2.8, 3.2]], [[2, 4]],
  ]);
  assert.deepEqual(plan.segments.filter(s => s.section === 'header').map(s => [s.speaker, s.text]),
    [['task09', 'SHOT 1 [0s-1s]'], ['task09', 'SHOT 2 [1s-2s]'], ['task02', 'SHOT 3 [2s-4s]']]);
  assert.equal(plan.segments.filter(s => s.section === 'dialogue')[1].text, '等3秒，正文保持。');
  assert.ok(plan.segments.filter(s => s.section === 'context').every(s => s.missing));
  assert.equal(info.warnings.length, 1);
  const streams = probe(f.output);
  for (const stream of streams) {
    assert.equal(Number(stream.start_time), 0);
    assert.ok(Math.abs(Number(stream.duration) - 4) < 0.002);
  }
  assert.equal(streams[0].nb_frames, '40');
  const sound = samples(f.output);
  assert.ok(energy(sound.slice(4000, 24000)) < 1);
  assert.ok(energy(sound.slice(36000, 60000)) > 10000);
  const crop = `320:${info.dimensions.band_height}:0:180`;
  const at = time => frame(f.output, time, crop);
  assert.notDeepEqual(at(2.1), at(2.3));
  assert.notDeepEqual(at(2.3), at(2.7));
  assert.notDeepEqual(at(0.7), at(2.7));
  assert.notDeepEqual(at(2.7), at(3.7));
  files.forEach((p, i) => assert.deepEqual(readFileSync(join(f.root, p)), before[i]));
  const saved = readFileSync(f.output);
  const rejected = f.cli();
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /refusing to overwrite/);
  assert.deepEqual(readFileSync(f.output), saved);
  assert.equal(readdirSync(f.root).some(p => p.startsWith('.episode-previs-')), false);
});

test('whole-episode declarations and explicit parts fail before any encoding', t => {
  const f = fixture(t);
  f.write('bin/ffmpeg', '#!/bin/sh\ntouch "$CALLED"\nexit 88\n');
  command('chmod', ['+x', join(f.root, 'bin/ffmpeg')]);
  const called = join(f.root, 'called');
  const reject = pattern => {
    const r = f.cli([], { PATH: `${join(f.root, 'bin')}:${process.env.PATH}`, CALLED: called });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, pattern);
    assert.equal(existsSync(called), false);
    assert.equal(existsSync(f.output), false);
  };
  const config = readFileSync(join(f.root, 'fixture-config.md'), 'utf8');
  f.write('fixture-config.md', '- ep01 本地参考宽度: 320\n- ep01 本地参考高度: 180\n');
  reject(/fixture-config.md: ep01 本地参考fps: missing saved value/);
  f.write('fixture-config.md', config);
  f.write('parts.json', f.parts.slice(1));
  reject(/requires 2 entries/);
  f.write('parts.json', [...f.parts].reverse());
  reject(/part 1 \/ task09: video is not/);
  f.write('parts.json', f.parts.map((p, i) => i ? { video: p.video } : p));
  reject(/part 2 \/ task02/);
  f.write('parts.json', f.parts);
  const manifest = JSON.parse(readFileSync(join(f.root, f.manifest('task02'))));
  for (const prompt of [undefined, '   ']) {
    f.write(f.manifest('task02'), { ...manifest, prompt });
    reject(/task02: final task input requires/);
  }
  f.write(f.manifest('task02'), { ...manifest, shots: [2, 3] });
  reject(/Overlapping task member 2/);
  f.write(f.manifest('task02'), { ...manifest, shots: [4] });
  reject(/task02: missing source member 4/);
  const first = JSON.parse(readFileSync(join(f.root, f.manifest('task09'))));
  f.write(f.manifest('task02'), manifest);
  f.write(f.manifest('task09'), { ...first, shots: [1] });
  reject(/Unassigned requested shots: 2/);
  f.write(f.manifest('task09'), first);
  f.write(f.manifest('task02'), manifest);
  rmSync(join(f.root, f.parts[1].plan));
  reject(/part 2 \/ task02.*task02.json/);
  f.write(f.parts[1].plan, { segments: [], cues: [] });
  reject(/part 2 \/ task02.*only segments/);
  f.write(f.parts[1].plan, { segments: [{ speaker: '甲', text: '保留', spans: [[0, 3]] }] });
  reject(/part 2 \/ task02.*duration/);
  const context = { shot: 3, scene: '同一候车厅', action: '停步', spans: [[0, 2]] };
  for (const [entries, pattern] of [
    [null, /context must be an array/],
    [[{ ...context, shot: 2 }], /shot must belong/],
    [[{ ...context, spans: [[0, 3]] }], /duration/],
    [[{ ...context, spans: [] }], /nonempty array/],
    [[{ ...context, spans: [[true, 1]] }], /finite number/],
    [[{ ...context, scene: ' ' }], /scene.*nonempty/],
    [[{ ...context, camera: 1 }], /camera.*string/],
    [[{ ...context, duration: 2 }], /requires shot/],
    [[context, { ...context, spans: [[1, 2]] }], /overlapping context/],
    [[{ ...context, camera: '推'.repeat(150) }], /exceeds 6 wrapped lines/],
  ]) {
    f.write(f.parts[1].plan, { segments: [], context: entries });
    reject(pattern);
  }
  f.write(f.parts[1].plan, { segments: [] });
  f.write(f.parts[0].plan, { segments: [], context: [{ ...context, shot: 1, spans: [[0.5, 1.5]] }] });
  reject(/part 1 \/ task09.*within shot 1/);
  f.write(f.parts[0].plan, { segments: [] });
  f.write(f.parts[1].plan, { segments: [] });
  f.media(1, 3);
  reject(/part 2 \/ task02.*duration mismatch/);
  f.media(1, 2, '12');
  reject(/part 2 \/ task02.*fps mismatch/);
  f.media(1, 2, '10', false, 2, [], '256x144');
  reject(/part 2 \/ task02.*dimensions mismatch/);
  f.media(1, 2, '10', false, 2, ['-vf', 'settb=1/1000,setpts=100*N+13*mod(N\\,3)',
    '-vsync', '0', '-enc_time_base', '1/1000']);
  reject(/part 2 \/ task02.*VFR/);
});

test('124-second silent episode preserves representable rational CFR (120 is execution timeout)', t => {
  const f = fixture(t, { duration: 122, rate: '5/2', audio: false });
  const info = success(f.cli());
  assert.equal(info.duration, 124);
  assert.equal(info.fps, '5/2');
  assert.equal(info.audio, false);
  const streams = probe(f.output);
  assert.equal(streams.length, 1);
  assert.equal(streams[0].nb_frames, '310');
  assert.equal(Number(streams[0].duration), 124);
  const crop = `320:${info.dimensions.band_height}:0:180`;
  assert.notDeepEqual(frame(f.output, 120.4, crop), frame(f.output, 121.6, crop));
  f.media(1, 122, '24000/1001', false);
  rmSync(f.output);
  failure(f, /part 2 \/ task02.*fps mismatch/);
  f.write('fixture-config.md', '- ep01 本地参考宽度: 320\n- ep01 本地参考高度: 180\n- ep01 本地参考fps: 24000/1001\n');
  f.media(0, 2, '24000/1001', false);
  failure(f, /part 1 \/ task09.*not representable/);
});

test('late renderer failure leaves no output; publication race preserves competing output', t => {
  const f = fixture(t);
  const realFFmpeg = command('which', ['ffmpeg']).trim();
  f.write('bin/ffmpeg', `#!/bin/sh
if [ -e "$COUNT" ]; then
  if [ "$MODE" = fail ]; then exit 87; fi
  printf 'other publisher' > "$DESTINATION"
else
  touch "$COUNT"
fi
exec "${realFFmpeg}" "$@"
`);
  command('chmod', ['+x', join(f.root, 'bin/ffmpeg')]);
  const env = { PATH: `${join(f.root, 'bin')}:${process.env.PATH}`,
    COUNT: join(f.root, 'count'), DESTINATION: f.output };
  const failed = f.cli([], { ...env, MODE: 'fail' });
  assert.equal(failed.status, 1, failed.stderr);
  assert.equal(existsSync(f.output), false);
  rmSync(env.COUNT);
  const raced = f.cli([], { ...env, MODE: 'race' });
  assert.equal(raced.status, 1, raced.stderr);
  assert.match(raced.stderr, /File exists/);
  assert.equal(readFileSync(f.output, 'utf8'), 'other publisher');
  assert.equal(readdirSync(f.root).some(p => p.startsWith('.episode-previs-')), false);
});

test('context windows rebase across tasks with same scene and separate intact overlapping dialogue', t => {
  const f = fixture(t);
  f.write('fixture-config.md', '- ep01 本地参考宽度: 640\n- ep01 本地参考高度: 360\n- ep01 本地参考fps: 10\n');
  for (const i of [0, 1]) f.media(i, 2, '10', false, 2, [], '640x360');
  const scene = '车站候车厅';
  const plans = [
    { segments: [{ speaker: '甲', text: '等3秒，正文保持。', spans: [[0, 2]] }], context: [
      { shot: 1, scene, camera: '缓推近', action: '甲走向门口', spans: [[0, 0.5], [0.2, 0.5]] },
      { shot: 1, scene, camera: '停止推进', action: '甲停步', performance: '犹豫回望', spans: [[0.5, 1]] },
      { shot: 2, scene, camera: '侧面固定', action: '乙举起车票', spans: [[1, 2]] },
    ] },
    { segments: [
      { speaker: '甲', text: '别走，等我！', spans: [[0, 2]] },
      { speaker: '乙', text: '车马上开。', spans: [[0.2, 1.8]] },
    ], context: [{ shot: 3, scene, camera: '横移跟随', action: '两人向右走', spans: [[0, 2]] }] },
  ];
  plans.forEach((p, i) => f.write(f.parts[i].plan, p));
  const info = success(f.cli());
  assert.deepEqual(info.warnings, []);
  assert.equal(probe(f.output)[0].nb_frames, '40');
  const payload = info.mapping.map((p, i) => ({ ...p, ...plans[i] }));
  const result = JSON.parse(command('python3', ['-c', `
import json, runpy, sys
m = runpy.run_path(sys.argv[1]); p = m['episode_plan'](json.loads(sys.argv[2]))
v = m['preview']; _, events, _, _ = v['audio_plan']['validate_plan'](p, 4)
intervals = v['cue_intervals'](events, 4, True)
font = v['load_font'](sys.argv[3], 16, ''.join(s['text'] for s in p['segments']))
layouts = v['band_layouts'](p, intervals, font, 640)
print(json.dumps({'plan': p, 'lines': [layouts[(active, second)] for _, _, active, second in intervals]}))
`, join(scripts, 'episode-previs.py'), JSON.stringify(payload), font]));
  const notes = result.plan.segments.filter(s => s.section === 'context');
  assert.deepEqual(notes.map(s => s.spans), [[[0, 0.2]], [[0.2, 0.5]], [[0.5, 1]], [[1, 2]], [[2, 4]]]);
  assert.ok(notes.every(s => s.text.startsWith(scene)));
  assert.ok(result.lines.some(lines => lines.includes('甲: 别走，等我！') && lines.includes('乙: 车马上开。')));
  assert.equal(new Set(result.lines.map(lines => lines.indexOf('【对白/旁白】'))).size, 1);
  const crop = `640:${info.dimensions.band_height}:0:360`;
  assert.notDeepEqual(frame(f.output, 0.3, crop), frame(f.output, 0.7, crop));
  assert.notDeepEqual(frame(f.output, 1.7, crop), frame(f.output, 2.7, crop));
  // Optional retained, reproducible engineering sample; never production paths.
  const sample = process.env.EPISODE_PREVIS_SAMPLE_DIR;
  if (sample) {
    assert.ok(sample.startsWith('/tmp/opencode/'));
    copyFileSync(f.output, join(sample, 'episode-context.mp4'));
    writeFileSync(join(sample, 'plans.json'), JSON.stringify(plans, null, 2));
    writeFileSync(join(sample, 'info.json'), JSON.stringify(info, null, 2));
    for (const time of [0.3, 0.7, 1.7, 2.7]) {
      ffmpeg(['-ss', String(time), '-i', f.output, '-frames:v', '1', '-threads', '1',
        join(sample, `frame-${time}.png`)]);
      ffmpeg(['-ss', String(time), '-i', f.output, '-vf', `crop=${crop}`,
        '-frames:v', '1', '-threads', '1', join(sample, `caption-${time}.png`)]);
    }
  }
});

test('source audio is padded/trimmed per canonical part before concatenation', t => {
  const f = fixture(t);
  f.media(0, 2, '10', true, 0.6, ['-output_ts_offset', '5']);
  f.media(1, 2, '10', true, 3);
  const info = success(f.cli());
  assert.equal(info.duration, 4);
  const sound = samples(f.output);
  assert.ok(energy(sound.slice(1600, 6400)) > 10000);
  assert.ok(energy(sound.slice(16000, 28000)) < 1);
  assert.ok(energy(sound.slice(34000, 62000)) > 10000);
  assert.ok(Math.abs(Number(probe(f.output)[1].duration) - 4) < 0.002);
});
