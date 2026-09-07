import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const script = fileURLToPath(new URL('../../scripts/review-image.py', import.meta.url));
const probe = spawnSync('python3', ['-c', `
try:
    import PIL
    print(PIL.__version__)
except ModuleNotFoundError as error:
    if error.name != 'PIL':
        raise
    raise SystemExit(42)
`], { encoding: 'utf8' });
assert.ifError(probe.error);
assert.ok([0, 42].includes(probe.status), probe.stderr);
const pillow = { skip: probe.status === 42 ? 'Pillow unavailable' : false };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function python(code, ...args) {
  const result = spawnSync('python3', ['-c', code, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'review-image-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, source: join(root, 'source.png'), output: join(root, 'nested', 'previews') };
}
function cli(f, ...args) {
  return spawnSync('python3', [script, f.source, '--output-dir', f.output, ...args],
    { encoding: 'utf8' });
}
function success(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}
function generate(f, size = [3840, 2160], color = 'red') {
  python(`from PIL import Image
import sys
Image.new('RGB', (int(sys.argv[2]), int(sys.argv[3])), sys.argv[4]).save(sys.argv[1])`,
  f.source, ...size.map(String), color);
}
function inspect(path) {
  return JSON.parse(python(`from PIL import Image
import json, sys
with Image.open(sys.argv[1]) as image:
    image.load()
    print(json.dumps([image.format, image.size, image.mode, image.info,
                      image.getpixel((0, 0))]))`, path));
}
function failure(result, message) {
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, message);
  assert.equal(result.stderr.trim().split('\n').length, 1);
}

test('4K preview preserves aspect, fingerprints original, and reuses output safely', pillow, t => {
  const f = fixture(t);
  generate(f);
  const original = readFileSync(f.source);
  const result = success(cli(f));
  assert.deepEqual(Object.keys(result).sort(), ['source', 'source_sha256', 'source_size',
    'preview', 'preview_sha256', 'preview_size', 'crop'].sort());
  assert.equal(result.source, f.source);
  assert.equal(result.source_sha256, hash(original));
  const identity = hash(python(`import json, sys
print(json.dumps([sys.argv[1], None, 1024, '1', sys.argv[2]]), end='')`,
  result.source_sha256, probe.stdout.trim()));
  assert.equal(result.preview, join(f.output, `${result.source_sha256}-${identity}.png`));
  assert.deepEqual(result.source_size, [3840, 2160]);
  assert.deepEqual(result.preview_size, [1024, 576]);
  assert.equal(result.crop, null);
  assert.equal(result.preview_sha256, hash(readFileSync(result.preview)));
  assert.deepEqual(inspect(result.preview).slice(0, 2), ['PNG', [1024, 576]]);
  assert.deepEqual(success(cli(f)), result);
  assert.deepEqual(readFileSync(f.source), original);
});

test('small transparent images are not upscaled and source metadata is stripped', pillow, t => {
  const f = fixture(t);
  python(`from PIL import Image, PngImagePlugin
import sys
image = Image.new('RGBA', (63, 31), (20, 40, 60, 70))
meta = PngImagePlugin.PngInfo()
meta.add_text('private', 'do not copy')
image.save(sys.argv[1], pnginfo=meta, icc_profile=b'private profile', dpi=(300, 300))`, f.source);
  const result = success(cli(f));
  assert.deepEqual(result.preview_size, [63, 31]);
  assert.deepEqual(inspect(result.preview), ['PNG', [63, 31], 'RGBA', {}, [20, 40, 60, 70]]);
});

test('crop coordinates use EXIF-oriented pixels before resizing', pillow, t => {
  const f = fixture(t);
  python(`from PIL import Image
import sys
image = Image.new('RGB', (120, 80), 'red')
image.paste('blue', (60, 0, 120, 80))
exif = Image.Exif()
exif[274] = 6
image.save(sys.argv[1], exif=exif)`, f.source);
  const original = readFileSync(f.source);
  const full = success(cli(f));
  assert.deepEqual(full.source_size, [80, 120]);
  assert.deepEqual(full.preview_size, [80, 120]);
  const result = success(cli(f, '--crop', '0', '60', '80', '60', '--max-edge', '40'));
  assert.deepEqual(result.crop, [0, 60, 80, 60]);
  assert.deepEqual(result.source_size, [80, 120]);
  assert.deepEqual(inspect(result.preview), ['PNG', [40, 30], 'RGB', {}, [0, 0, 255]]);
  assert.deepEqual(readFileSync(f.source), original);
});

test('identity changes with source bytes, crop, and requested size', pillow, t => {
  const f = fixture(t);
  generate(f);
  const full = success(cli(f));
  const capped = success(cli(f, '--max-edge', '1280'));
  assert.deepEqual(capped.preview_size, [1280, 720]);
  const crop = success(cli(f, '--crop', '0', '0', '100', '100'));
  const moved = success(cli(f, '--crop', '1', '0', '100', '100'));
  generate(f, [3840, 2160], 'blue');
  const changed = success(cli(f));
  assert.notEqual(full.source_sha256, changed.source_sha256);
  assert.equal(new Set([full, capped, crop, moved, changed].map(r => r.preview)).size, 5);
  assert.equal(hash(readFileSync(full.preview)), full.preview_sha256);
});

test('invalid crops and size limits fail without stdout', pillow, t => {
  const f = fixture(t);
  generate(f, [100, 50]);
  for (const crop of [[-1, 0, 10, 10], [0, -1, 10, 10], [0, 0, 0, 10],
    [0, 0, 10, -1], [99, 0, 2, 10], [0, 49, 10, 2]]) {
    failure(cli(f, '--crop', ...crop.map(String)), /crop/);
  }
  for (const edge of ['0', '-1', '1281', '1.5']) {
    failure(cli(f, '--max-edge', edge), /--max-edge/);
  }
  failure(cli(f, '--crop', '0', '0'), /--crop/);
  failure(cli(f, '--unknown'), /unrecognized/);
});

test('animated GIF and PNG require explicit extracted frames', pillow, t => {
  const f = fixture(t);
  for (const format of ['GIF', 'PNG']) {
    python(`from PIL import Image
import sys
Image.new('RGB', (20, 20), 'red').save(sys.argv[1], format=sys.argv[2],
    save_all=True, append_images=[Image.new('RGB', (20, 20), 'blue')], duration=100, loop=0)`,
    f.source, format);
    const original = readFileSync(f.source);
    failure(cli(f), /explicit extracted frames\/video preview/);
    assert.deepEqual(readFileSync(f.source), original);
  }
});

test('decodes formats by content and preserves palette transparency', pillow, t => {
  const f = fixture(t);
  python(`from PIL import Image
import sys
Image.new('RGB', (60, 120), 'red').save(sys.argv[1], format='JPEG')`, f.source);
  assert.deepEqual(inspect(success(cli(f)).preview).slice(0, 2), ['PNG', [60, 120]]);
  python(`from PIL import Image
import sys
image = Image.new('P', (12, 24), 0)
image.putpalette([255, 0, 0] + [0, 0, 0] * 255)
image.save(sys.argv[1], transparency=0)`, f.source);
  assert.deepEqual(inspect(success(cli(f)).preview),
    ['PNG', [12, 24], 'RGBA', {}, [255, 0, 0, 0]]);
});

test('missing and undecodable files fail concisely', pillow, t => {
  const f = fixture(t);
  failure(cli(f), /No such file/);
  writeFileSync(f.source, 'not an image');
  failure(cli(f), /cannot decode image/);
  generate(f);
  writeFileSync(f.source, readFileSync(f.source).subarray(0, 100));
  failure(cli(f), /cannot decode image/);
});

test('existing output cannot overwrite the source through a symlink', pillow, t => {
  const f = fixture(t);
  generate(f, [100, 50]);
  const original = readFileSync(f.source);
  const result = success(cli(f));
  rmSync(result.preview);
  symlinkSync(f.source, result.preview);
  failure(cli(f), /must not be the source/);
  assert.deepEqual(readFileSync(f.source), original);
  rmSync(result.preview);
  writeFileSync(result.preview, 'unrelated content');
  failure(cli(f), /refusing to overwrite/);
  assert.equal(readFileSync(result.preview, 'utf8'), 'unrelated content');
});

test('missing Pillow gives an actionable dependency error', t => {
  const f = fixture(t);
  const result = spawnSync('python3', ['-c', `
import runpy, sys
class MissingPillow:
    def find_spec(self, fullname, path=None, target=None):
        if fullname == 'PIL':
            raise ModuleNotFoundError("No module named 'PIL'", name='PIL')
sys.meta_path.insert(0, MissingPillow())
sys.argv = sys.argv[1:]
runpy.run_path(sys.argv[0], run_name='__main__')
`, script, f.source, '--output-dir', f.output], { encoding: 'utf8' });
  failure(result, /Pillow is required; install with: python3 -m pip install Pillow/);
});

test('a file blocking output directory creation is not modified', pillow, t => {
  const f = fixture(t);
  generate(f, [20, 10]);
  f.output = join(f.root, 'blocked');
  writeFileSync(f.output, 'keep');
  failure(cli(f), /File exists/);
  assert.equal(readFileSync(f.output, 'utf8'), 'keep');
});
