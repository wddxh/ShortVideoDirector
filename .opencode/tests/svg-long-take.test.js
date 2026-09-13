import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
function run(program, args) {
  const r = spawnSync(program, args, { cwd: root, encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024 });
  assert.ifError(r.error);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test('camera is finite, orthonormal and smooth; fixed lens has depth parallax', () => {
  run('python3', ['-c', `
import runpy, math
s = runpy.run_path('examples/svg-animatic/long-take.py')
camera, dot = s['camera'], s['dot']
for n in range(361):
    t = n/24
    pose = camera(t)
    assert all(math.isfinite(v) for a in pose for v in a)
    for i in range(1,4):
        assert abs(dot(pose[i],pose[i])-1) < 1e-12
        for j in range(i+1,4):
            assert abs(dot(pose[i],pose[j])) < 1e-12
    target = s['add'](s['subject'](t),(0,0.65,0))
    x,y = s['project'](s['view'](target,pose),960,540)
    assert abs(x-480)+abs(y-270) < 1e-9
for t in (0,3,4,9,11,15):
    h = 1e-4
    a,b,c = camera(t-h),camera(t),camera(t+h)
    for i in range(4):
        for j in range(3):
            assert abs((c[i][j]-2*b[i][j]+a[i][j])/(h*h)) < 4
p = s['project']
assert abs((p((1,0,5),960,540)[0]-480) /
           (p((1,0,10),960,540)[0]-480)-2) < 1e-12
`]);
});

test('exported clean/review decode to the same complete 360-frame clock',
  { skip: !process.env.SVG_LONG_TAKE_OUTPUT }, () => {
    for (const name of ['long-take-clean.mp4', 'long-take-review.mp4']) {
      const path = join(process.env.SVG_LONG_TAKE_OUTPUT, name);
      const { streams: [v], frames } = JSON.parse(run('ffprobe', ['-v', 'error',
        '-select_streams', 'v:0', '-show_streams', '-show_frames', '-of', 'json', path]));
      assert.equal(v.width, 960);
      assert.equal(v.r_frame_rate, '24/1');
      assert.equal(Number(v.duration), 15);
      assert.equal(frames.length, 360);
      const [num, den] = v.time_base.split('/').map(Number);
      frames.forEach((f, n) => {
        assert.ok(Math.abs(f.best_effort_timestamp * num / den - n / 24) < 1e-9);
        assert.ok(Math.abs(f.pkt_duration * num / den - 1 / 24) < 1e-9);
      });
      assert.equal(v.height === 540, name.includes('clean'));
      run('ffmpeg', ['-v', 'error', '-xerror', '-i', path, '-f', 'null', '-']);
    }
  });
