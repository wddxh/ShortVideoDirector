import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlinkSync } from 'node:fs';
import { parseLocalReference, assertLocalReferenceReady } from '../../scripts/local-reference.mjs';
import { imageProject } from './fixtures/image-project.js';

const declaration = { images: ['references/shot/layout.png', 'references/shot/light.png'],
  sources: ['references/shot/scene.py'] };
const section = (value = declaration) => '## 本地制作参考\nControl placeholder only.\n```json\n' +
  JSON.stringify(value) + '\n```\n';

test('local declaration preserves order and narrative without requiring files', () => {
  assert.equal(parseLocalReference('# Plain card'), null);
  assert.deepEqual(parseLocalReference(section()), { ...declaration, narrative: 'Control placeholder only.' });
  assert.equal(parseLocalReference('```text\n' + section() + '```'), null);
  assert.equal(parseLocalReference('<!--\n' + section() + '-->'), null);
  assert.deepEqual(parseLocalReference('<!-- hidden\n-->\n' + section()),
    { ...declaration, narrative: 'Control placeholder only.' });
  assert.throws(() => parseLocalReference(section() + section()), /Duplicate/);
  assert.throws(() => parseLocalReference(section() + '```json\n{}\n```'), /one fenced/);
  assert.throws(() => parseLocalReference(section().replace('\n```\n', '\n')), /one fenced/);
});

test('rejects malformed schema and noncanonical local paths', () => {
  for (const value of [{ images: [], sources: declaration.sources },
    { images: declaration.images }, { ...declaration, sources: [] },
    { ...declaration, extra: true }, { ...declaration, images: Array(2).fill('references/a.png') }]) {
    assert.throws(() => parseLocalReference(section(value)));
  }
  for (const file of ['/references/a.png', '../references/a.png', 'references/../a.png',
    'references/./a.png', 'references//a.png', 'references/a,b.png', 'references/a\n.png',
    'references/a\u0085.png', 'references/a\\b.png', 'assets/a.png']) {
    for (const key of ['images', 'sources']) {
      assert.throws(() => parseLocalReference(section({ ...declaration, [key]: [file] })), file);
    }
  }
  assert.throws(() => parseLocalReference(section({ ...declaration, images: ['references/a.jpg'] })));
});

test('readiness checks files and realpath containment for PNGs and sources', t => {
  const f = imageProject(t), local = parseLocalReference(section());
  assert.throws(() => assertLocalReferenceReady(local, f.root));
  for (const file of [...local.images, ...local.sources]) f.write(file, 'content');
  assert.doesNotThrow(() => assertLocalReferenceReady(local, f.root));
  f.write('outside/file', 'external');
  f.write('outside/a.png', 'external');
  symlinkSync('../outside', `${f.root}/references/escape`);
  for (const key of ['images', 'sources']) {
    assert.throws(() => assertLocalReferenceReady({ ...local,
      [key]: [`references/escape/${key === 'images' ? 'a.png' : 'file'}`] }, f.root));
  }
  symlinkSync('outside', `${f.root}/linked-project`);
  symlinkSync('../references', `${f.root}/outside/references`);
  assert.throws(() => assertLocalReferenceReady(local, `${f.root}/linked-project`), /escapes/);
});

test('CLI separates declaration parsing from readiness', t => {
  const f = imageProject(t);
  f.write('card.md', section());
  const parsed = f.cli('local-reference.mjs', ['parse', 'card.md']);
  assert.equal(parsed.status, 0, parsed.stderr);
  assert.deepEqual(JSON.parse(parsed.stdout).images, declaration.images);
  assert.equal(f.cli('local-reference.mjs', ['ready', 'card.md']).status, 1);
  for (const file of [...declaration.images, ...declaration.sources]) f.write(file, 'content');
  assert.equal(f.cli('local-reference.mjs', ['ready', 'card.md']).status, 0);
});
