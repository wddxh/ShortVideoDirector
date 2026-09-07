import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/read-config.sh');

function setupConfig(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-rc-'));
  writeFileSync(join(dir, 'config.md'), content);
  return dir;
}

function run(cwd, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

test('每集时长目标: 3-5 分钟 → 字面返回', () => {
  const dir = setupConfig('- 每集时长目标: 3-5 分钟\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '3-5 分钟');
  } finally { rmSync(dir, { recursive: true }); }
});

test('每集时长目标: 240s → 字面返回', () => {
  const dir = setupConfig('- 每集时长目标: 240s\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '240s');
  } finally { rmSync(dir, { recursive: true }); }
});

test('字段缺失 → 退出码 1', () => {
  const dir = setupConfig('- 总集数: 10\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.notEqual(r.status, 0);
  } finally { rmSync(dir, { recursive: true }); }
});

test('templates do not activate unchosen creative settings', () => {
  for (const mode of ['short', 'series']) {
    const config = join(process.cwd(), `skills/${mode}-video/config-template.md`);
    for (const key of ['视频风格', '每集分镜数', '单镜头时长范围', '每集时长目标']) {
      const result = run(process.cwd(), key, config);
      assert.equal(result.status, 1, `${mode}: ${key}`);
      assert.equal(result.stdout, '');
    }
    const count = run(process.cwd(), '总集数', config);
    assert.equal(count.status, mode === 'short' ? 0 : 1);
    assert.equal(count.stdout.trim(), mode === 'short' ? '1' : '');
  }
});

test('provider, model and output keys remain distinct', () => {
  const values = {
    '图像提供方': 'dreamina', '视频提供方': 'none',
    '图像模型版本': 'image-fixture', '视频模型版本': 'video-fixture',
    '图片比例': '1:1', '图片分辨率': '2k',
  };
  const dir = setupConfig(Object.entries(values).map(([k, v]) => `- ${k}: ${v}`).join('\n'));
  try {
    for (const [key, value] of Object.entries(values)) {
      const result = run(dir, key);
      assert.equal(result.status, 0);
      assert.equal(result.stdout.trim(), value);
    }
    for (const key of ['图像模型', '视频模型', '即梦模型版本', '即梦视频模型版本']) {
      assert.equal(run(dir, key).status, 1);
    }
  } finally { rmSync(dir, { recursive: true }); }
});

test('既有用法不受影响: 总集数: 10 → 10', () => {
  const dir = setupConfig('- 总集数: 10\n');
  try {
    const r = run(dir, '总集数');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '10');
  } finally { rmSync(dir, { recursive: true }); }
});

test('注释行被忽略', () => {
  const dir = setupConfig('# - 每集时长目标: 3-5 分钟  (注释)\n- 每集时长目标: 1-2 分钟\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '1-2 分钟');
  } finally { rmSync(dir, { recursive: true }); }
});

test('inline 注释剥离: 每集时长目标: 90s # 测试用 → 90s', () => {
  const dir = setupConfig('- 每集时长目标: 90s # 测试用\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '90s');
  } finally { rmSync(dir, { recursive: true }); }
});
