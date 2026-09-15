#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveTaskInputs } from './shot-inputs.mjs';
import { readLocalReferenceSpec } from './local-reference-spec.mjs';
import { configPath } from './review-evidence.mjs';

const usage = 'Usage: local-reference-media-check.mjs EP TASK_ID --video PATH';
const [ep, task_id, flag, file, ...extra] = process.argv.slice(2);
const report = { ep, task_id, config: null, video: null, expected: null, actual: null };
try {
  if (!ep || !task_id || flag !== '--video' || !file || extra.length) throw new Error(usage);
  report.config = configPath();
  const spec = readLocalReferenceSpec(ep, report.config);
  Object.assign(report, spec);
  const task = resolveTaskInputs(`story/episodes/${ep}/storyboard.md`, task_id, ep);
  const video = path.resolve(file);
  report.video = video;
  if (!task.references.some(r => r.media === 'video' && path.resolve(r.path) === video)) {
    throw new Error('--video is not a declared local video of this final task manifest');
  }
  Object.assign(report, { shots: task.shots, inputPath: task.inputPath,
    expected: { ...spec.expected, duration: task.duration } });
  const helper = fileURLToPath(new URL('./local-reference-media-check.py', import.meta.url));
  const result = spawnSync('python3', [helper], { encoding: 'utf8',
    input: JSON.stringify({ expected: spec.expected, video, duration: task.duration }) });
  if (result.error) throw result.error;
  if (!result.stdout.trim()) throw new Error(result.stderr.trim() || `helper exited ${result.status}`);
  Object.assign(report, JSON.parse(result.stdout));
  if (result.status !== 0) throw new Error(report.errors.join('; '));
} catch (error) {
  report.errors = [error.message];
  console.error(`local-reference-media-check: ${ep}/${task_id}: ${error.message}`);
  process.exitCode = 1;
}
console.log(JSON.stringify(report));
