import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { settingsText } from './image-project.js';

const scripts = join(process.cwd(), 'scripts');
export function videoProject(t, references = 1, shots = 1) {
  const root = mkdtempSync(join(tmpdir(), 'svd-video-inputs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), file.startsWith('assets/storyboard-sheets/') &&
      !text.includes('## 基本信息') ? settingsText + text : text);
  };
  const cli = (name, args) => spawnSync('node', [join(scripts, name), ...args],
    { cwd: root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: 'config.md' } });
  const ep = 'story/episodes/ep01';
  const card = 'assets/storyboard-sheets/ep01/shot01.md';
  const asset = 'assets/items/lamp.md';
  const sheet = 'assets/images/storyboard-sheets/ep01/shot01.png';
  const image = 'assets/images/items/lamp.png';
  write('config.md', '- mode: short\n- 视频比例: 16:9\n');
  write(`${ep}/script.md`, '## 场景 1\nAction\n## 本集资产清单\n### 新增资产\n- items: lamp (assets/items/lamp.md)\n### 已有资产（本集出场）\n- characters: (无)\n');
  write(`${ep}/storyboard.md`, '### shot 1\n- 时长：10s\n- 引用资产：[lamp](assets/items/lamp.md)\n**画面与声音描述：**\nAction\n');
  write(card, '## 引用资产\n- [lamp](../../items/lamp.md)\n## 连续性参考\n无\n## Panel 规划\n### PANEL 1\nAction\n## 图像生成提示\nLamp');
  for (const file of [asset, sheet, image]) write(file, file);
  const extras = Array.from({ length: references - 1 }, (_, i) => `extra ${i}`);
  const cards = [asset, ...extras.map((name) => `assets/items/${name}.md`)];
  const images = [image, ...extras.map((name) => `assets/images/items/${name}.png`)];
  if (extras.length) {
    for (const file of [...cards, ...images]) write(file, file);
    write(`${ep}/script.md`, `## 场景 1\nAction\n## 本集资产清单\n### 新增资产\n${cards.map((p) =>
      `- items: ${p.slice('assets/items/'.length, -3)} (${p})`).join('\n')}\n### 已有资产（本集出场）\n- characters: (无)\n`);
    write(`${ep}/storyboard.md`, `### shot 1\n- 时长：10s\n- 引用资产：${cards.map((p) =>
      `[${p.slice('assets/items/'.length, -3)}](${p})`).join(' ')}\n**画面与声音描述：**\nAction\n`);
    write(card, `## 引用资产\n${cards.map((p) => `- [${p.slice('assets/items/'.length, -3)}](../../items/${p.slice('assets/items/'.length)})`).join('\n')}\n## 连续性参考\n无\n## Panel 规划\n### PANEL 1\nAction\n## 图像生成提示\nLamp`);
  }
  const sheets = [card];
  const sheetImages = [sheet];
  const board = readFileSync(join(root, `${ep}/storyboard.md`), 'utf8');
  for (let shot = 2; shot <= shots; shot++) {
    const suffix = String(shot).padStart(2, '0');
    const nextCard = card.replace('shot01', `shot${suffix}`);
    const nextImage = sheet.replace('shot01', `shot${suffix}`);
    write(nextCard, readFileSync(join(root, card), 'utf8'));
    write(nextImage, nextImage);
    sheets.push(nextCard); sheetImages.push(nextImage);
  }
  write(`${ep}/storyboard.md`, Array.from({ length: shots }, (_, i) =>
    board.replace('### shot 1', `### shot ${i + 1}`)).join('\n'));
  const evidence = () => {
    const inputs = JSON.parse(cli('review-evidence.mjs', ['fingerprint', 'config.md',
      `${ep}/script.md`, `${ep}/storyboard.md`, ...sheets, ...cards, ...sheetImages, ...images]).stdout);
    for (const [kind, file, target] of [
      ['script', 'script', `${ep}/script.md`],
      ['storyboard', 'storyboard', `${ep}/storyboard.md`],
      ['asset-prompt', 'asset-prompts', asset],
      ['asset-visual', 'basic-assets-visual', asset],
      ['sheet-prompt', 'storyboard-sheet-prompts', card],
      ['sheet-visual', 'storyboard-sheets-visual', card],
    ]) write(`${ep}/.review-${file}.md`, `## 第 1 轮\n<!-- svd-review-evidence -->\n\`\`\`json\n${JSON.stringify({
      version: 1, kind, scope: kind.startsWith('asset-') ? cards : kind.startsWith('sheet-') ? sheets : [target],
      results: (kind.startsWith('asset-') ? cards : kind.startsWith('sheet-') ? sheets : [target]).map((target) =>
        ({ target, status: 'pass', inputs, blockers: [] })),
    })}\n\`\`\`\n<!-- /round-1 -->\n`);
  };
  evidence();
  const converted = cli('storyboard-to-prompt.mjs', [`${ep}/storyboard.md`, '1', 'ep01']);
  if (converted.status !== 0) throw new Error(converted.stderr);
  const task = { shot: 1, submit_id: '', status: 'pending',
    prompt: converted.stdout.split('\n---\n')[1].replace(/\n$/, ''),
    images: [sheet, ...images].join(','), duration: 10, fail_reason: '' };
  const tasks = `${ep}/videos/tasks.json`;
  const save = () => write(tasks, JSON.stringify([task]));
  save();
  return { root, write, cli, task, tasks, save, evidence, sheet, image,
    output: `${ep}/videos/shot01.mp4` };
}
