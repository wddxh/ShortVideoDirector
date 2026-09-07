import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/parse-new-assets.sh');
const MODULE = join(process.cwd(), 'scripts/episode-assets.mjs');

const INVENTORY = `## 本集资产清单
### 新增资产
- characters: 林知意 (assets/characters/林知意.md), 林知意, 沈昭
- locations: 地下室 (assets/locations/地下室.md)
- items: , 旧怀表 (assets/items/旧怀表.md),
- buildings: (无)
### 已有资产（本集出场）
- characters: 张三 (assets/characters/张三.md), 张三, 林知意
- locations: 茶馆
- items:
- buildings: 鼓楼 (assets/buildings/鼓楼.md)
`;
const NEW = ['assets/characters/林知意.md', 'assets/characters/沈昭.md',
  'assets/locations/地下室.md', 'assets/items/旧怀表.md'];
const EXISTING = ['assets/characters/张三.md', 'assets/characters/林知意.md',
  'assets/locations/茶馆.md', 'assets/buildings/鼓楼.md'];

test('parseAssetInventory returns stable deduplicated inventories', async () => {
  const { parseAssetInventory } = await import(MODULE);
  assert.deepEqual(parseAssetInventory(INVENTORY), {
    newAssets: NEW, existingAssets: EXISTING,
  });
});

for (const cli of [false, true]) {
  for (const [mode, paths] of [[undefined, NEW], ['new', NEW],
    ['existing', EXISTING], ['all', [...new Set([...NEW, ...EXISTING])]]]) {
    test(`${cli ? 'node CLI' : 'wrapper'} mode ${mode ?? 'default'}`, () => {
      const r = runScript(INVENTORY, mode, cli);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(r.stdout, paths.join('\n') + '\n');
    });
  }
}

function runScript(content, mode, cli = false) {
  const dir = mkdtempSync(join(tmpdir(), 'parse-new-assets-'));
  const file = join(dir, 'outline.md');
  writeFileSync(file, content);
  try {
    const args = [cli ? MODULE : SCRIPT, file];
    if (mode !== undefined) args.push(mode);
    return spawnSync(cli ? process.execPath : 'bash', args, { encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('inventory and subsection boundaries exclude unrelated entries', async () => {
  const { parseAssetInventory } = await import(MODULE);
  const text = `## 场景 1: 开场
- characters: 不应收录
${INVENTORY}
### 备注
- characters: 不应收录
## 附录
### 新增资产
- characters: 不应收录
`;
  assert.deepEqual(parseAssetInventory(text), { newAssets: NEW, existingAssets: EXISTING });
});

const INVALID = [
  ['missing inventory', '# ep01'],
  ['missing new subsection', '## 本集资产清单\n### 已有资产（本集出场）'],
  ['missing existing subsection', '## 本集资产清单\n### 新增资产'],
  ['bad category', INVENTORY.replace('- items:', '- props:')],
  ['malformed row', INVENTORY.replace('- items:', 'items:')],
  ['category mismatch', INVENTORY.replace('(assets/characters/林知意.md)', '(assets/items/林知意.md)')],
  ['name mismatch', INVENTORY.replace('(assets/characters/林知意.md)', '(assets/characters/别人.md)')],
  ['escaping path', INVENTORY.replace('(assets/characters/林知意.md)', '(../../林知意.md)')],
  ['escaping bare name', INVENTORY.replace('茶馆', '../茶馆')],
  ['unclosed explicit path', INVENTORY.replace('林知意.md)', '林知意.md')],
];

test('empty sentinel and empty categories produce no paths', async () => {
  const text = `## 本集资产清单
### 新增资产
- characters: (无)
- locations:
- items: , ,
- buildings: (无)
### 已有资产（本集出场）
`;
  const { parseAssetInventory } = await import(MODULE);
  assert.deepEqual(parseAssetInventory(text), { newAssets: [], existingAssets: [] });
  for (const cli of [false, true]) {
    const r = runScript(text, 'all', cli);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
  }
});

test('CLIs reject invalid modes, missing arguments and missing files', () => {
  for (const cli of [false, true]) {
    const results = [runScript(INVENTORY, 'invalid', cli)];
    for (const args of [[], ['/nonexistent/svd-script.md']]) {
      results.push(spawnSync(cli ? process.execPath : 'bash',
        [cli ? MODULE : SCRIPT, ...args], { encoding: 'utf8' }));
    }
    for (const r of results) {
      assert.equal(r.status, 1);
      assert.equal(r.stdout, '');
      assert.ok(r.stderr.trim());
    }
  }
});

for (const [name, text] of INVALID) {
  test(`rejects ${name} in API and both CLIs`, async () => {
    for (const cli of [false, true]) {
      const r = runScript(text, undefined, cli);
      assert.equal(r.status, 1, r.stderr);
      assert.equal(r.stdout, '');
      assert.ok(r.stderr.trim());
    }
    const { parseAssetInventory } = await import(MODULE);
    assert.throws(() => parseAssetInventory(text));
  });
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

test('missing inventory exits 1 without paths', () => {
  const content = [
    '# ep01', '', '## 剧情大纲', '内容', '', '## 角色',
  ].join('\n') + '\n';
  const r = runScript(content);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.ok(r.stderr.trim());
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
    '', '### 已有资产（本集出场）',
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
