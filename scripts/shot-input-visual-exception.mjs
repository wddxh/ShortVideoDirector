#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { configPath, reviewPath, readRounds, requiredInputs, fingerprintInputs,
  currentInputs, visualExceptionQualified } from './review-evidence.mjs';
import { taskInputPath, resolveTaskInputs, readyPath } from './shot-inputs.mjs';

export function exceptionPath(episode, task_id) {
  taskInputPath(episode, task_id);
  return `story/decisions/${episode}/${task_id}.shot-input-visual-exception.json`;
}

function unaliased(file) {
  if (typeof file !== 'string' || path.isAbsolute(file) || /[\\\x00-\x1f]/.test(file) ||
      file.split('/').some(p => ['', '.', '..'].includes(p))) throw new Error('Noncanonical exception path');
  let current = fs.realpathSync('.');
  for (const part of file.split('/')) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) throw new Error(`Aliased exception path: ${file}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function validRequest(request) {
  if (!request || Object.keys(request).sort().join(',') !== 'constraints,decision,shots,source' ||
      typeof request.decision !== 'string' || !request.decision.trim() ||
      !Array.isArray(request.constraints) || !request.constraints.every(c => typeof c === 'string') ||
      !Array.isArray(request.shots) || !request.shots.length ||
      !request.shots.every(n => Number.isSafeInteger(n) && n > 0) ||
      !request.source?.startsWith('story/decisions/')) throw new Error('Invalid explicit user exception request');
  unaliased(request.source);
}

function basis(episode, task_id, config) {
  const target = taskInputPath(episode, task_id);
  const resolved = resolveTaskInputs(`story/episodes/${episode}/storyboard.md`, task_id, episode);
  const file = reviewPath('shot-input', target, episode);
  const reviewHash = fingerprintInputs([file])[0];
  const text = fs.readFileSync(readyPath(file), 'utf8');
  const latest = readRounds(text, 'shot-input').at(-1);
  const result = latest?.results?.[0];
  if (!latest?.complete || latest.scope?.length !== 1 || latest.scope[0] !== target ||
      latest.results?.length !== 1 || result?.target !== target ||
      !visualExceptionQualified('shot-input', result) ||
      !currentInputs(result.inputs, requiredInputs('shot-input', target, config))) {
    throw new Error('Current independent shot-input qualification required');
  }
  const round = Number([...text.matchAll(/^## 第 ([0-9]+) 轮[^\n]*$/gm)].at(-1)[1]);
  if (fingerprintInputs([file])[0].sha256 !== reviewHash.sha256) throw new Error('Review changed during capture');
  return { target, shots: resolved.shots, review: { ...reviewHash, round }, inputs: result.inputs };
}

function explicitConfig(value) {
  if (typeof value !== 'string' || !value.trim() || value === 'UNRESOLVED') {
    throw new Error('Explicit resolved SVD_CONFIG required');
  }
  const config = configPath(value);
  unaliased(config);
  readyPath(config);
  return config;
}

function capture(episode, task_id, request, config) {
  validRequest(request);
  const b = basis(episode, task_id, config);
  if (JSON.stringify(request.shots) !== JSON.stringify(b.shots)) throw new Error('Complete task membership required');
  const source = fingerprintInputs([readyPath(request.source)])[0];
  if (!fs.readFileSync(request.source, 'utf8').includes(request.decision)) {
    throw new Error('Decision must be quoted verbatim in its user source');
  }
  return { version: 1, type: 'user_visual_exception', actor: 'user',
    root: fs.realpathSync('.'), config_path: config, episode, task_id,
    ...b, decision: request.decision, constraints: request.constraints, source,
    grants_submission: false };
}

export function checkVisualException(episode, task_id, value = process.env.SVD_CONFIG) {
  const file = exceptionPath(episode, task_id);
  try {
    const config = explicitConfig(value);
    unaliased(file);
    const record = JSON.parse(fs.readFileSync(readyPath(file), 'utf8'));
    const current = capture(episode, task_id, { decision: record.decision, shots: record.shots,
      source: record.source?.path, constraints: record.constraints }, config);
    const { recorded_at, ...stored } = record;
    if (typeof recorded_at !== 'string' || !Number.isFinite(Date.parse(recorded_at)) ||
        !isDeepStrictEqual(stored, current)) throw new Error('Exception identity or inputs changed');
    return { valid: true, path: file, acceptance_basis: 'user_visual_exception' };
  } catch (error) { return { valid: false, path: file, reason: error.message }; }
}

export function recordVisualException(episode, task_id, request, value = process.env.SVD_CONFIG) {
  const config = explicitConfig(value), file = exceptionPath(episode, task_id);
  unaliased(file);
  if (fs.existsSync(file)) throw new Error('Exception already exists; no overwrite or automatic renewal');
  const record = capture(episode, task_id, request, config);
  if (request.source === file) throw new Error('Exception cannot be its own decision source');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  unaliased(file);
  if (JSON.stringify(capture(episode, task_id, request, config)) !== JSON.stringify(record)) {
    throw new Error('Inputs changed during exception capture');
  }
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify({ ...record, recorded_at: new Date().toISOString() }, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  return { path: file, acceptance_basis: 'user_visual_exception', grants_submission: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, ep, task, request, ...extra] = process.argv.slice(2);
    let result;
    if (action === 'record' && request && !extra.length) {
      result = recordVisualException(ep, task, JSON.parse(fs.readFileSync(request, 'utf8')));
    } else if (action === 'check' && !request) {
      result = checkVisualException(ep, task);
      if (!result.valid) process.exitCode = 1;
    } else throw new Error('Usage: record EP TASK_ID REQUEST.json | check EP TASK_ID (explicit SVD_CONFIG required)');
    console.log(JSON.stringify(result));
  } catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; }
}
