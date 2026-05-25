import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/parse-new-assets.sh');

function runScript(content) {
  const dir = mkdtempSync(join(tmpdir(), 'parse-new-assets-'));
  const file = join(dir, 'outline.md');
  writeFileSync(file, content);
  try {
    return spawnSync('bash', [SCRIPT, file], { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('场景1: 4 类齐全多 id → exit 0, 5 行 stdout', () => {
  const content = [
    '# ep01', '', '## 本集资产清单', '', '### 新增资产',
    '- characters: 沈昭, 林九',
    '- locations: 古宅',
    '- items: 玉佩',
    '- buildings: 望江楼',
    '', '### 已有资产（本集出场）', '- characters: 张三',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 5);
  assert.deepEqual(lines, [
    'assets/characters/沈昭.md',
    'assets/characters/林九.md',
    'assets/locations/古宅.md',
    'assets/items/玉佩.md',
    'assets/buildings/望江楼.md',
  ]);
});

test('场景2: 4 类全空 id → exit 0, 空 stdout', () => {
  const content = [
    '# ep01', '', '## 本集资产清单', '', '### 新增资产',
    '- characters:',
    '- locations:',
    '- items:',
    '- buildings:',
    '', '### 已有资产（本集出场）',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '');
});

test('场景3: outline 无『本集资产清单』段 → exit 1, stderr 含 scriptwriter-script', () => {
  const content = [
    '# ep01', '', '## 剧情大纲', '内容', '', '## 角色',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /scriptwriter-script/);
});

test('场景4: 子段乱序（已有资产在前）→ exit 0, 仅含新增段内容', () => {
  const content = [
    '# ep01', '', '## 本集资产清单', '',
    '### 已有资产（本集出场）',
    '- characters: 老张, 老李',
    '- locations: 茶馆',
    '',
    '### 新增资产',
    '- characters: 小赵',
    '- locations: 山洞',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n').sort();
  assert.deepEqual(lines, [
    'assets/characters/小赵.md',
    'assets/locations/山洞.md',
  ]);
  // 不污染：不出现已有资产
  assert.ok(!r.stdout.includes('老张'));
  assert.ok(!r.stdout.includes('茶馆'));
});

test('场景5: 新增空 + 已有非空 → exit 0, 空 stdout', () => {
  const content = [
    '# ep01', '', '## 本集资产清单', '',
    '### 新增资产',
    '- characters:',
    '- locations:',
    '',
    '### 已有资产（本集出场）',
    '- characters: 沈昭, 林九',
    '- locations: 古宅',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), '');
});

test('场景6: id 含 dash + 全角字符 → exit 0, 保留原样', () => {
  const content = [
    '# ep01', '', '## 本集资产清单', '',
    '### 新增资产',
    '- characters: 沈昭-红衣, 林九-受伤',
    '- locations: 古宅-焚毁',
    '- items: 玉佩·裂痕',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.deepEqual(lines, [
    'assets/characters/沈昭-红衣.md',
    'assets/characters/林九-受伤.md',
    'assets/locations/古宅-焚毁.md',
    'assets/items/玉佩·裂痕.md',
  ]);
});
