import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync,
  readdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/svg-animatic.py', import.meta.url));
const example = fileURLToPath(new URL('../../examples/svg-animatic/source.py', import.meta.url));
const preview = fileURLToPath(new URL('../../scripts/previs-preview.py', import.meta.url));
const plan = fileURLToPath(new URL('../../examples/svg-animatic/review-plan.json', import.meta.url));
const font = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
function command(program, args, binary = false) {
  const r = spawnSync(program, args, { encoding: binary ? null : 'utf8',
    maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr?.toString());
  return r.stdout;
}
function fixture(t) {
  const root = mkdtempSync('/tmp/opencode/svg-animatic-test-');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, source: join(root, 'source.py'), output: join(root, 'complete.mp4') };
}
function args(f, extra = []) {
  return [script, f.source, '--duration', '6', '--fps', '24', '--width', '160',
    '--height', '90', '--output', f.output, ...extra];
}
const cli = (f, extra) => spawnSync('python3', args(f, extra), { encoding: 'utf8' });
function success(r) {
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
function failure(r, pattern) {
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, pattern);
}
const probe = path => JSON.parse(command('ffprobe', ['-v', 'error', '-show_streams',
  '-show_frames', '-select_streams', 'v:0', '-of', 'json', path]));

test('real SVG renderer: complete three-shot MP4, exact cuts and intermediate occlusion', t => {
  const f = fixture(t);
  f.source = example;
  assert.equal(success(cli(f)).frames, 144);
  const { streams: [v], frames } = probe(f.output);
  assert.equal(v.duration_ts, 144);
  assert.equal(v.time_base, '1/24');
  assert.equal(frames.length, 144);
  frames.forEach((frame, n) => assert.equal(frame.best_effort_timestamp, n));
  const indices = [0, 47, 48, 60, 72, 84, 95, 96, 143];
  const raw = command('ffmpeg', ['-v', 'error', '-i', f.output, '-vf',
    `select='${indices.map(n => `eq(n,${n})`).join('+')}'`, '-vsync', '0',
    '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], true);
  const size = 160 * 90 * 3;
  assert.equal(raw.length, size * indices.length);
  function pixel(index, x, y, expected) {
    const offset = indices.indexOf(index) * size + (y * 160 + x) * 3;
    const actual = [...raw.subarray(offset, offset + 3)];
    actual.forEach((c, i) => assert.ok(Math.abs(c - expected[i]) < 15,
      `frame ${index} (${x},${y}): ${actual} vs ${expected}`));
  }
  for (const n of [0, 47]) pixel(n, 5, 5, [25, 44, 72]);
  for (const n of [48, 60, 72, 84, 95]) pixel(n, 5, 5, [22, 70, 76]);
  for (const n of [96, 143]) pixel(n, 5, 5, [48, 35, 63]);
  pixel(48, 25, 50, [245, 184, 91]);
  pixel(60, 52, 50, [245, 184, 91]);
  pixel(72, 80, 50, [14, 48, 56]); // Moving proxy is behind the foreground pillar.
  pixel(84, 107, 50, [245, 184, 91]);
  pixel(95, 132, 50, [245, 184, 91]);
  for (const n of [96, 143]) pixel(n, 120, 65, [36, 121, 105]);
  assert.deepEqual(readdirSync(f.root), ['complete.mp4']);
});

const svg = `'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="red"/></svg>'`;
test('single source load and exact rational n/fps sampling with no rounded duration', t => {
  const f = fixture(t);
  writeFileSync(f.source, `from fractions import Fraction
calls = 0
def frame(t, width, height):
    global calls
    assert isinstance(t, Fraction)
    assert t == Fraction(calls * 1001, 24000)
    calls += 1
    return ${svg}
`);
  const timing = ['--duration', '7007/3000', '--fps', '24000/1001'];
  assert.equal(success(cli(f, timing)).frames, 56);
  const { streams: [v], frames } = probe(f.output);
  assert.equal(v.duration_ts, 56056);
  assert.equal(v.time_base, '1/24000');
  assert.equal(frames.length, 56);
  frames.forEach((frame, n) => assert.equal(frame.best_effort_timestamp, n * 1001));
  const old = readFileSync(f.output);
  failure(cli(f, ['--duration', '0.1', '--overwrite']), /integer; no rounding/);
  assert.deepEqual(readFileSync(f.output), old);
});

test('source/frame/SVG failures preserve old output and clean partial encodes', t => {
  const f = fixture(t);
  const cases = [
    ['def broken(', /SOURCE/],
    ['raise RuntimeError("load failed")', /SOURCE.*load failed/],
    ['frame = 42', /must define frame/],
    [`def frame(t,w,h):\n    if t > 0: raise RuntimeError("bad frame")\n    return ${svg}`, /frame 1.*bad frame/],
    [`def frame(t,w,h):\n    return ${svg} if t == 0 else '<svg>'`, /frame 1.*SVG/],
    ['def frame(t,w,h): return None', /nonempty SVG/],
  ];
  for (const [source, pattern] of cases) {
    writeFileSync(f.source, source);
    for (const old of [false, true]) {
      if (old) writeFileSync(f.output, 'old output');
      failure(cli(f, ['--overwrite']), pattern);
      assert.equal(existsSync(f.output), old);
      assert.deepEqual(readdirSync(f.root).sort(), old ? ['complete.mp4', 'source.py'] : ['source.py']);
      if (old) {
        assert.equal(readFileSync(f.output, 'utf8'), 'old output');
        unlinkSync(f.output);
      }
    }
  }
});

test('explicit overwrite publishes only success; source aliases are never replaced', t => {
  const f = fixture(t);
  writeFileSync(f.source, `def frame(t,w,h): return ${svg}`);
  writeFileSync(f.output, 'old output');
  failure(cli(f), /output exists/);
  assert.equal(readFileSync(f.output, 'utf8'), 'old output');
  success(cli(f, ['--overwrite']));
  assert.equal(probe(f.output).frames.length, 144);
  unlinkSync(f.output);
  const before = readFileSync(f.source);
  symlinkSync(f.source, f.output);
  failure(cli(f, ['--overwrite']), /must not overwrite SOURCE/);
  assert.deepEqual(readFileSync(f.source), before);
  failure(cli(f, ['--output', f.source, '--overwrite']), /must not overwrite SOURCE/);
});

test('real FFmpeg write failure preserves existing output and removes temporary files', t => {
  const f = fixture(t);
  f.source = example;
  writeFileSync(f.output, 'old output');
  const r = spawnSync('python3', ['-c', `
import resource, runpy, signal, sys
signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
_, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
resource.setrlimit(resource.RLIMIT_FSIZE, (4096, hard))
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
`, ...args(f, ['--width', '640', '--height', '360', '--overwrite'])], { encoding: 'utf8' });
  failure(r, /FFmpeg|encoder/);
  assert.equal(readFileSync(f.output, 'utf8'), 'old output');
  assert.deepEqual(readdirSync(f.root), ['complete.mp4']);
});

test('complete subtitle/timecode review preserves every clean frame timestamp', t => {
  const f = fixture(t);
  f.source = example;
  success(cli(f, ['--width', '640', '--height', '360']));
  const before = readFileSync(f.output);
  const review = join(f.root, 'review.mp4');
  const info = JSON.parse(command('python3', [preview, f.output, plan, '--timecode',
    '--font', font, '--output', review]));
  const clean = probe(f.output), rendered = probe(review);
  const a = clean.streams[0], b = rendered.streams[0];
  for (const key of ['r_frame_rate', 'avg_frame_rate', 'time_base', 'duration_ts',
    'duration', 'nb_frames', 'width']) assert.equal(b[key], a[key], key);
  assert.equal(b.height, a.height + info.band_height);
  const timing = p => p.frames.map(frame => [frame.best_effort_timestamp, frame.pkt_duration]);
  assert.deepEqual(timing(rendered), timing(clean));
  assert.equal(rendered.frames.length, 144);
  assert.deepEqual(readFileSync(f.output), before);
  const indices = [0, 6, 24, 42, 48, 54, 66, 90, 96, 102, 114, 138];
  const raw = command('ffmpeg', ['-v', 'error', '-i', review, '-vf',
    `select='${indices.map(n => `eq(n,${n})`).join('+')}',crop=640:${info.band_height}:0:360`,
    '-vsync', '0', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], true);
  const size = 640 * info.band_height * 3;
  assert.equal(raw.length, indices.length * size);
  const band = n => raw.subarray(indices.indexOf(n) * size, (indices.indexOf(n) + 1) * size);
  const bright = bytes => bytes.reduce((sum, value) => sum + (value > 150), 0);
  // Timecode alone remains visible during gaps and changes each second.
  const base = bright(band(0));
  assert.ok(base > 100);
  assert.notDeepEqual(band(0), band(42));
  for (const n of [6, 24, 48, 66, 96, 114]) assert.ok(bright(band(n)) > base + 200);
  // Overlapping cut labels + dialogue/VO have separate complete lines.
  assert.ok(bright(band(54)) > bright(band(48)) + 200);
  assert.ok(bright(band(102)) > bright(band(96)) + 200);
  for (const n of [42, 90, 138]) assert.ok(bright(band(n)) < base + 200);
});
