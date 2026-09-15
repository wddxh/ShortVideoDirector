import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync,
  symlinkSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/previs-preview.py', import.meta.url));
const audioScript = fileURLToPath(new URL('../../scripts/previs-audio.py', import.meta.url));
const font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
function command(program, args, binary = false) {
  const result = spawnSync(program, args, { encoding: binary ? null : 'utf8',
    maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr?.toString());
  return result.stdout;
}
const ffmpeg = args => command('ffmpeg', ['-v', 'error', '-nostdin', '-n', ...args]);
function fixture(t, { audio = false, filter, duration = '2.3', rate = '10',
  timing = [] } = {}) {
  const root = mkdtempSync('/tmp/opencode/previs-preview-test-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const f = { root, video: join(root, "clean '中文;[].mp4"),
    plan: join(root, 'plan.json'), output: join(root, 'derived.mp4') };
  const args = ['-f', 'lavfi', '-i', `testsrc2=s=320x180:r=${rate}:d=${duration}`];
  if (audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${duration}`);
  if (filter) args.push('-vf', filter);
  ffmpeg([...args, ...timing, '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', f.video]);
  writeFileSync(f.plan, '{}');
  return f;
}
function cli(f, extra = []) {
  return spawnSync('python3', [script, f.video, f.plan, '--output', f.output, ...extra],
    { encoding: 'utf8' });
}
function success(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}
function failure(result, pattern) {
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^previs-preview: [^\n]+\n$/);
  if (pattern) assert.match(result.stderr, pattern);
}
const probe = path => JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams',
  '-of', 'json', path])).streams;
const frameTimes = path => JSON.parse(command('ffprobe', ['-v', 'error',
  '-select_streams', 'v:0', '-show_frames', '-show_entries',
  'frame=best_effort_timestamp_time,pkt_duration_time', '-of', 'json', path])).frames;

for (const timecode of [false, true]) {
  test(`rational CFR preserves all 56 frames and final audio, timecode=${timecode}`, t => {
    const duration = 56 * 1001 / 24000;
    const f = fixture(t, { rate: '24000/1001', duration: '2.3356', audio: true });
    const before = readFileSync(f.video);
    const source = frameTimes(f.video);
    assert.equal(source.length, 56);
    assert.ok(energy(samples(f.video).slice(36800, 37280)) > 10000);
    writeFileSync(f.plan, JSON.stringify({ segments: [
      { speaker: '甲', text: '最后一句', spans: [[2.28, 2.335667]] },
    ] }));
    const info = success(cli(f, timecode ? ['--timecode'] : []));
    const output = frameTimes(f.output);
    assert.equal(output.length, source.length);
    assert.deepEqual(output, source);
    const streams = durationCheck(f.output, duration);
    close(streams[0].duration, duration, 0.000002);
    close(streams[1].duration, duration, 0.003);
    assert.equal(streams[0].width, 320);
    assert.equal(streams[0].height, 180 + info.band_height);
    const audio = samples(f.output);
    assert.ok(energy(audio.slice(Math.floor(2.30 * 16000), Math.floor(2.33 * 16000))) > 10000);
    assert.ok(bright(frame(f.output, 2.29, `320:${info.band_height}:0:180`)) > 100);
    assert.deepEqual(readFileSync(f.video), before);
  });
}
function frame(path, time, crop) {
  return command('ffmpeg', ['-v', 'error', '-ss', String(time), '-i', path,
    ...(crop ? ['-vf', `crop=${crop}`] : []), '-frames:v', '1', '-threads', '1',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], true);
}
const bright = bytes => bytes.reduce((sum, x) => sum + (x > 100), 0);
function close(actual, expected, epsilon = 0.025) {
  assert.ok(Math.abs(Number(actual) - expected) < epsilon, `${actual} vs ${expected}`);
}
function durationCheck(path, duration = 2.3) {
  const streams = probe(path);
  for (const stream of streams) {
    close(stream.start_time, 0);
    close(stream.duration, duration);
  }
  return streams;
}

test('VFR is rejected from actual timestamps before any output mutation', t => {
  const f = fixture(t, { filter: 'settb=1/1000,setpts=100*N+13*mod(N\\,3)',
    timing: ['-vsync', '0', '-enc_time_base', '1/1000'] });
  const frames = frameTimes(f.video);
  assert.equal(frames.length, 23);
  assert.deepEqual(frames.slice(0, 4).map(x => x.best_effort_timestamp_time),
    ['0.000000', '0.113000', '0.226000', '0.300000']);
  const before = readFileSync(f.video);
  const neighbors = readdirSync(f.root).sort();
  failure(cli(f), /VFR|constant.frame.rate/);
  assert.equal(existsSync(f.output), false);
  assert.deepEqual(readdirSync(f.root).sort(), neighbors);
  assert.deepEqual(readFileSync(f.video), before);
});

test('ZWSP and variation selectors retain valid caption text; visible missing glyphs fail', t => {
  const f = fixture(t);
  const text = '中文\u200b换行：字\ufe0f与汉\u{e0100}';
  writeFileSync(f.plan, JSON.stringify({ segments: [
    { speaker: '甲', text, spans: [[0, 1]] },
  ] }));
  const before = readFileSync(f.plan);
  const info = success(cli(f, ['--font', font]));
  assert.ok(bright(frame(f.output, 0.2, `320:${info.band_height}:0:180`)) > 100);
  assert.deepEqual(readFileSync(f.plan), before);
  unlinkSync(f.output);
  writeFileSync(f.plan, JSON.stringify({ segments: [
    { speaker: '甲', text: '\u{10ffff}', spans: [[0, 1]] },
  ] }));
  failure(cli(f, ['--font', font]), /font/);
  assert.equal(existsSync(f.output), false);
});

test('Chinese whole utterances, overlap dedup, pauses, literal text and uncropped picture', t => {
  const f = fixture(t);
  const before = readFileSync(f.video);
  writeFileSync(f.plan, JSON.stringify({ segments: [
    { speaker: '甲', text: "中文完整长句要换行，保留标点！\\N {x} [a]: 50% ' ;\n第二行",
      spans: [[0.2, 0.8], [0.5, 1.1], [1.8, 2.1]] },
    { speaker: '甲', text: '不同发言', spans: [[0.6, 1.0]] },
    { speaker: '乙', text: '同时说话', spans: [[0.6, 1.0]] },
  ] }));
  const info = success(cli(f, ['--font', font]));
  assert.equal(info.cue_images, 3);
  const [video] = durationCheck(f.output);
  assert.equal(video.width, 320);
  assert.equal(video.height, 180 + info.band_height);
  assert.equal(video.nb_frames, '23');
  const band = time => frame(f.output, time, `320:${info.band_height}:0:180`);
  assert.equal(bright(band(0)), 0);
  assert.equal(bright(band(1.3)), 0);
  const single = bright(band(0.3));
  assert.ok(single > 1000);
  assert.ok(Math.abs(bright(band(0.5)) - single) < 30);
  assert.ok(bright(band(0.7)) > single + 500);
  const overlap = band(0.7);
  for (let y = 0; y < info.band_height; y++) {
    assert.equal(bright(overlap.subarray(y * 960, y * 960 + 12)), 0);
    assert.equal(bright(overlap.subarray((y + 1) * 960 - 12, (y + 1) * 960)), 0);
  }
  assert.equal(bright(overlap.subarray(-320 * 3 * 4)), 0);
  const original = frame(f.video, 0.7), picture = frame(f.output, 0.7, '320:180:0:0');
  assert.equal(picture.length, original.length);
  const error = original.reduce((sum, value, i) => sum + Math.abs(value - picture[i]), 0);
  assert.ok(error / original.length < 4);
  assert.deepEqual(readFileSync(f.video), before);
});

function samples(path) {
  const pcm = command('ffmpeg', ['-v', 'error', '-i', path, '-map', '0:a:0',
    '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'], true);
  return Array.from({ length: pcm.length / 2 }, (_, i) => pcm.readInt16LE(i * 2));
}
const energy = data => data.reduce((sum, x) => sum + x * x, 0) / data.length;
function tone(data, hz) {
  let re = 0, im = 0;
  data.forEach((x, i) => {
    re += x * Math.cos(2 * Math.PI * hz * i / 16000);
    im += x * Math.sin(2 * Math.PI * hz * i / 16000);
  });
  return re * re + im * im;
}

test('source audio retained and elapsed clock changes during subtitle pauses', t => {
  const f = fixture(t, { audio: true });
  const info = success(cli(f, ['--timecode']));
  assert.equal(durationCheck(f.output).length, 2);
  const data = samples(f.output).slice(1600, 8000);
  assert.ok(tone(data, 440) > tone(data, 880) * 100);
  const crop = `320:${info.band_height}:0:180`;
  assert.ok(bright(frame(f.output, 0.2, crop)) > 100);
  assert.notDeepEqual(frame(f.output, 0.2, crop), frame(f.output, 1.2, crop));
});

test('replacement fake audio pads short WAVs and trims long WAVs without shortening video', t => {
  const f = fixture(t, { audio: true });
  for (const length of [0.5, 3]) {
    const dir = join(f.root, `audio-${length}`);
    writeFileSync(f.plan, JSON.stringify({ segments: [
      { speaker: '甲', text: '假音频', spans: [[0, length]] },
    ] }));
    command('python3', [audioScript, f.plan, '--duration', String(length), '--output-dir', dir]);
    writeFileSync(f.plan, '{}');
    f.output = join(f.root, `preview-${length}.mp4`);
    success(cli(f, ['--audio', join(dir, 'mix.wav')]));
    durationCheck(f.output);
    const data = samples(f.output);
    assert.ok(energy(data.slice(1600, 4800)) > 10000);
    assert.ok(tone(data.slice(1600, 4800), 220) > tone(data.slice(1600, 4800), 440) * 100);
    if (length < 2.3) assert.ok(energy(data.slice(16000, 32000)) < 1);
    else assert.ok(energy(data.slice(16000, 32000)) > 10000);
  }
});

test('nonzero source timestamps become zero and retain video length', t => {
  const f = fixture(t, { audio: true });
  const shifted = join(f.root, 'offset.mp4');
  ffmpeg(['-i', f.video, '-c', 'copy', '-output_ts_offset', '5', shifted]);
  f.video = shifted;
  assert.ok(Number(probe(f.video)[0].start_time) >= 5);
  success(cli(f));
  durationCheck(f.output);
  assert.ok(energy(samples(f.output).slice(1600, 8000)) > 10000);
});

test('invalid plan bounds, schema and missing or unsuitable fonts create no output', t => {
  const f = fixture(t);
  for (const spans of [[[-0.1, 1]], [[0, 2.31]], [[1, 1]], [[1, 0.5]],
    [[true, 1]], [[0.1, 0.100001]], [[0]], null]) {
    writeFileSync(f.plan, JSON.stringify({ segments: [{ speaker: '甲', text: '你好', spans }] }));
    failure(cli(f));
    assert.equal(existsSync(f.output), false);
  }
  for (const plan of ['null', '{', '{"segments":{}}',
    '{"segments":[{"speaker":"A","spans":[]}]}',
    '{"cues":[{"label":"x","at":2,"duration":1}]}',
    '{"segments":[{"speaker":"A","text":"x","spans":[[0,NaN]]}]}']) {
    writeFileSync(f.plan, plan);
    failure(cli(f));
    assert.equal(existsSync(f.output), false);
  }
  writeFileSync(f.plan, '{}');
  for (const path of [join(f.root, 'absent.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']) {
    failure(cli(f, ['--font', path]), /--font PATH/);
    assert.equal(existsSync(f.output), false);
  }
});

test('rotation and nonsquare pixels require explicit source normalization', t => {
  const f = fixture(t, { filter: 'setsar=2/1' });
  failure(cli(f), /square pixels/);
  const normal = fixture(t);
  const rotated = join(normal.root, 'rotated.mp4');
  ffmpeg(['-i', normal.video, '-c', 'copy', '-metadata:s:v:0', 'rotate=90', rotated]);
  normal.video = rotated;
  failure(cli(normal), /rotation/);
  assert.equal(existsSync(normal.output), false);
});

test('existing outputs, source aliases and dangling symlinks are preserved', t => {
  const f = fixture(t);
  const source = readFileSync(f.video);
  writeFileSync(f.output, 'keep');
  failure(cli(f), /overwrite/);
  assert.equal(readFileSync(f.output, 'utf8'), 'keep');
  unlinkSync(f.output);
  for (const target of [f.video, join(f.root, 'absent')]) {
    symlinkSync(target, f.output);
    failure(cli(f), /overwrite/);
    unlinkSync(f.output);
  }
  f.output = f.video;
  failure(cli(f), /overwrite/);
  assert.deepEqual(readFileSync(f.video), source);
});

test('encoding failure cleans temporary files and preserves unrelated output neighbors', t => {
  const f = fixture(t);
  const created = join(f.root, 'created-directories.jsonl');
  const neighbor = join(f.root, 'neighbor.mp4');
  writeFileSync(neighbor, 'keep neighbor');
  const source = readFileSync(f.video);
  // Real FFmpeg fails when writing the MP4 under a bounded file-size limit.
  // Observe this process's real tempfile calls; concurrent renderers share the
  // explicit /tmp/opencode directory, so TMPDIR/global snapshots cannot isolate it.
  const result = spawnSync('python3', ['-c', `
import json, resource, runpy, signal, sys
log = sys.argv[1]
def audit(event, args):
    if event == "tempfile.mkdtemp":
        with open(log, "a") as stream:
            stream.write(json.dumps(args[0]) + "\\n")
sys.addaudithook(audit)
signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
_, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
resource.setrlimit(resource.RLIMIT_FSIZE, (4096, hard))
sys.argv = sys.argv[2:]
runpy.run_path(sys.argv[0], run_name="__main__")
`, created, script, f.video, f.plan, '--output', f.output], { encoding: 'utf8' });
  failure(result);
  assert.equal(existsSync(f.output), false);
  assert.equal(readFileSync(f.plan, 'utf8'), '{}');
  const directories = readFileSync(created, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(directories.some(dir => dir.startsWith('/tmp/opencode/previs-preview-')));
  for (const dir of directories) assert.equal(existsSync(dir), false, `leaked ${dir}`);
  assert.deepEqual(readFileSync(f.video), source);
  assert.equal(readFileSync(neighbor, 'utf8'), 'keep neighbor');
  success(cli(f));
});

test('fractional cue boundaries do not snap early; identical distinct utterances stay separate', t => {
  const f = fixture(t);
  writeFileSync(f.plan, JSON.stringify({ segments: [
    { speaker: '甲', text: '同一句话', spans: [[0.201, 0.501], [2.2, 2.3]] },
    { speaker: '甲', text: '同一句话', spans: [[0.301, 0.501]] },
  ] }));
  const info = success(cli(f));
  const band = time => frame(f.output, time, `320:${info.band_height}:0:180`);
  assert.equal(bright(band(0.2)), 0);
  const single = bright(band(0.3));
  assert.ok(single > 100);
  assert.ok(bright(band(0.4)) > 1.9 * single);
  assert.equal(bright(band(0.6)), 0);
  assert.ok(bright(band(2.2)) > 100);
  durationCheck(f.output);
});

test('failed final publication removes only its reserved file', t => {
  const f = fixture(t);
  const result = command('python3', ['-c', `
import io, pathlib, resource, runpy, signal, sys
module = runpy.run_path(sys.argv[1])
signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
_, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
resource.setrlimit(resource.RLIMIT_FSIZE, (64, hard))
try:
    module['publish'](pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]))
except OSError:
    print('failed as expected')
`, script, f.video, f.output]);
  assert.equal(result.trim(), 'failed as expected');
  assert.equal(existsSync(f.output), false);
  assert.equal(readFileSync(f.plan, 'utf8'), '{}');
});
