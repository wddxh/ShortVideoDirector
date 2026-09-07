#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseAssetInventory } from './episode-assets.mjs';
import { parseLocalReference, assertLocalReferenceReady } from './local-reference.mjs';
import { resolveShotInputs, shotInputPath, readyPath } from './shot-inputs.mjs';
import { checkShotInputs } from './check-shot-inputs.mjs';

const files = {
  script: '.review-script.md', storyboard: '.review-storyboard.md',
  'asset-prompt': '.review-asset-prompts.md',
  'asset-visual': '.review-basic-assets-visual.md',
  'shot-input': '.review-shot-inputs.md',
};
const imagePath = (card) => card.replace(/^assets\//, 'assets/images/').replace(/\.md$/, '.png');
const relativePath = (value) => typeof value === 'string' && value.length > 0 &&
  !path.posix.isAbsolute(value) && !value.includes('\\') &&
  !value.split('/').some((part) => ['', '.', '..'].includes(part));

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

export function fingerprintInputs(paths) {
  return [...new Set(paths)].map((file) => {
    if (!relativePath(file)) throw new Error(`Expected project-relative path: ${file}`);
    return { path: file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') };
  });
}

function currentInputs(inputs, required) {
  if (!Array.isArray(inputs) || !inputs.length ||
      !inputs.every((input) => input && relativePath(input.path) && /^[a-f0-9]{64}$/.test(input.sha256)) ||
      new Set(inputs.map((input) => input.path)).size !== inputs.length ||
      !required.every((file) => inputs.some((input) => input.path === file))) return false;
  try {
    return fingerprintInputs(inputs.map((input) => input.path))
      .every((input, index) => input.sha256 === inputs[index].sha256);
  } catch { return false; }
}

export function requiredInputs(kind, target, config) {
  if (!Object.hasOwn(files, kind)) throw new Error('Unsupported review kind');
  const required = [target, config];
  if (kind === 'shot-input') {
    const match = /^story\/episodes\/(ep(?:0[1-9]|[1-9]\d+))\/shot-inputs\/shot(0[1-9]|[1-9]\d+)\.json$/.exec(target);
    if (!match || target !== shotInputPath(match[1], Number(match[2]))) throw new Error('Noncanonical shot input target');
    const ep = `story/episodes/${match[1]}`;
    const resolved = resolveShotInputs(`${ep}/storyboard.md`, Number(match[2]), match[1]);
    required.push(`${ep}/script.md`, `${ep}/storyboard.md`, ...resolved.references.map(r => r.path),
      ...resolved.sources);
    for (const card of resolved.assetCards) required.push(...requiredInputs('asset-visual', card, config));
    return [...new Set(required)].map(file => readyPath(file));
  }
  if (kind.endsWith('-visual')) required.push(imagePath(target));
  if (kind === 'storyboard') required.push(`${path.posix.dirname(target)}/script.md`);
  if (kind.startsWith('asset-')) {
    const localReference = parseLocalReference(fs.readFileSync(target, 'utf8'));
    assertLocalReferenceReady(localReference);
    if (localReference) required.push(...localReference.images, ...localReference.sources);
  }
  return [...new Set(required)];
}

export function checkCoverage(requiredTargets, rounds, config = 'config.md') {
  const results = requiredTargets.map((target) => {
    const latest = [...rounds].reverse().find((round) =>
      !Array.isArray(round.scope) || !round.scope.every(relativePath) || round.scope.includes(target));
    let status = 'unknown';
    if (latest?.complete === true && files[latest.kind] &&
        Array.isArray(latest.scope) && latest.scope.every(relativePath) &&
        new Set(latest.scope).size === latest.scope.length && Array.isArray(latest.results) &&
        latest.results.length === latest.scope.length && latest.scope.every((file) =>
          latest.results.filter((result) => result?.target === file).length === 1)) {
      const result = latest.results.find((result) => result.target === target);
      try {
        const required = requiredInputs(latest.kind, target, config);
        if (result && ['pass', 'needs_revision', 'unknown'].includes(result.status) &&
            Array.isArray(result.blockers) && result.blockers.every((b) => typeof b === 'string') &&
            !(result.status === 'pass' && result.blockers.length) && currentInputs(result.inputs, required)) {
          status = result.status;
        }
      } catch { /* Unreadable production dependencies leave this target unknown. */ }
    }
    return { target, status };
  });
  const status = results.some((r) => r.status === 'needs_revision') ? 'needs_revision'
    : results.some((r) => r.status !== 'pass') ? 'unknown' : 'pass';
  return { status, results };
}

function readRounds(text, kind) {
  const headings = [...text.matchAll(/^## 第 ([0-9]+) 轮[^\n]*$/gm)];
  if (!headings.length) return [{ complete: false }];
  return headings.map((heading, index) => {
    const body = text.slice(heading.index, headings[index + 1]?.index ?? text.length);
    const marker = '<!-- svd-review-evidence -->';
    const parts = body.split(marker);
    if (parts.length !== 2) return { complete: false };
    const source = parts[1].match(/^\s*```json\s*\n([\s\S]*?)(?:\n```|$)/)?.[1];
    let record;
    try { record = JSON.parse(source); } catch {
      // A started scope remains authoritative even if writing results was interrupted.
      try { record = { scope: JSON.parse(source?.match(/"scope"\s*:\s*(\[[^\]]*\])/)?.[1]) }; }
      catch { record = {}; }
      return { scope: record.scope, complete: false };
    }
    const footer = `<!-- /round-${heading[1]} -->`;
    const complete = record?.kind === kind && parts[1].includes('\n```') &&
      body.split(footer).length === 2 && body.trimEnd().endsWith(footer);
    return { ...record, complete };
  });
}

function preparatoryStatus(episode, config) {
  const text = fs.readFileSync(config, 'utf8');
  const headings = [...text.matchAll(/^## (.+)\s*$/gm)];
  const matches = headings.filter((h) => h[1].trim() === `制作前确认 ${episode}`);
  if (!matches.length) return 'not_requested';
  if (matches.length !== 1) return 'unknown';
  const heading = matches[0];
  const body = text.slice(heading.index + heading[0].length,
    headings.find((h) => h.index > heading.index)?.index ?? text.length).trim();
  try {
    const record = JSON.parse(/^```json\s*\n([\s\S]*?)\n```$/.exec(body)?.[1]);
    const allowed = { outline: `story/episodes/${episode}/outline.md`,
      novel: `story/episodes/${episode}/novel.md`, arc: 'story/arc.md' };
    if (record.episode !== episode || !Array.isArray(record.required) ||
        !record.required.length || !record.required.every((name) => Object.hasOwn(allowed, name))) return 'unknown';
    const required = record.required.map((name) => allowed[name]);
    if (!required.every((file) => fs.readFileSync(file, 'utf8').trim().length > 0) ||
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
  const scriptText = fs.readFileSync(script, 'utf8');
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
    const file = `${ep}/${files[kind]}`;
    let rounds = [];
    if (fs.existsSync(file)) rounds = readRounds(fs.readFileSync(file, 'utf8'), kind);
    const coverage = checkCoverage(required, rounds, config);
    const status = coverage.status === 'pass' ? 'ok' : !fs.existsSync(file) ? 'missing' : coverage.status;
    console.log(`${kind}-review:${status}`);
    blocked ||= coverage.status !== 'pass';
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
    } else if (action === 'required' && args.length === 2 && files[args[0]]) {
      console.log(JSON.stringify(requiredInputs(args[0], args[1], configPath())));
    } else if (action === 'check' && args.length) {
      process.exitCode = checkEpisode(args[0], args.slice(1), configPath());
    } else throw new Error('Usage: review-evidence.mjs config-path [PATH] | fingerprint PATH... | required KIND TARGET | check EP [SHOT...]');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
