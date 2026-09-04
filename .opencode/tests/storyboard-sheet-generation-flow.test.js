import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SOURCE = join(process.cwd(), 'scripts/generate-storyboard-sheets-dreamina.sh');

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function outputFor(card) {
  return card.replace(/^assets\//, 'assets/images/').replace(/\.md$/, '.png');
}

function card(root, shot, refs = ['assets/images/characters/base.png'], ep = 'ep01') {
  const path = `assets/storyboard-sheets/${ep}/shot${String(shot).padStart(2, '0')}.md`;
  write(root, path, `${refs.join(',')}\n`);
  return path;
}

function dependency(root, path) {
  write(root, path);
}

function installScripts(scripts) {
  mkdirSync(scripts, { recursive: true });
  copyFileSync(SOURCE, join(scripts, 'generate-storyboard-sheets-dreamina.sh'));
  write(scripts, 'storyboard-sheet-to-prompt.sh', `#!/usr/bin/env bash
card=$1
[ -f "$card" ] || { printf 'FAIL converter rejected %s\\n' "$card" >&2; exit 1; }
IFS= read -r images < "$card"
[ "$images" != FAIL ] || { printf 'FAIL converter rejected %s\\n' "$card" >&2; exit 1; }
printf 'IMAGES:%s\\n---\\nprompt for %s\\n' "$images" "$card"
`);
  write(scripts, 'asset-to-image-path.sh', `#!/usr/bin/env bash
for card in "$@"; do
  printf '%s\\n' "$card" | sed 's|^assets/|assets/images/|; s|\\.md$|.png|'
done
`);
  write(scripts, 'image-gen-dreamina.sh', `#!/usr/bin/env bash
prompt=$1 output=$2
printf '%s\\0' "$@" >> "$CALLS"
prior=-
case "$output" in
  */shot02.png) [ -f "\${output%shot02.png}shot01.png" ] && prior=present || prior=missing ;;
esac
printf '%s|%s\\n' "$output" "$prior" >> "$ORDER"
status=success
[ -f "$SCENARIOS/$output" ] && IFS= read -r status < "$SCENARIOS/$output"
case "$status" in
  success) mkdir -p "$(dirname "$output")"; : > "$output"; printf 'OK %s\\n' "$output" ;;
  no-output) printf 'OK %s\\n' "$output" ;;
  fail) printf 'FAIL provider rejected %s\\n' "$output"; exit 1 ;;
  pending:*) printf 'PENDING %s\\n' "\${status#pending:}"; exit 2 ;;
esac
`);
}

function fixture(fn) {
  const workspace = mkdtempSync(join(tmpdir(), 'svd-sheet-generation-'));
  const root = join(workspace, 'story');
  mkdirSync(root);
  const scripts = join(root, 'scripts');
  installScripts(scripts);
  const env = {
    ...process.env,
    CALLS: join(root, 'calls'),
    ORDER: join(root, 'order'),
    SCENARIOS: join(root, 'scenarios'),
  };
  try { fn({ root, env }); } finally { rmSync(workspace, { recursive: true, force: true }); }
}

function run(root, env, cards, resolution = '2k', model = '4.0', script = 'scripts/generate-storyboard-sheets-dreamina.sh') {
  return spawnSync('bash', [
    script, resolution, model, ...cards,
  ], { cwd: root, env, encoding: 'utf8' });
}

function lines(path) {
  return existsSync(path) ? readFileSync(path, 'utf8').trimEnd().split('\n') : [];
}

function calls(path) {
  if (!existsSync(path)) return [];
  const args = readFileSync(path).toString('utf8').split('\0').slice(0, -1);
  return Array.from({ length: args.length / 6 }, (_, i) => args.slice(i * 6, i * 6 + 6));
}

test('generates sheets serially in shot order', () => {
  fixture(({ root, env }) => {
    const one = card(root, 1);
    const two = card(root, 2);
    const three = card(root, 3);
    dependency(root, 'assets/images/characters/base.png');
    const result = run(root, env, [three, one, two]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(lines(env.ORDER), [
      `${outputFor(one)}|-`,
      `${outputFor(two)}|present`,
      `${outputFor(three)}|-`,
    ]);
    assert.equal(result.stdout, 'OK generated 3 skipped 0\n');
  });
});

test('stops after the first provider failure', () => {
  fixture(({ root, env }) => {
    const cards = [card(root, 1), card(root, 2)];
    dependency(root, 'assets/images/characters/base.png');
    write(root, `scenarios/${outputFor(cards[0])}`, 'fail\n');
    const result = run(root, env, cards);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, `FAIL provider rejected ${outputFor(cards[0])}\n`);
    assert.equal(calls(env.CALLS).length, 1);
  });
});

test('stops before provider when a later sheet dependency is missing', () => {
  fixture(({ root, env }) => {
    const base = 'assets/images/characters/base.png';
    const cards = [card(root, 1, [base]), card(root, 2, ['assets/images/items/missing.png']),
      card(root, 3, [base])];
    dependency(root, base);
    const result = run(root, env, cards);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'FAIL missing dependency: assets/images/items/missing.png\n');
    assert.deepEqual(calls(env.CALLS).map(args => args[1]), [outputFor(cards[0])]);
  });
});

test('forwards all references and fixed provider arguments', () => {
  fixture(({ root, env }) => {
    const refs = Array.from({ length: 12 }, (_, i) => `assets/images/items/ref ${i}.png`);
    const path = card(root, 1, refs);
    for (const ref of refs) dependency(root, ref);
    const result = run(root, env, [path], '4k', '5.0');
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(calls(env.CALLS)[0], [
      `prompt for ${path}`, outputFor(path), '16:9', '4k', '5.0', refs.join(','),
    ]);
  });
});

test('fails when a successful provider call does not create output', () => {
  fixture(({ root, env }) => {
    const path = card(root, 1);
    dependency(root, 'assets/images/characters/base.png');
    write(root, `scenarios/${outputFor(path)}`, 'no-output\n');
    const result = run(root, env, [path]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, `FAIL output not created: ${outputFor(path)}\n`);
    assert.equal(calls(env.CALLS).length, 1);
  });
});

test('pending stops exactly and reruns from the first missing output', () => {
  fixture(({ root, env }) => {
    const cards = [card(root, 1), card(root, 2)];
    dependency(root, 'assets/images/characters/base.png');
    const scenario = `scenarios/${outputFor(cards[0])}`;
    write(root, scenario, 'pending:job-17\n');

    let result = run(root, env, cards);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, `PENDING job-17 ${cards[0]} ${outputFor(cards[0])}\n`);
    assert.equal(result.stderr, '');
    assert.equal(calls(env.CALLS).length, 1);

    result = run(root, env, cards);
    assert.equal(result.status, 2);
    assert.equal(calls(env.CALLS).length, 2);

    dependency(root, outputFor(cards[0]));
    result = run(root, env, cards);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(calls(env.CALLS).length, 3);
    assert.equal(calls(env.CALLS)[2][1], outputFor(cards[1]));
    assert.equal(result.stdout, 'OK generated 1 skipped 1\n');
  });
});

test('sorts unsorted inputs, deduplicates cards, and skips existing outputs', () => {
  fixture(({ root, env }) => {
    const one = card(root, 1);
    const two = card(root, 2);
    const three = card(root, 3);
    dependency(root, 'assets/images/characters/base.png');
    dependency(root, outputFor(two));
    const result = run(root, env, [three, one, three, two, one]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(calls(env.CALLS).map(args => args[1]), [outputFor(one), outputFor(three)]);
    assert.equal(result.stdout, 'OK generated 2 skipped 1\n');
  });
});

test('invalid arguments and converter failure never invoke provider', () => {
  fixture(({ root, env }) => {
    let result = spawnSync('bash', ['scripts/generate-storyboard-sheets-dreamina.sh'], {
      cwd: root, env, encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    const invalid = card(root, 1, ['FAIL']);
    result = run(root, env, [invalid]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^FAIL converter rejected /);
    assert.deepEqual(calls(env.CALLS), []);
  });
});

test('rejects a noncanonical shot filename before invoking provider', () => {
  fixture(({ root, env }) => {
    const invalid = 'assets/storyboard-sheets/ep01/shot001.md';
    write(root, invalid, 'assets/images/characters/base.png\n');
    const result = run(root, env, [invalid]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr, `FAIL noncanonical card: ${invalid}\n`);
    assert.deepEqual(calls(env.CALLS), []);
  });
});

test('resolves helper scripts beside coordinator outside the story project', () => {
  fixture(({ root, env }) => {
    const pluginScripts = join(dirname(root), 'plugin', 'scripts');
    installScripts(pluginScripts);
    rmSync(join(root, 'scripts'), { recursive: true });
    const path = card(root, 1);
    dependency(root, 'assets/images/characters/base.png');
    const script = join(pluginScripts, 'generate-storyboard-sheets-dreamina.sh');
    const result = run(root, env, [path], '2k', '4.0', script);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'OK generated 1 skipped 0\n');
  });
});
