#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseAssetInventory } from './episode-assets.mjs';
import { parseLocalReference, assertLocalReferenceReady } from './local-reference.mjs';
import { resolveTaskInputs, taskInputPath, readyPath } from './shot-inputs.mjs';
import { checkShotInputs } from './check-shot-inputs.mjs';
import { checkVisualException } from './shot-input-visual-exception.mjs';

const kinds = ['script', 'storyboard', 'asset-prompt', 'asset-visual', 'shot-input'];
const imagePath = (card) => card.replace(/^assets\//, 'assets/images/').replace(/\.md$/, '.png');
const relativePath = (value) => typeof value === 'string' && value.length > 0 &&
  !path.posix.isAbsolute(value) && !/[\\\x00-\x1f\x7f-\x9f]/.test(value) &&
  !value.split('/').some((part) => ['', '.', '..'].includes(part));

export function reviewPath(kind, target, episode) {
  if (!kinds.includes(kind)) throw new Error('Unsupported review kind');
  if (!/^ep(?:0[1-9]|[1-9]\d+)$/.test(episode ?? '')) throw new Error('Invalid episode');
  if (!relativePath(target)) throw new Error('Noncanonical review target');
  const ep = `story/episodes/${episode}`;
  const root = `reviews/${episode}`;
  if (['script', 'storyboard'].includes(kind) && target === `${ep}/${kind}.md`) {
    return `${root}/${kind}.md`;
  }
  if (kind.startsWith('asset-') && /^assets\/(characters|locations|items|buildings)\/.+\.md$/.test(target)) {
    return `${root}/${target.slice(0, -3)}.${kind}.md`;
  }
  const task = target.match(/\/task-inputs\/(task(?:0[1-9]|[1-9]\d+))\.json$/)?.[1];
  if (kind === 'shot-input' && task && target === taskInputPath(episode, task)) {
    return `${root}/task-inputs/${task}.md`;
  }
  throw new Error('Noncanonical review target for kind or episode');
}

export function configPath(value = process.env.SVD_CONFIG ?? 'config.md') {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing config path');
  const root = fs.realpathSync(process.cwd());
  let existing = path.resolve(value);
  const missing = [];
  // Check existing ancestors even when the setup file does not exist yet.
  while (!fs.existsSync(existing)) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  const relative = path.relative(root, path.resolve(fs.realpathSync(existing), ...missing));
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('External config is unsupported; select a config inside the project');
  }
  const canonical = relative.split(path.sep).join('/');
  if (!relativePath(canonical)) throw new Error('Expected a project config file');
  return canonical;
}

function readProjectFile(file) {
  if (!relativePath(file)) throw new Error(`Expected project-relative path: ${file}`);
  const real = fs.realpathSync(file);
  const relative = path.relative(fs.realpathSync('.'), real);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`File escapes project: ${file}`);
  }
  return fs.readFileSync(real);
}

export function fingerprintInputs(paths) {
  return [...new Set(paths)].map(file => ({
    path: file, sha256: createHash('sha256').update(readProjectFile(file)).digest('hex'),
  }));
}

export function currentInputs(inputs, required) {
  if (!Array.isArray(inputs) || !inputs.length ||
      !inputs.every((input) => input && relativePath(input.path) && /^[a-f0-9]{64}$/.test(input.sha256)) ||
      new Set(inputs.map((input) => input.path)).size !== inputs.length ||
      !required.every((file) => inputs.some((input) => input.path === file))) return false;
  try {
    return fingerprintInputs(inputs.map((input) => input.path))
      .every((input, index) => input.sha256 === inputs[index].sha256);
  } catch { return false; }
}

export function requiredInputs(kind, target, config, beforeRead = () => {}) {
  if (!kinds.includes(kind)) throw new Error('Unsupported review kind');
  const required = [target, config];
  required.forEach(beforeRead);
  if (kind === 'shot-input') {
    const match = /^story\/episodes\/(ep(?:0[1-9]|[1-9]\d+))\/task-inputs\/(task(?:0[1-9]|[1-9]\d+))\.json$/.exec(target);
    if (!match || target !== taskInputPath(match[1], match[2])) throw new Error('Noncanonical task input target');
    const ep = `story/episodes/${match[1]}`;
    beforeRead(`${ep}/script.md`);
    const resolved = resolveTaskInputs(`${ep}/storyboard.md`, match[2], match[1], beforeRead);
    required.push(`${ep}/script.md`, `${ep}/storyboard.md`, ...resolved.references.map(r => r.path),
      ...resolved.sources);
    for (const card of resolved.assetCards) required.push(...requiredInputs('asset-visual', card, config, beforeRead));
    return [...new Set(required)].map(file => readyPath(file));
  }
  if (kind.endsWith('-visual')) required.push(imagePath(target));
  if (kind === 'storyboard') required.push(`${path.posix.dirname(target)}/script.md`);
  required.slice(2).forEach(beforeRead);
  if (kind.startsWith('asset-')) {
    const localReference = parseLocalReference(readProjectFile(target).toString('utf8'));
    if (localReference) [...localReference.images, ...localReference.sources].forEach(beforeRead);
    assertLocalReferenceReady(localReference);
    if (localReference) required.push(...localReference.images, ...localReference.sources);
  }
  return [...new Set(required)];
}

export function checkTarget(kind, target, episode, config = configPath()) {
  const file = reviewPath(kind, target, episode);
  let latest;
  let missing = false;
  try {
    latest = readRounds(readProjectFile(file).toString('utf8'), kind).at(-1);
  } catch (error) { missing = error.code === 'ENOENT'; }
  let status = 'unknown';
  if (latest?.complete === true && latest.kind === kind &&
      Array.isArray(latest.scope) && latest.scope.length === 1 && latest.scope[0] === target &&
      Array.isArray(latest.results) && latest.results.length === 1) {
    const result = latest.results[0];
    try {
      const required = requiredInputs(kind, target, config);
      if (result?.target === target && ['pass', 'needs_revision', 'unknown'].includes(result.status) &&
          Array.isArray(result.blockers) && result.blockers.every((b) => typeof b === 'string') &&
          !(result.status === 'pass' && result.blockers.length) && currentInputs(result.inputs, required)) {
        status = result.status;
      }
    } catch { /* Unreadable production dependencies leave this target unknown. */ }
  }
  return { target, status, path: file, missing };
}

export function checkCoverage(kind, requiredTargets, episode, config = configPath()) {
  const results = requiredTargets.map(target => checkTarget(kind, target, episode, config));
  const status = results.some((r) => r.status === 'needs_revision') ? 'needs_revision'
    : results.some((r) => r.status !== 'pass') ? 'unknown' : 'pass';
  return { status, results };
}

// This is eligibility for user acceptance, never an independent visual pass.
export function visualExceptionQualified(kind, result) {
  const q = result?.visual_exception_qualification;
  return kind === 'shot-input' && result?.status === 'unknown' && q &&
    Object.keys(q).sort().join(',') === 'external_boundaries,non_visual,remaining,visual_blockers' &&
    q.non_visual === 'pass' && q.external_boundaries === 'pass' &&
    q.remaining === 'task_visual_evidence_only' &&
    Array.isArray(result.blockers) && result.blockers.length > 0 &&
    result.blockers.every(b => typeof b === 'string' && b.trim()) &&
    JSON.stringify(q.visual_blockers) === JSON.stringify(result.blockers);
}

export function effectiveAcceptance(kind, target, episode, config = configPath()) {
  const review = checkTarget(kind, target, episode, config);
  if (review.status === 'pass') return { ...review, accepted: true, acceptance_basis: 'independent_review' };
  const exception = kind === 'shot-input' ? checkVisualException(episode,
    path.posix.basename(target, '.json'), config) : null;
  return { ...review, accepted: exception?.valid === true,
    acceptance_basis: exception?.valid ? 'user_visual_exception' : null,
    ...(exception ? { exception } : {}) };
}

export function readRounds(text, kind) {
  const headings = [...text.matchAll(/^## 第 ([0-9]+) 轮[^\n]*$/gm)];
  if (!headings.length) return [{ complete: false }];
  return headings.map((heading, index) => {
    const body = text.slice(heading.index, headings[index + 1]?.index ?? text.length);
    const marker = '<!-- svd-review-evidence -->';
    const parts = body.split(marker);
    if (parts.length !== 2) return { complete: false };
    const source = parts[1].match(/^\s*```json\s*\n([\s\S]*?)(?:\n```|$)/)?.[1];
    let record;
    try { record = JSON.parse(source); } catch { return { complete: false }; }
    const footer = `<!-- /round-${heading[1]} -->`;
    const complete = record?.kind === kind && parts[1].includes('\n```') &&
      body.split(footer).length === 2 && body.trimEnd().endsWith(footer);
    return { ...record, complete };
  });
}

function preparatoryStatus(episode, config) {
  const text = readProjectFile(config).toString('utf8');
  const headings = [...text.matchAll(/^## (.+)\s*$/gm)];
  const matches = headings.filter((h) => h[1].trim() === `制作前确认 ${episode}`);
  if (!matches.length) return 'not_requested';
  if (matches.length !== 1) return 'unknown';
  const heading = matches[0];
  const body = text.slice(heading.index + heading[0].length,
    headings.find((h) => h.index > heading.index)?.index ?? text.length).trim();
  try {
    const record = JSON.parse(/^```json\s*\n([\s\S]*?)\n```$/.exec(body)?.[1]);
    const allowed = { outline: `story/episodes/${episode}/outline.md`, arc: 'story/arc.md' };
    if (record.episode !== episode || !Array.isArray(record.required) ||
        !record.required.length || !record.required.every((name) => Object.hasOwn(allowed, name))) return 'unknown';
    const required = record.required.map((name) => allowed[name]);
    if (!required.every((file) => readProjectFile(file).toString('utf8').trim().length > 0) ||
        typeof record.approval?.decision !== 'string' || !record.approval.decision.trim() ||
        !currentInputs(record.approval.inputs, required)) return 'unknown';
    return 'ok';
  } catch { return 'unknown'; }
}

function checkEpisode(episode, shots, config) {
  if (!/^ep(?:0[1-9]|[1-9]\d+)$/.test(episode ?? '')) throw new Error('Invalid episode');
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const mode = spawnSync('bash', [path.join(directory, 'detect-mode.sh'), config], { encoding: 'utf8' });
  let blocked = mode.status !== 0;
  console.log(`mode:${blocked ? 'unknown' : mode.stdout.trim()}`);
  const approval = preparatoryStatus(episode, config);
  console.log(`preparatory-review:${approval}`);
  blocked ||= approval === 'unknown';
  const ep = `story/episodes/${episode}`;
  const script = `${ep}/script.md`;
  const storyboard = `${ep}/storyboard.md`;
  const scriptText = readProjectFile(script).toString('utf8');
  if (!/^## 场景/m.test(scriptText)) throw new Error('Incomplete script');
  const inventory = parseAssetInventory(scriptText);
  let assets = [...new Set([...inventory.newAssets, ...inventory.existingAssets])];
  const checked = checkShotInputs(episode, shots);
  blocked ||= checked.issue;
  if (shots.length) assets = [];
  const manifests = [];
  // Scope is derived from the same resolver used by video preparation.
  for (const resolved of checked.resolved) {
    manifests.push(resolved.inputPath);
    for (const card of resolved.assetCards) {
      if (![...inventory.newAssets, ...inventory.existingAssets].includes(card)) {
        throw new Error(`Reference absent from script inventory: ${card}`);
      }
      if (!assets.includes(card)) assets.push(card);
    }
  }
  const targets = { script: [script], storyboard: [storyboard],
    'asset-visual': assets, 'shot-input': manifests };
  for (const [kind, required] of Object.entries(targets)) {
    const coverage = checkCoverage(kind, required, episode, config);
    const status = coverage.status === 'pass' ? 'ok'
      : coverage.results.every(result => result.missing) ? 'missing' : coverage.status;
    console.log(`${kind}-review:${status}`);
    if (kind === 'shot-input') {
      for (const target of required) {
        const acceptance = effectiveAcceptance(kind, target, episode, config);
        if (acceptance.acceptance_basis === 'user_visual_exception') {
          console.log(`shot-input-acceptance:user_visual_exception:${target}:${acceptance.exception.path}`);
        }
        blocked ||= !acceptance.accepted;
      }
    } else blocked ||= coverage.status !== 'pass';
  }
  return blocked ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, ...args] = process.argv.slice(2);
    if (action === 'config-path' && args.length <= 1) {
      console.log(configPath(args[0]));
    } else if (action === 'fingerprint' && args.length) {
      console.log(JSON.stringify(fingerprintInputs(args)));
    } else if (action === 'path' && args.length === 3) {
      console.log(reviewPath(args[0], args[2], args[1]));
    } else if (action === 'check-target' && args.length === 3) {
      const result = checkTarget(args[0], args[2], args[1], configPath());
      console.log(JSON.stringify(result));
      process.exitCode = result.status === 'pass' ? 0 : 1;
    } else if (action === 'required' && args.length === 2 && kinds.includes(args[0])) {
      console.log(JSON.stringify(requiredInputs(args[0], args[1], configPath())));
    } else if (action === 'check' && args.length) {
      process.exitCode = checkEpisode(args[0], args.slice(1), configPath());
    } else throw new Error('Usage: review-evidence.mjs config-path [PATH] | fingerprint PATH... | path KIND EP TARGET | check-target KIND EP TARGET | required KIND TARGET | check EP [SHOT...]');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
