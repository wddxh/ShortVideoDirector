#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function escapeText(value) {
  return value.replace(/[\\\u0000-\u001f\u007f-\u009f]/gu, (character) => {
    if (character === '\\') return '\\\\';
    if (character === '\n') return '\\n';
    if (character === '\r') return '\\r';
    if (character === '\t') return '\\t';
    return `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`;
  });
}

function fail(message) {
  process.stderr.write(`FAIL ${escapeText(message)}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length !== 2) fail('usage: parser <card> <episode>');

const [card, episode] = args;
const match = /^assets\/storyboard-sheets\/(ep(?:0[1-9]|[1-9]\d+))\/shot(0[1-9]|[1-9]\d+)\.md$/u.exec(card);
if (!match || match[1] !== episode) fail(`noncanonical card: ${card}`);
const shotNumber = Number(match[2]);
if (!Number.isSafeInteger(shotNumber)) fail(`noncanonical card: ${card}`);
if (path.basename(card) !== `shot${String(shotNumber).padStart(2, '0')}.md`) {
  fail(`noncanonical card: ${card}`);
}

let source;
try {
  fs.lstatSync(card);
  const root = fs.realpathSync('.');
  const expected = path.join(root, 'assets', 'storyboard-sheets', episode);
  const realDirectory = fs.realpathSync(path.dirname(card));
  const realCard = fs.realpathSync(card);
  if (realDirectory !== expected || path.dirname(realCard) !== expected) {
    fail(`card path escapes expected episode directory: ${card}`);
  }
  source = fs.readFileSync(realCard);
} catch (error) {
  if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
    fail(`file not found: ${card}`);
  }
  fail(`cannot read card: ${card}`);
}

let text;
try {
  text = new TextDecoder('utf-8', { fatal: true }).decode(source);
} catch {
  fail(`card is not valid UTF-8: ${card}`);
}
if (/\r(?!\n)/u.test(text)) fail(`invalid control byte in prompt or card: ${card}`);
text = text.replace(/\r\n/gu, '\n');

const lines = text.split('\n');
const active = new Array(lines.length).fill(false);
const headings = [];
let fence = null;
let inComment = false;
for (let index = 0; index < lines.length; index++) {
  const line = lines[index];
  if (fence) {
    const closing = new RegExp(`^ {0,3}${fence.marker}{${fence.length},} *$`, 'u');
    if (closing.test(line)) fence = null;
    continue;
  }
  let visible = '';
  let position = 0;
  while (position < line.length) {
    if (inComment) {
      const end = line.indexOf('-->', position);
      if (end < 0) { position = line.length; break; }
      inComment = false;
      position = end + 3;
    } else {
      const start = line.indexOf('<!--', position);
      if (start < 0) { visible += line.slice(position); break; }
      visible += line.slice(position, start);
      inComment = true;
      position = start + 4;
    }
  }
  const opening = /^ {0,3}(`{3,}|~{3,})/u.exec(visible);
  if (opening) {
    fence = { marker: opening[1][0], length: opening[1].length };
    continue;
  }
  active[index] = !inComment && visible === line;
  const heading = /^##(?: ([^\n]+))? *$/u.exec(visible);
  if (active[index] && heading) {
    headings.push({ index, title: heading[1]?.trim() ?? '' });
  }
}

function section(title) {
  const found = headings.filter((heading) => heading.title === title);
  if (found.length !== 1) fail(`section must appear once: ${title}`);
  const start = found[0].index + 1;
  const next = headings.find((heading) => heading.index >= start);
  return { start, end: next?.index ?? lines.length };
}

const assetRange = section('引用资产');
const continuityRange = section('连续性参考');
const promptRange = section('图像生成提示');

function containsUnsafe(value) {
  return /[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function assetFromBullet(line) {
  const bullet = /^- \[([^\]]+)\]\(([^)]*)\)$/u.exec(line);
  if (!bullet) return null;
  const [, name, relative] = bullet;
  if (containsUnsafe(name) || containsUnsafe(relative) || relative.includes(',') ||
      relative.includes('\\') || path.posix.isAbsolute(relative)) {
    fail(`invalid asset link: ${relative}`);
  }
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(card), relative));
  const allowed = /^assets\/(characters|locations|items|buildings)\/(.+)\.md$/u.exec(normalized);
  if (!allowed) fail(`invalid asset link: ${relative}`);
  return {
    name,
    category: allowed[1],
    image: `assets/images/${normalized.slice('assets/'.length, -3)}.png`,
  };
}

const assets = [];
for (let index = assetRange.start; index < assetRange.end; index++) {
  if (!active[index]) continue;
  const asset = assetFromBullet(lines[index]);
  if (asset) assets.push(asset);
}
if (/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text)) {
  fail(`invalid control byte in prompt or card: ${card}`);
}
if (assets.length === 0) fail('no base asset references');

const seen = new Set();
const unique = assets.filter((asset) => {
  if (seen.has(asset.image)) return false;
  seen.add(asset.image);
  return true;
});
const ordered = [
  ...unique.filter((asset) => asset.category === 'characters'),
  ...unique.filter((asset) => asset.category !== 'characters'),
];

const continuityLines = [];
for (let index = continuityRange.start; index < continuityRange.end; index++) {
  if (active[index] && lines[index].trim() !== '') continuityLines.push(lines[index]);
}
const previousPattern = /^- \[(shot(?:0[1-9]|[1-9]\d+))\]\(\.\/(shot(?:0[1-9]|[1-9]\d+))\.md\)$/u;
const previousLines = continuityLines.filter((line) => line.includes(']('));
let previousImage = null;
let inheritance = null;
if (previousLines.length === 0) {
  if (continuityLines.length !== 1 || continuityLines[0] !== '无') {
    fail('continuity without dependency must be 无');
  }
} else {
  if (previousLines.length > 1) fail('multiple previous sheet references');
  const previous = previousPattern.exec(previousLines[0]);
  if (!previous || previous[1] !== previous[2]) {
    fail('continuity must reference adjacent previous sheet');
  }
  if (shotNumber === 1) fail('shot01 cannot reference a previous sheet');
  const previousNumber = shotNumber - 1;
  const expected = `shot${String(previousNumber).padStart(2, '0')}`;
  if (previous[1] !== expected) fail('continuity must reference adjacent previous sheet');
  const inheritanceLines = continuityLines.filter((line) => line.startsWith('- 继承元素：'));
  if (continuityLines.length !== 2 || inheritanceLines.length !== 1) {
    fail('previous sheet requires exactly one inheritance declaration');
  }
  inheritance = inheritanceLines[0].slice('- 继承元素：'.length).trim();
  if (inheritance === '') fail('previous sheet inheritance declaration is empty');
  previousImage = `assets/images/storyboard-sheets/${episode}/${expected}.png`;
}

let firstPrompt = promptRange.start;
let lastPrompt = promptRange.end;
while (firstPrompt < lastPrompt && lines[firstPrompt].trim() === '') firstPrompt++;
while (lastPrompt > firstPrompt && lines[lastPrompt - 1].trim() === '') lastPrompt--;
const prompt = lines.slice(firstPrompt, lastPrompt).join('\n');
if (prompt.trim() === '') fail('prompt section is empty');

const images = ordered.map((asset) => asset.image);
if (previousImage) images.push(previousImage);
const bindings = ordered.map((asset, index) => `[${asset.name}:{图片${index + 1}}]`);
if (previousImage) bindings.push(`[PREVIOUS_SHOT_SHEET:{图片${images.length}}]`);

const output = [`IMAGES:${images.join(',')}`, '---', `**参考资产：** ${bindings.join('、')}`];
if (previousImage) {
  output.push(`**连续性约束：** [PREVIOUS_SHOT_SHEET:{图片${images.length}}] ` +
    `继承元素：${inheritance}；只继承本卡声明元素，不复制前板网格、panel、构图、机位。`);
}
output.push('', prompt);
process.stdout.write(`${output.join('\n')}\n`);
