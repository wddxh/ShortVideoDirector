import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const qualification = () => ({ status: 'unknown', blockers: ['Unobserved task motion'],
  visual_exception_qualification: { non_visual: 'pass', external_boundaries: 'pass',
    remaining: 'task_visual_evidence_only', visual_blockers: ['Unobserved task motion'] } });

export function visualException(t, f, result = qualification(), extras = []) {
  const temp = fs.mkdtempSync('/tmp/opencode/visual-exception-test-');
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const target = 'story/episodes/ep01/task-inputs/task01.json';
  const state = path.join(temp, 'state.json'), payload = path.join(temp, 'payload.json');
  const started = f.cli('review-round.mjs', ['start', 'shot-input', 'ep01', target, state, ...extras]);
  assert.equal(started.status, 0, started.stderr);
  fs.writeFileSync(payload, JSON.stringify({ result }));
  const finish = () => f.cli('review-round.mjs', ['finish', state, payload]);
  const source = 'story/decisions/user.md';
  f.write(source, 'User: Accept this task visual evidence as an exception.');
  const request = path.join(temp, 'request.json');
  const data = { decision: 'Accept this task visual evidence as an exception.', source, shots: [1], constraints: [] };
  fs.writeFileSync(request, JSON.stringify(data));
  const record = () => f.cli('shot-input-visual-exception.mjs', ['record', 'ep01', 'task01', request]);
  const check = () => f.cli('shot-input-visual-exception.mjs', ['check', 'ep01', 'task01']);
  return { target, state, payload, finish, source, request, data, record, check };
}
