#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { configPath, reviewPath, requiredInputs, fingerprintInputs, readRounds,
  visualExceptionQualified } from './review-evidence.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => file.startsWith(`${root}${path.sep}`);
const heading = round => `## \u7b2c ${round} \u8f6e\n`;
const marker = '<!-- svd-review-evidence -->';
const block = record => `${marker}\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n`;

// Writes never follow symlinks, including missing paths with symlink ancestors.
function writePath(file, root) {
  const absolute = path.resolve(file);
  if (!inside(root, absolute)) throw new Error(`Write outside allowed root: ${file}`);
  let current = absolute;
  while (current !== path.dirname(current)) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink > 1)) {
        throw new Error(`Aliased write path: ${file}`);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    current = path.dirname(current);
  }
  return absolute;
}

function temporary(file) {
  if (!path.isAbsolute(file)) throw new Error('STATE and payload require absolute temp paths');
  const absolute = writePath(file, '/tmp/opencode');
  if (path.dirname(absolute) === '/tmp/opencode' || inside(fs.realpathSync('.'), absolute)) {
    throw new Error('Use a task-scoped temp directory outside the project');
  }
  return absolute;
}

function atomic(file, bytes, root) {
  writePath(file, root);
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, file);
  } finally { fs.rmSync(temp, { force: true }); }
}

function locked(file, operation) {
  const root = fs.realpathSync('.');
  writePath(file, root);
  const lock = writePath(`${file}.lock`, root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let fd;
  try { fd = fs.openSync(lock, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(
      `Review lock exists (active or interrupted owner); check the owner PID and reconcile manually before removing: ${lock}`);
    throw error;
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    return operation();
  }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function issue(state, message) {
  if (!state.evidence_issues.includes(message)) state.evidence_issues.push(message);
}

function capture(state, file) {
  if (path.resolve(file) === path.resolve(state.path)) throw new Error('Review cannot be its own input');
  if (fs.existsSync(file) && fs.existsSync(state.path)) {
    const source = fs.statSync(file), review = fs.statSync(state.path);
    if (source.dev === review.dev && source.ino === review.ino) throw new Error('Review aliases an input');
  }
  const first = state.inputs.find(input => input.path === file);
  const attempted = state.attempted.includes(file);
  if (!attempted) state.attempted.push(file);
  try {
    const input = fingerprintInputs([file])[0];
    if (!attempted) state.inputs.push(input);
    else if (first && first.sha256 !== input.sha256) issue(state, `Input changed: ${file}`);
  } catch (error) { issue(state, `Cannot capture ${file}: ${error.message}`); }
}

function discover(state, beforeRead) {
  try { return requiredInputs(state.kind, state.target, state.config, beforeRead); }
  catch (error) {
    issue(state, `Dependency discovery failed: ${error.message}`);
    return [];
  }
}

function summary(state, statePath, status) {
  return { path: state.path, round: state.round, state: statePath,
    ...(status ? { status } : {}), input_count: state.inputs.length,
    paths: state.inputs.map(input => input.path), evidence_issues: state.evidence_issues };
}

export function startRound(kind, episode, target, statePath, extras = []) {
  statePath = temporary(statePath);
  const file = reviewPath(kind, target, episode);
  if (!process.env.SVD_CONFIG?.trim()) throw new Error('Explicit SVD_CONFIG is required for start');
  const config = configPath(process.env.SVD_CONFIG);
  return locked(file, () => {
    if (fs.existsSync(statePath)) throw new Error('STATE already exists');
    const prefix = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
    const rounds = [...prefix.toString('utf8').matchAll(/^## \u7b2c ([0-9]+) \u8f6e[^\n]*$/gm)];
    const round = Math.max(0, ...rounds.map(match => Number(match[1]))) + 1;
    if (!Number.isSafeInteger(round)) throw new Error('Round number out of range');
    const state = { root: fs.realpathSync('.'), kind, episode, target, config, path: file,
      round, prefix_length: prefix.length, inputs: [], attempted: [], evidence_issues: [] };
    const seen = new Set();
    const beforeRead = file => {
      if (!seen.has(file)) { seen.add(file); capture(state, file); }
    };
    [target, config, ...extras].forEach(beforeRead);
    discover(state, beforeRead).forEach(beforeRead);
    const opened = Buffer.from(`${prefix.length ? '\n\n' : ''}${heading(round)}${block({
      kind, scope: [target], results: [],
    })}`);
    const bytes = Buffer.concat([prefix, opened]);
    const parsed = readRounds(opened.toString('utf8'), kind);
    if (parsed.length !== 1 || parsed[0].complete || parsed[0].results?.length !== 0) {
      throw new Error('Invalid unfinished round');
    }
    state.expected = digest(bytes);
    const current = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
    if (!current.equals(prefix)) throw new Error('Review changed while starting round');
    // State is created first: a failed publish cannot leave an untracked open round.
    fs.writeFileSync(statePath, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
    atomic(file, bytes, state.root);
    return summary(state, statePath);
  });
}

function loadState(statePath) {
  statePath = temporary(statePath);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  // Keep the started path binding; current bytes and containment are evidence checks.
  if (state.root !== fs.realpathSync('.') ||
      state.path !== reviewPath(state.kind, state.target, state.episode) ||
      typeof state.config !== 'string' || !state.config.length || path.posix.isAbsolute(state.config) ||
      /[\\\x00-\x1f\x7f-\x9f]/.test(state.config) ||
      state.config.split('/').some(part => ['', '.', '..'].includes(part))) {
    throw new Error('STATE project or path binding mismatch');
  }
  writePath(state.path, state.root);
  return { state, statePath };
}

function currentRound(state) {
  const bytes = fs.readFileSync(state.path);
  if (digest(bytes) !== state.expected) throw new Error('Stale STATE: review round changed or already finished');
  return bytes;
}

export function addInput(statePath, paths) {
  if (!Array.isArray(paths) || !paths.length) throw new Error('Expected input paths');
  const loaded = loadState(statePath);
  return locked(loaded.state.path, () => {
    const { state } = loadState(loaded.statePath);
    currentRound(state);
    [...new Set(paths)].forEach(file => capture(state, file));
    atomic(loaded.statePath, JSON.stringify(state), '/tmp/opencode');
    return summary(state, loaded.statePath);
  });
}

function payloadFrom(file, statePath, kind) {
  file = temporary(file);
  if (file === statePath) throw new Error('Payload cannot alias STATE');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const result = payload?.result;
  if (!payload || Array.isArray(payload) || Object.keys(payload).some(k => !['commentary', 'result'].includes(k)) ||
      (payload.commentary !== undefined && typeof payload.commentary !== 'string') ||
      !result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid payload object');
  const owned = ['target', 'inputs', 'kind', 'scope', 'results', 'complete', 'round', 'path', 'state',
    'root', 'episode', 'config', 'expected', 'prefix_length', 'attempted', 'evidence_issues',
    'input_count', 'paths', 'sha256'];
  if (Object.keys(result).some(key => owned.includes(key))) throw new Error('Payload contains helper-owned fields');
  if (!['pass', 'needs_revision', 'unknown'].includes(result.status) ||
      !Array.isArray(result.blockers) || !result.blockers.every(b => typeof b === 'string') ||
      (result.status === 'pass' && result.blockers.length)) throw new Error('Explicit status and valid blockers are required');
  if (/## \u7b2c [0-9]+ \u8f6e|<!--\s*\/?(?:svd-review-evidence|round-)/u.test(JSON.stringify(payload))) {
    throw new Error('Reserved review delimiter in payload');
  }
  if (Object.hasOwn(result, 'visual_exception_qualification') && !visualExceptionQualified(kind, result)) {
    throw new Error('Invalid shot-input visual exception qualification');
  }
  return payload;
}

export function finishRound(statePath, payloadPath) {
  const loaded = loadState(statePath);
  return locked(loaded.state.path, () => {
    const { state } = loadState(loaded.statePath);
    const bytes = currentRound(state);
    const payload = payloadFrom(payloadPath, loaded.statePath, state.kind);
    const checked = new Set();
    const verify = file => {
      if (checked.has(file)) return;
      checked.add(file);
      if (!state.inputs.some(input => input.path === file)) {
        issue(state, `Required input was not captured: ${file}`);
        return;
      }
      capture(state, file);
    };
    state.inputs.forEach(input => verify(input.path));
    discover(state, verify).forEach(verify);
    const result = { ...payload.result, target: state.target, inputs: state.inputs };
    if (state.evidence_issues.length) {
      delete result.visual_exception_qualification;
      result.status = 'unknown';
      result.blockers = [...new Set([...result.blockers, ...state.evidence_issues])];
    }
    const record = { kind: state.kind, scope: [state.target], results: [result] };
    const notice = result.status !== payload.result.status
      ? `### Final status (helper)\nEffective status: ${result.status}. Submitted status: ${payload.result.status}. ` +
        'Evidence issues override the submitted status; see blockers below.\n\n'
      : '';
    const completed = `${state.prefix_length ? '\n\n' : ''}${heading(state.round)}` +
      `${notice}${payload.commentary ? `${payload.commentary}\n\n` : ''}${block(record)}<!-- /round-${state.round} -->\n`;
    const parsed = readRounds(completed, state.kind);
    if (parsed.length !== 1 || !parsed[0].complete ||
        JSON.stringify(parsed[0].results) !== JSON.stringify(record.results)) throw new Error('Invalid completed round');
    currentRound(state);
    atomic(state.path, Buffer.concat([bytes.subarray(0, state.prefix_length), Buffer.from(completed)]), state.root);
    return summary(state, loaded.statePath, result.status);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, ...args] = process.argv.slice(2);
    let result;
    if (action === 'start' && args.length >= 4) result = startRound(...args.slice(0, 4), args.slice(4));
    else if (action === 'add-input' && args.length >= 2) result = addInput(args[0], args.slice(1));
    else if (action === 'finish' && args.length === 2) result = finishRound(...args);
    else throw new Error('Usage: review-round.mjs start KIND EP TARGET STATE [EXTRA_INPUT...] | add-input STATE PATH... | finish STATE PAYLOAD.json');
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
