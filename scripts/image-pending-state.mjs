#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [command, ...args] = process.argv.slice(2);
const statePath = path.join('assets', 'images', 'pending.json');

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

try {
  if (command === 'get' && args.length === 1) {
    const entry = readState().find((item) => item.output_path === args[0]);
    if (!entry) process.exit(1);
    const source = entry.card_path ?? entry.asset_path;
    console.log(`PENDING ${entry.submit_id} ${source} ${entry.output_path}`);
  } else if (command === 'upsert' && args.length === 4) {
    const [submitId, source, outputPath, type] = args;
    const entry = { submit_id: submitId };
    entry[type === 'storyboard-sheet' ? 'card_path' : 'asset_path'] = source;
    entry.output_path = outputPath;
    entry.type = type;
    const state = readState().filter((item) => item.output_path !== outputPath);
    state.push(entry);
    writeState(state);
  } else if (command === 'remove' && args.length === 1) {
    writeState(readState().filter((item) => item.output_path !== args[0]));
  } else {
    console.error('usage: image-pending-state.mjs get <output> | upsert <id> <source> <output> <type> | remove <output>');
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
