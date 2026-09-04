// Asserts the documentation protocol for asset section naming across skills.
// Covers spec §3.3 acceptance B/C/F/G + §3.5 R1/R2.
// If you add/rename skills referencing 本集资产清单 / 本集新增资产 headings,
// update the allowlists / downstream lists below — see `.opencode/README.md`
// § 维护契约.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..');

function read(p) { return readFileSync(join(REPO, p), 'utf-8'); }

function grepHits(pattern, paths) {
  try {
    return execSync(
      `grep -rlE "${pattern}" ${paths.join(' ')} 2>/dev/null || true`,
      { cwd: REPO }
    ).toString().trim().split('\n').filter(Boolean);
  } catch { return []; }
}

test('段名分工 B: ^## 本集新增资产 heading 仅出现在 outline 阶段 skill', () => {
  const allowedOutlineFiles = [
    'director-outline/SKILL.md',
    'director-outline/series.md',
    'director-outline/short.md',
    'director-outline/rules.md',
    'director-review-outline/series.md',
    'director-review-outline/short.md',
    'director-fix-outline/SKILL.md',
    'scriptwriter-script/rules.md',
    'scriptwriter-script/SKILL.md',
  ];
  const hits = grepHits('^## 本集新增资产', ['skills/']);
  for (const h of hits) {
    assert.ok(
      allowedOutlineFiles.some(a => h.endsWith(a)),
      `${h} should not contain ^## 本集新增资产 heading (outline 阶段专用)`
    );
  }
});

test('段名分工 C: ^## 本集资产清单 出现在下游 8 skill / 10 文件', () => {
  const expectedDownstream = [
    'scriptwriter-script/rules.md',
    'scriptwriter-script/SKILL.md',
    'storyboarder-storyboard/SKILL.md',
    'storyboarder-fix-storyboard/SKILL.md',
    'director-review-storyboard/SKILL.md',
    'creator-create-assets/SKILL.md',
    'creator-update-records/SKILL.md',
    'creator-generate-images/SKILL.md',
    'creator-storyboard-sheet-prompts/SKILL.md',
    'edit-story/SKILL.md',
    'edit-story/series.md',
    'edit-story/short.md',
    'director-review-script/SKILL.md',
  ];
  const hits = grepHits('本集资产清单', ['skills/']);
  let downstreamCount = 0;
  for (const exp of expectedDownstream) {
    if (hits.some(h => h.endsWith(exp))) downstreamCount++;
  }
  assert.ok(
    downstreamCount >= 8,
    `下游应至少 8 个文件含「本集资产清单」, actual=${downstreamCount}`
  );
});

test('detect-then-write F: scriptwriter rules.md 含状态 A/B/C', () => {
  const content = read('skills/scriptwriter-script/rules.md');
  assert.match(content, /状态 A.+本集新增资产/, '状态 A: 应描述删除本集新增资产 + append 本集资产清单');
  assert.match(content, /状态 B.+本集资产清单.+in-place/, '状态 B: 应描述 in-place 重写本集资产清单');
  assert.match(content, /状态 C.+Append/, '状态 C: 应描述 Append 本集资产清单');
});

test('R2 文档协议: scriptwriter Phase 5 必须按 ^## 严格分段定界', () => {
  const content = read('skills/scriptwriter-script/rules.md');
  assert.match(content, /\^## [`\s]*严格分段定界|按[ `]*\^## /, 'Phase 5 必须显式声明按 ^## 严格分段, 不破坏用户手工段');
});

test('Hard gate G: director-review-script 含 asset 引用必带路径规则', () => {
  const content = read('skills/director-review-script/SKILL.md');
  assert.match(content, /[Hh]ard gate/, '应含 Hard gate 关键字');
  assert.match(content, /\(assets\/.+\.md\)/, '应含 (assets/.../*.md) 路径示例');
  assert.match(content, /review fail|不带路径.+fail/, '应说明 fail 条件');
});

test('asset id 规则文档化: director-outline/rules.md 含 asset id 定义', () => {
  const content = read('skills/director-outline/rules.md');
  assert.match(content, /asset id = 资产名/, 'asset id 必须 = 资产名');
  assert.match(content, /Shen_Zhao/, '应含 en 下划线正例');
  assert.match(content, /char-shen-zhao|char-沈昭/, '应含 kebab/前缀反例');
  assert.match(content, /skills\/_meta\/rules\/output-language\.md/, '应引用共享语言规则 output-language.md');
});
