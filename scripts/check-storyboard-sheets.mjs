#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [episode, model] = process.argv.slice(2);
const boardPath = `story/episodes/${episode}/storyboard.md`;
const cardDir = `assets/storyboard-sheets/${episode}`;
const imageDir = `assets/images/storyboard-sheets/${episode}`;
let issue = false;

function detail(kind, parts) {
  if (parts.length === 0) return;
  issue = true;
  console.log(`${kind}:invalid:${parts.join(';')}`);
}

function numbers(files, suffix) {
  return files.map((file) => Number(file.slice(4, -suffix.length)));
}

function sequenceProblems(values) {
  const parts = [];
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const duplicate = [...counts].filter(([, count]) => count > 1).map(([value]) => value);
  if (duplicate.length) parts.push(`duplicate=${duplicate.join(',')}`);
  for (let index = 1; index < values.length; index++) {
    if (values[index] < values[index - 1]) {
      parts.push(`out-of-order=${values[index - 1]}>${values[index]}`);
      break;
    }
  }
  const unique = [...counts.keys()].sort((a, b) => a - b);
  if (unique.length) {
    const missing = [];
    for (let value = 1; value <= unique.at(-1); value++) {
      if (!counts.has(value)) missing.push(value);
    }
    if (missing.length) parts.push(`missing=${missing.join(',')}`);
  }
  return parts;
}

let board = '';
try { board = fs.readFileSync(boardPath, 'utf8'); } catch {}
const shotHeadings = [...board.matchAll(/^### shot ([1-9]\d*)$/gmu)];
const shots = shotHeadings.map((match) => Number(match[1]));
const shotDurations = new Map();
for (let index = 0; index < shotHeadings.length; index++) {
  const heading = shotHeadings[index];
  const block = board.slice(heading.index, shotHeadings[index + 1]?.index ?? board.length);
  const duration = /^- 时长：([1-9]\d*)s$/mu.exec(block);
  if (duration) shotDurations.set(Number(heading[1]), Number(duration[1]));
}
const shotProblems = sequenceProblems(shots);
if (shots.length === 0) shotProblems.push('empty');
detail('storyboard', shotProblems);

const allCards = fs.existsSync(cardDir) ? fs.readdirSync(cardDir).filter((file) => file.endsWith('.md')) : [];
const cardFiles = allCards.filter((file) => /^shot(?:0[1-9]|[1-9]\d+)\.md$/u.test(file));
const canonicalCards = cardFiles.filter((file) => {
  const value = Number(file.slice(4, -3));
  return file === `shot${String(value).padStart(2, '0')}.md`;
});
const cardNumbers = numbers(canonicalCards, '.md');
const cardParts = [];
const noncanonical = allCards.filter((file) => !canonicalCards.includes(file));
if (noncanonical.length) cardParts.push(`noncanonical=${noncanonical.join(',')}`);
const shotSet = new Set(shots);
const cardSet = new Set(cardNumbers);
const missingCards = [...shotSet].filter((value) => !cardSet.has(value));
const orphanCards = [...cardSet].filter((value) => !shotSet.has(value));
if (missingCards.length) cardParts.push(`missing=${missingCards.join(',')}`);
if (orphanCards.length) cardParts.push(`orphan=${orphanCards.join(',')}`);
const metadata = [];
for (const file of canonicalCards) {
  const expected = Number(file.slice(4, -3));
  const stem = file.slice(0, -3);
  const text = fs.readFileSync(path.join(cardDir, file), 'utf8');
  const declared = [...text.matchAll(/^- 对应分镜：shot ([1-9]\d*)$/gmu)];
  if (declared.length !== 1 || Number(declared[0][1]) !== expected) {
    metadata.push(`${file}:${declared.length === 1 ? `shot-${declared[0][1]}` : 'missing'}`);
  }
  if (!text.includes(`- 所属集数：${episode}`)) metadata.push(`${file}:episode`);
  if (!text.startsWith(`# ${stem} Storyboard Sheet\n`)) metadata.push(`${file}:title`);
  if (!text.includes('- 类型：分镜板')) metadata.push(`${file}:type`);
  const duration = /^- 时长：([1-9]\d*)s$/mu.exec(text);
  if (!duration) metadata.push(`${file}:duration`);
  else if (shotDurations.has(expected) && Number(duration[1]) !== shotDurations.get(expected)) {
    metadata.push(`${file}:duration-${duration[1]}/${shotDurations.get(expected)}`);
  }
  if (!/^- Panel 数量：[1-9]\d*$/mu.test(text)) metadata.push(`${file}:panel-count`);
}
if (metadata.length) cardParts.push(`metadata=${metadata.join(',')}`);
if (cardParts.length) detail('storyboard-sheets', cardParts);
else console.log('storyboard-sheets:ok');

if (model === 'none') {
  console.log('storyboard-sheet-images:skipped');
  process.exit(issue ? 1 : 0);
}

const allImages = fs.existsSync(imageDir) ? fs.readdirSync(imageDir).filter((file) => file.endsWith('.png')) : [];
const imageFiles = allImages.filter((file) => {
  if (!/^shot(?:0[1-9]|[1-9]\d+)\.png$/u.test(file)) return false;
  const value = Number(file.slice(4, -4));
  return file === `shot${String(value).padStart(2, '0')}.png`;
});
const imageSet = new Set(numbers(imageFiles, '.png'));
const imageParts = [];
const noncanonicalImages = allImages.filter((file) => !imageFiles.includes(file));
if (noncanonicalImages.length) imageParts.push(`noncanonical=${noncanonicalImages.join(',')}`);
const missingImages = [...shotSet].filter((value) => !imageSet.has(value));
const orphanImages = [...imageSet].filter((value) => !shotSet.has(value));
if (missingImages.length) imageParts.push(`missing=${missingImages.join(',')}`);
if (orphanImages.length) imageParts.push(`orphan=${orphanImages.join(',')}`);
if (imageParts.length) detail('storyboard-sheet-images', imageParts);
else console.log('storyboard-sheet-images:ok');

process.exit(issue ? 1 : 0);
