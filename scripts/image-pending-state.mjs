#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

let [command, ...args] = process.argv.slice(2);
const statePath = path.join('assets', 'images', 'pending.json');
let recoveryClaim;

function readState() {
  if (!fs.existsSync(statePath)) return [];
  const value = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (!Array.isArray(value)) throw new Error('pending state must be an array');
  return value;
}

function writeState(value) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const temporary = `${statePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, statePath);
}

async function updateState(update) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const lock = `${statePath}.lock`;
  const deadline = Date.now() + 5000;
  while (true) {
    try { fs.mkdirSync(lock); break; } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() >= deadline) throw new Error('pending state lock timeout; reconcile stale lock');
      await delay(25);
    }
  }
  try { writeState(update(readState())); } finally { fs.rmdirSync(lock); }
}

try {
  if (command === 'recover' && args.length === 2) {
    const [source, output] = args;
    if (!source.trim() || !output.endsWith('.png')) throw new Error('Invalid recovery target');
    const claim = `${output}.claim`;
    fs.mkdirSync(claim);
    recoveryClaim = claim;
    const record = JSON.parse(fs.readFileSync(output.replace(/\.png$/, '.generation.json'), 'utf8'));
    if (record.source_path !== source || record.output_path !== output) {
      throw new Error('Receipt source/output mismatch');
    }
    if (!['received', 'pending', 'unknown'].includes(record.status)) {
      throw new Error('Receipt is not a recoverable known-ID outcome');
    }
    args = [record.submit_id, source, output,
      source.startsWith('assets/storyboard-sheets/') ? 'storyboard-sheet' : 'basic-asset',
      record.provider, record.model, record.ratio, record.resolution];
    command = 'upsert';
  }
  if (command === 'get' && args.length === 1) {
    const entry = readState().find((item) => path.resolve(item.output_path) === path.resolve(args[0]));
    if (!entry) process.exit(1);
    const source = entry.card_path ?? entry.asset_path;
    console.log(`PENDING ${entry.submit_id} ${source} ${entry.output_path}`);
  } else if (command === 'upsert' && args.length === 8) {
    const [submitId, source, outputPath, type, provider, model, ratio, resolution] = args;
    if (args.some((v) => typeof v !== 'string' || !v.trim()) || provider !== 'dreamina' || model === 'none' ||
        resolution === 'none' || !/^[1-9]\d*:[1-9]\d*$/.test(ratio)) throw new Error('Invalid pending settings');
    const entry = { submit_id: submitId };
    entry[type === 'storyboard-sheet' ? 'card_path' : 'asset_path'] = source;
    entry.output_path = outputPath;
    entry.type = type;
    Object.assign(entry, { provider, model, ratio, resolution });
    await updateState(state => {
      if (recoveryClaim) {
        const prior = state.find(item => path.resolve(item.output_path) === path.resolve(outputPath));
        if (prior && (prior.submit_id !== submitId ||
            (prior.card_path ?? prior.asset_path) !== source ||
            ['provider', 'model', 'ratio', 'resolution'].some(key =>
              prior[key] !== undefined && prior[key] !== entry[key]))) {
          throw new Error('Pending identity/settings conflict with receipt');
        }
      }
      return [...state.filter(item => path.resolve(item.output_path) !== path.resolve(outputPath)), entry];
    });
    if (recoveryClaim) console.log(`PENDING ${submitId} ${source} ${outputPath}`);
  } else if (command === 'remove' && [1, 2].includes(args.length)) {
    await updateState(state => state.filter((item) =>
      path.resolve(item.output_path) !== path.resolve(args[0]) ||
      (args.length === 2 && item.submit_id !== args[1])));
  } else {
    console.error('usage: image-pending-state.mjs get OUTPUT | recover SOURCE OUTPUT | upsert ID SOURCE OUTPUT TYPE PROVIDER MODEL RATIO RESOLUTION | remove OUTPUT [ID]');
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
} finally {
  if (recoveryClaim) fs.rmdirSync(recoveryClaim);
}
