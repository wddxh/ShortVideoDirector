#!/usr/bin/env node

import fs from 'node:fs';

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

const [storyboard, shotArg, episode] = process.argv.slice(2);
let source;
try { source = fs.readFileSync(storyboard, 'utf8').replaceAll('\r\n', '\n'); }
catch { fail(`file not found: ${storyboard}`); }

const shot = Number(shotArg);
const headings = [...source.matchAll(/^### shot ([1-9]\d*)$/gmu)];
const matches = headings.filter((heading) => Number(heading[1]) === shot);
if (matches.length === 0) fail(`shot ${shot} not found`);
if (matches.length > 1) fail(`duplicate shot ${shot}`);
const selected = matches[0];
const next = headings.find((heading) => heading.index > selected.index);
const block = source.slice(selected.index, next?.index ?? source.length).trimEnd();

const durationMatches = [...block.matchAll(/^- 时长：([1-9]\d*)s$/gmu)];
if (durationMatches.length !== 1) fail(`duration missing or invalid for shot ${shot}`);

const card = `assets/storyboard-sheets/${episode}/shot${String(shot).padStart(2, '0')}.md`;
const sheet = `assets/images/storyboard-sheets/${episode}/shot${String(shot).padStart(2, '0')}.png`;
if (!fs.existsSync(card)) fail(`storyboard sheet card missing: ${card}`);
if (!fs.existsSync(sheet)) fail(`storyboard sheet image missing: ${sheet}`);

const headerEnd = block.search(/^\*\*画面与声音描述：\*\*$/mu);
if (headerEnd < 0) fail(`prose missing for shot ${shot}`);
const header = block.slice(0, headerEnd);
const links = [...header.matchAll(/\[([^\]]+)\]\((assets\/(characters|locations|items|buildings)\/[^)]+\.md)\)/gu)];
const seen = new Set();
const assets = [];
for (const [, name, markdown] of links) {
  const image = `assets/images/${markdown.slice('assets/'.length, -3)}.png`;
  if (seen.has(image)) continue;
  seen.add(image);
  if (!fs.existsSync(image)) fail(`reference image missing: ${image}`);
  assets.push({ name, image });
}

const images = [sheet, ...assets.map(({ image }) => image)];
const bindings = ['[CURRENT_SHOT_STORYBOARD_SHEET:{图片1}]',
  ...assets.map(({ name }, index) => `[${name}:{图片${index + 2}}]`)];
const rules = '将第一张图解释为按 PANEL 编号和时间码排列的 storyboard sheet；按从左到右、从上到下顺序演绎视觉路线；以原始 shot prose 作为动作、对白、音效和精确时序的权威来源；网格、边框、编号、时间码和文字标签不得渲染进最终视频。';
process.stdout.write([
  `IMAGES:${images.join(',')}`,
  `DURATION:${durationMatches[0][1]}`,
  '---',
  `**视频参考图：** ${bindings.join('、')}`,
  `**分镜板解释规则：** ${rules}`,
  '',
  block,
  '',
].join('\n'));
