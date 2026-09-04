import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/json-string-field.sh');

function parse(field, input) {
  return spawnSync('bash', [SCRIPT, field], { input, encoding: 'utf8' });
}

test('extracts a string field with JSON whitespace', () => {
  const result = parse('submit_id', '{ "submit_id" : "job-123" }');

  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'job-123');
});

test('decodes escaped quotes and backslashes', () => {
  const result = parse(
    'fail_reason',
    String.raw`{"fail_reason":"provider rejected \"11 references\" at C:\\tmp"}`,
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout, String.raw`provider rejected "11 references" at C:\tmp`);
});

test('returns failure without output when the field is absent', () => {
  const result = parse('submit_id', '{"gen_status":"fail"}');

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
});
