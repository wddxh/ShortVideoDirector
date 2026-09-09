import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync,
  mkdirSync, existsSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/previs-audio.py', import.meta.url));
const rate = 16000;
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'previs-audio-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, plan: join(root, 'plan.json'), output: join(root, 'nested', 'audio') };
}
function cli(f, plan = {}, duration = '1') {
  writeFileSync(f.plan, typeof plan === 'string' ? plan : JSON.stringify(plan));
  return spawnSync('python3', [script, f.plan, '--duration', duration,
    '--output-dir', f.output], { encoding: 'utf8' });
}
function success(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}
function failure(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^previs-audio: [^\n]+\n$/);
}
const summary = f => JSON.parse(readFileSync(join(f.output, 'summary.json'), 'utf8'));
const segment = (speaker, spans, text = 'Ignored text.') => ({ speaker, text, spans });

function wav(f, name = 'mix.wav') {
  const bytes = readFileSync(join(f.output, name));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8);
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  let samples;
  let format = false;
  for (let offset = 12; offset < bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      assert.equal(bytes.readUInt16LE(start), 1);
      assert.equal(bytes.readUInt16LE(start + 2), 1);
      assert.equal(bytes.readUInt32LE(start + 4), rate);
      assert.equal(bytes.readUInt32LE(start + 8), rate * 2);
      assert.equal(bytes.readUInt16LE(start + 12), 2);
      assert.equal(bytes.readUInt16LE(start + 14), 16);
      format = true;
    }
    if (id === 'data') {
      assert.equal(size % 2, 0);
      samples = Array.from({ length: size / 2 }, (_, i) => bytes.readInt16LE(start + i * 2));
    }
    offset = start + size + (size % 2);
  }
  assert.ok(format && samples);
  return samples;
}
const peak = samples => samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

test('empty plans render equal fractional silence and concise diagnostics', t => {
  for (const plan of [{}, { segments: [], cues: [] }]) {
    const f = fixture(t);
    const result = success(cli(f, plan, '0.12346'));
    assert.deepEqual(result.files, ['mix.wav', 'summary.json']);
    assert.equal(result.duration, 1975 / rate);
    assert.deepEqual(result.warnings, []);
    assert.equal(wav(f).length, 1975);
    assert.equal(peak(wav(f)), 0);
    assert.equal(summary(f).gain, 1);
  }
});

test('cue-only decimal boundary and half-sample rounding retain requested timing', t => {
  const f = fixture(t);
  success(cli(f, { cues: [{ label: 'end', at: 0.1, duration: 0.2 }] }, '0.3'));
  assert.deepEqual(summary(f).files, ['cues.wav', 'mix.wav', 'summary.json']);
  assert.equal(summary(f).events[0].end_sample, 4800);
  assert.deepEqual(wav(f, 'cues.wav'), wav(f));
  const halfway = fixture(t);
  success(cli(halfway, { segments: [segment('A', [[0.03125 / 1000, 0.02]])] }, '0.02003125'));
  assert.equal(summary(halfway).frames, 321);
  assert.equal(summary(halfway).events[0].start_sample, 1);
  assert.equal(summary(halfway).events[0].end_sample, 320);
  const outside = fixture(t);
  failure(cli(outside, { cues: [{ label: 'end', at: 0.1, duration: 0.200000001 }] }, '0.3'));
});

test('fractional spans, safe Unicode mapping, fades and text-independent tones', t => {
  const f = fixture(t);
  const plan = { segments: [
    segment('../\u5f20\u4e09/voice', [[0.10004, 0.30004], [0.4, 0.5]]),
    segment('\\\u674e\u56db', [[0.6, 0.8]]),
    segment('silent', []),
  ], cues: [{ label: '../../\u95e8\u94c3', at: 0.85004, duration: 0.1 }] };
  success(cli(f, plan));
  const s = summary(f);
  assert.deepEqual(s.speakers.map(x => x.speaker), plan.segments.map(x => x.speaker));
  assert.deepEqual(s.speakers.map(x => x.file),
    ['speaker-001.wav', 'speaker-002.wav', 'speaker-003.wav']);
  assert.equal(s.cues[0].label, plan.cues[0].label);
  assert.deepEqual(s.counts, { segments: 3, spans: 3, speakers: 3, cues: 1 });
  assert.deepEqual(readdirSync(f.output).sort(), s.files.toSorted());
  assert.equal(s.events[0].start_sample, 1601);
  assert.equal(s.events[0].end_sample, 4801);
  const a = wav(f, 'speaker-001.wav');
  assert.equal(peak(a.slice(0, 1601)), 0);
  assert.equal(peak(a.slice(4801, 6400)), 0);
  assert.equal(a[1601], 0);
  assert.equal(a[4800], 0);
  assert.ok(peak(a.slice(1601, 1611)) < 60);
  assert.ok(peak(a.slice(4791, 4801)) < 60);
  assert.ok(peak(a.slice(1800, 2000)) > 3000);
  assert.notEqual(s.speakers[0].frequency_hz, s.speakers[1].frequency_hz);
  assert.equal(peak(wav(f, 'speaker-003.wav')), 0);
  const cue = wav(f, 'cues.wav');
  assert.equal(peak(cue.slice(0, 13601)), 0);
  assert.equal(peak(cue.slice(15201)), 0);
  assert.equal(cue[13601], 0);
  assert.equal(cue[15200], 0);
  assert.ok(peak(cue) > 1000);
  for (const file of s.files.filter(x => x.endsWith('.wav'))) {
    assert.equal(wav(f, file).length, rate);
  }
  const other = fixture(t);
  plan.segments.forEach(x => { x.text = '...\n\u957f\u53f0\u8bcd! '.repeat(100); });
  success(cli(other, plan));
  for (const file of s.files) {
    assert.deepEqual(readFileSync(join(other.output, file)), readFileSync(join(f.output, file)));
  }
});

test('same-speaker overlaps sum without trimming; different speakers only report', t => {
  const single = fixture(t), same = fixture(t), different = fixture(t);
  const spans = [[0.1, 0.9]];
  success(cli(single, { segments: [segment('A', spans)] }));
  const result = success(cli(same, { segments: [segment('A', spans), segment('A', spans)] }));
  assert.equal(result.warnings.length, 1);
  assert.equal(summary(same).overlaps[0].kind, 'same_speaker');
  assert.equal(summary(same).counts.spans, 2);
  assert.equal(summary(same).speakers.length, 1);
  const a = wav(single), doubled = wav(same);
  a.forEach((value, i) => assert.ok(Math.abs(doubled[i] - 2 * value) <= 1));
  assert.deepEqual(success(cli(different, { segments: [segment('A', spans),
    segment('B', spans)] })).warnings, []);
  const s = summary(different);
  assert.equal(s.overlaps[0].kind, 'different_speakers');
  assert.equal(s.overlaps[0].start_sample, 1600);
  assert.equal(s.overlaps[0].end_sample, 14400);
  const b = wav(different, 'speaker-002.wav');
  assert.notDeepEqual(b, a);
  const mixed = wav(different);
  mixed.forEach((value, i) => assert.ok(Math.abs(value - a[i] - b[i]) <= 1));
  const touching = fixture(t);
  success(cli(touching, { segments: [segment('A', [[0, 0.5], [0.5, 1]])] }));
  assert.deepEqual(summary(touching).overlaps, []);
});

test('one shared gain prevents clipping while retaining stem and mix proportions', t => {
  const base = fixture(t), loud = fixture(t);
  const cue = { label: 'signal', at: 0.1, duration: 0.1 };
  const plan = { segments: [segment('A', [[0, 1]]), segment('B', [[0, 1]])], cues: [cue] };
  success(cli(base, plan));
  plan.segments[0].spans = Array.from({ length: 8 }, () => [0, 1]);
  success(cli(loud, plan));
  const s = summary(loud);
  assert.ok(s.gain > 0 && s.gain < 1);
  assert.equal(s.gain, 0.95 / s.peak_before_gain);
  assert.equal(s.counts.spans, 9);
  const stems = ['speaker-001.wav', 'speaker-002.wav', 'cues.wav'];
  const tracks = stems.map(file => wav(loud, file));
  const mix = wav(loud);
  for (const samples of [...tracks, mix]) assert.ok(peak(samples) <= Math.round(0.95 * 32767));
  assert.ok(peak(mix) >= 31000);
  stems.forEach((file, index) => {
    const original = wav(base, file);
    const multiplier = index === 0 ? 8 : 1;
    tracks[index].forEach((value, i) => {
      assert.ok(Math.abs(value - original[i] * multiplier * s.gain) <= 5);
    });
  });
  mix.forEach((value, i) => {
    assert.ok(Math.abs(value - tracks.reduce((sum, samples) => sum + samples[i], 0)) <= 2);
  });
});

test('invalid schema, nonfinite values and intervals fail before creating output', t => {
  const f = fixture(t);
  const badPlans = ['{', 'null', '[]', { segments: null }, { cues: {} },
    { segments: [null] }, { segments: [segment(3, [])] },
    { segments: [segment(' ', [])] }, { segments: [segment('A', [], false)] },
    { segments: [segment('A', null)] }, { segments: [{ speaker: 'A', spans: [] }] },
    { cues: [null] }, { cues: [{ label: 2, at: 0, duration: 0.1 }] },
    { cues: [{ label: 'x', at: true, duration: 0.1 }] },
    { cues: [{ label: 'x', at: 0.9, duration: 0.2 }] },
    { cues: [{ label: 'x', at: 0, duration: 0 }] },
    { cues: [{ label: 'x', at: 0.5, duration: -0.1 }] },
    { cues: [{ label: 'x', at: 0, duration: '0.1' }] },
    '{"cues":[{"label":"x","at":0,"duration":Infinity}]}'];
  for (const span of [null, [0], [0, 1, 2], ['0', 1], [false, 1], [-0.1, 0.2],
    [0, 1.01], [0.8, 0.2], [0.2, 0.2], [0.1, 0.100001]]) {
    badPlans.push({ segments: [segment('A', [span])] });
  }
  for (const token of ['NaN', 'Infinity', '-Infinity', '1e999']) {
    badPlans.push(`{"segments":[{"speaker":"A","text":"","spans":[[0,${token}]]}]}`);
  }
  for (const plan of badPlans) {
    failure(cli(f, plan));
    assert.equal(existsSync(f.output), false);
  }
  for (const duration of ['0', '-1', 'nan', 'inf', '1e999', 'no', '0.000001']) {
    failure(cli(f, {}, duration));
    assert.equal(existsSync(f.output), false);
  }
});

test('buffered output failure removes owned files and permits retry',
  { skip: process.platform === 'win32' ? 'requires POSIX RLIMIT_FSIZE' : false }, t => {
    const f = fixture(t);
    mkdirSync(f.output, { recursive: true });
    writeFileSync(join(f.output, 'unrelated.txt'), 'keep');
    writeFileSync(f.plan, '{}');
    const result = spawnSync('python3', ['-c', `
import resource, runpy, signal, sys
signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
_, hard = resource.getrlimit(resource.RLIMIT_FSIZE)
resource.setrlimit(resource.RLIMIT_FSIZE, (256, hard))
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name="__main__")
`, script, f.plan, '--duration', '0.001', '--output-dir', f.output], { encoding: 'utf8' });
    failure(result);
    assert.deepEqual(readdirSync(f.output), ['unrelated.txt']);
    assert.equal(readFileSync(join(f.output, 'unrelated.txt'), 'utf8'), 'keep');
    assert.equal(readFileSync(f.plan, 'utf8'), '{}');
    success(cli(f, {}, '0.001'));
    assert.equal(wav(f).length, 16);
    assert.equal(summary(f).frames, 16);
  });

test('output collisions preserve every existing file, including symlink targets', t => {
  const plan = { segments: [segment('A', [[0, 0.5]])],
    cues: [{ label: 'cue', at: 0.7, duration: 0.1 }] };
  for (const filename of ['speaker-001.wav', 'cues.wav', 'mix.wav', 'summary.json']) {
    const f = fixture(t);
    mkdirSync(f.output, { recursive: true });
    writeFileSync(join(f.output, filename), 'keep');
    failure(cli(f, plan));
    assert.deepEqual(readdirSync(f.output), [filename]);
    assert.equal(readFileSync(join(f.output, filename), 'utf8'), 'keep');
  }
  const f = fixture(t);
  mkdirSync(f.output, { recursive: true });
  writeFileSync(join(f.output, 'unrelated.txt'), 'untouched');
  symlinkSync(f.plan, join(f.output, 'mix.wav'));
  failure(cli(f, plan));
  assert.deepEqual(JSON.parse(readFileSync(f.plan, 'utf8')), plan);
  unlinkSync(join(f.output, 'mix.wav'));
  symlinkSync(join(f.root, 'absent'), join(f.output, 'mix.wav'));
  failure(cli(f, plan));
  assert.equal(existsSync(join(f.root, 'absent')), false);
  unlinkSync(join(f.output, 'mix.wav'));
  success(cli(f, plan));
  const before = readFileSync(join(f.output, 'mix.wav'));
  failure(cli(f, plan));
  assert.deepEqual(readFileSync(join(f.output, 'mix.wav')), before);
  assert.equal(readFileSync(join(f.output, 'unrelated.txt'), 'utf8'), 'untouched');
  const blocked = fixture(t);
  mkdirSync(join(blocked.root, 'nested'));
  writeFileSync(blocked.output, 'keep');
  failure(cli(blocked, plan));
  assert.equal(readFileSync(blocked.output, 'utf8'), 'keep');
});
