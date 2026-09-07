import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAssetInventory } from '../../scripts/episode-assets.mjs';

test('screenwriter inventory example is a parseable producer fixture', () => {
  const rules = readFileSync(new URL('../../skills/scriptwriter-script/rules.md', import.meta.url), 'utf8');
  const fixture = rules.split('```').find(block => block.trimStart().startsWith('## 本集资产清单\n'));
  assert.ok(fixture, 'missing inventory format example');
  assert.deepEqual(parseAssetInventory(fixture.trim()), {
    newAssets: ['assets/characters/王五.md', 'assets/characters/赵六.md',
      'assets/locations/地下室.md', 'assets/items/旧怀表.md'],
    existingAssets: ['assets/characters/张三.md', 'assets/characters/李四.md',
      'assets/locations/茶馆.md', 'assets/buildings/鼓楼.md'],
  });
});

test('provisional outline inventory cannot substitute for script inventory', () => {
  assert.throws(() => parseAssetInventory([
    '## 本集新增资产', '- items: 旧怀表 (assets/items/旧怀表.md)',
  ].join('\n')), /Missing inventory/);
});

test('adopted script inventory is bounded independently of scenes and notes', () => {
  const script = [
    '## 场景 1: 茶馆', '- 地点: 茶馆 (assets/locations/茶馆.md)',
    '## 本集资产清单', '### 新增资产',
    '- characters: (无)', '- locations: (无)', '- items: (无)', '- buildings: (无)',
    '### 已有资产（本集出场）', '- characters: 张三 (assets/characters/张三.md)',
    '- locations: 茶馆 (assets/locations/茶馆.md)', '- items: (无)', '- buildings: (无)',
    '## 拍摄备注', '- items: 已删道具 (assets/items/已删道具.md)',
  ].join('\n');
  assert.deepEqual(parseAssetInventory(script), {
    newAssets: [],
    existingAssets: ['assets/characters/张三.md', 'assets/locations/茶馆.md'],
  });
});
