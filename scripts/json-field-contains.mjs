#!/usr/bin/env node

import { readFileSync } from 'node:fs';

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);

if (args[0] === '--escape') {
  if (args.length !== 2) fail('usage: json-field-contains.mjs --escape <string>');
  const escaped = args[1].replace(/[\\\u0000-\u001f\u007f-\u009f]/g, (char) => {
    if (char === '\\') return '\\\\';
    if (char === '\n') return '\\n';
    if (char === '\r') return '\\r';
    if (char === '\t') return '\\t';
    return `\\u${char.codePointAt(0).toString(16).padStart(4, '0')}`;
  });
  process.stdout.write(escaped);
  process.exit(0);
}

if (args.length !== 3) {
  fail('usage: json-field-contains.mjs <json-file> <field-name> <needle>');
}

const [file, field, needle] = args;
let source;
try {
  source = readFileSync(file, 'utf8');
} catch {
  fail('cannot read JSON file');
}

let value;
try {
  value = JSON.parse(source);
} catch {
  fail('invalid JSON');
}

if (!Array.isArray(value) && (value === null || typeof value !== 'object')) {
  fail('JSON root must be an object or array');
}

const records = Array.isArray(value) ? value : [value];
for (const record of records) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) continue;
  if (!Object.hasOwn(record, field) || typeof record[field] !== 'string') continue;
  if (record[field].includes(needle)) process.exit(2);
}

process.exit(0);
