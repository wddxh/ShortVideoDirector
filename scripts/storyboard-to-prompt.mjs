#!/usr/bin/env node

import fs from 'node:fs';
import { readStoryboardShot } from './storyboard-shot.mjs';

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exit(1);
}

const [storyboard, shotArg, episode] = process.argv.slice(2);
const shot = Number(shotArg);
let parsed;
try { parsed = readStoryboardShot(storyboard, shot); }
catch (error) { fail(error.message); }
const { block, duration, headerRefs } = parsed;

const card = `assets/storyboard-sheets/${episode}/shot${String(shot).padStart(2, '0')}.md`;
const sheet = `assets/images/storyboard-sheets/${episode}/shot${String(shot).padStart(2, '0')}.png`;
if (!fs.existsSync(card)) fail(`storyboard sheet card missing: ${card}`);
if (!fs.existsSync(sheet)) fail(`storyboard sheet image missing: ${sheet}`);

const assetLink = /\[([^\]]+)\]\((assets\/(?:characters|locations|items|buildings)\/[^)]+\.md)\)/gu;
const slots = new Map();
const assets = [];
for (const { name, markdown } of headerRefs) {
  const image = `assets/images/${markdown.slice('assets/'.length, -3)}.png`;
  if (slots.has(markdown)) continue;
  if (!fs.existsSync(image)) fail(`reference image missing: ${image}`);
  assets.push({ name, image });
  slots.set(markdown, assets.length + 1);
}

const prompt = block.replace(assetLink, (_, name, markdown) => {
  const slot = slots.get(markdown);
  if (!slot) fail(`undeclared reference for shot ${shot}: ${markdown}`);
  return `[${name}:{图片${slot}}]`;
});

const images = [sheet, ...assets.map(({ image }) => image)];
const bindings = ['[CURRENT_SHOT_STORYBOARD_SHEET:{图片1}]',
  ...assets.map(({ name }, index) => `[${name}:{图片${index + 2}}]`)];
const rules = '将第一张图解释为按 PANEL 编号和时间码排列的 storyboard sheet；按从左到右、从上到下顺序演绎视觉路线；以下画面与声音描述是动作、对白、音效和精确时序的权威来源；网格、边框、编号、时间码和文字标签仅用于定位参考格，最终视频呈现格内场景的连续全幅画面。';
process.stdout.write([
  `IMAGES:${images.join(',')}`,
  `DURATION:${duration}`,
  '---',
  `**视频参考图：** ${bindings.join('、')}`,
  `**分镜板解释规则：** ${rules}`,
  '',
  prompt,
  '',
].join('\n'));
