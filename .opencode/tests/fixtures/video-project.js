import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { reviewPath } from '../../../scripts/review-evidence.mjs';

const scripts = join(process.cwd(), 'scripts');
export function videoProject(t, references = 1, shots = 1) {
  const root = mkdtempSync(join(tmpdir(), 'svd-video-inputs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, text) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };
  const cli = (name, args) => spawnSync('node', [join(scripts, name), ...args],
    { cwd: root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: 'config.md' } });
  const ep = 'story/episodes/ep01';
  const asset = 'assets/items/lamp.md';
  const image = 'assets/images/items/lamp.png';
  write('config.md', '- mode: short\n- 视频比例: 16:9\n');
  write(`${ep}/script.md`, '## 场景 1\nAction\n## 本集资产清单\n### 新增资产\n- items: lamp (assets/items/lamp.md)\n### 已有资产（本集出场）\n- characters: (无)\n');
  write(`${ep}/storyboard.md`, '### shot 1\n- 视频风格：写实\n- 时长：10s\n- 引用资产：[lamp](assets/items/lamp.md)\n**画面与声音描述：**\nAction\n');
  for (const file of [asset, image]) write(file, file);
  const extras = Array.from({ length: references - 1 }, (_, i) => `extra ${i}`);
  const cards = [asset, ...extras.map((name) => `assets/items/${name}.md`)];
  const images = [image, ...extras.map((name) => `assets/images/items/${name}.png`)];
  if (extras.length) {
    for (const file of [...cards, ...images]) write(file, file);
    write(`${ep}/script.md`, `## 场景 1\nAction\n## 本集资产清单\n### 新增资产\n${cards.map((p) =>
      `- items: ${p.slice('assets/items/'.length, -3)} (${p})`).join('\n')}\n### 已有资产（本集出场）\n- characters: (无)\n`);
    write(`${ep}/storyboard.md`, `### shot 1\n- 视频风格：写实\n- 时长：10s\n- 引用资产：${cards.map((p) =>
      `[${p.slice('assets/items/'.length, -3)}](${p})`).join(' ')}\n**画面与声音描述：**\nAction\n`);
  }
  const board = readFileSync(join(root, `${ep}/storyboard.md`), 'utf8');
  write(`${ep}/storyboard.md`, Array.from({ length: shots }, (_, i) =>
    board.replace('### shot 1', `### shot ${i + 1}`)).join('\n'));
  const video = 'references/motion.mp4';
  write(video, 'MP4');
  write('references/scene.blend', 'scene');
  const manifests = Array.from({ length: shots }, (_, i) =>
    `${ep}/task-inputs/task${String(i + 1).padStart(2, '0')}.json`);
  for (const [i, file] of manifests.entries()) write(file, JSON.stringify({ shots: [i + 1], references: [
    { kind: 'local', media: 'video', path: video, use: 'Motion control', sources: ['references/scene.blend'] },
  ] }));
  const evidence = () => {
    const paths = {};
    for (const [kind, targets] of Object.entries({ script: [`${ep}/script.md`],
      storyboard: [`${ep}/storyboard.md`], 'asset-prompt': cards,
      'asset-visual': cards, 'shot-input': manifests })) {
      paths[kind] = targets.map(target => {
        const file = reviewPath(kind, target, 'ep01');
        const required = cli('review-evidence.mjs', ['required', kind, target]);
        if (required.status !== 0) throw new Error(required.stderr);
        const inputs = JSON.parse(cli('review-evidence.mjs', ['fingerprint', ...JSON.parse(required.stdout)]).stdout);
        write(file, `## 第 1 轮\n<!-- svd-review-evidence -->\n\`\`\`json\n${JSON.stringify({
          kind, scope: [target], results: [{ target, status: 'pass', inputs, blockers: [] }],
        })}\n\`\`\`\n<!-- /round-1 -->\n`);
        return file;
      });
    }
    return paths;
  };
  const reviews = evidence();
  const converted = cli('storyboard-to-prompt.mjs', [`${ep}/storyboard.md`, 'task01', 'ep01']);
  if (converted.status !== 0) throw new Error(converted.stderr);
  const { prompt, duration, references: taskReferences } = JSON.parse(converted.stdout);
  const task = { task_id: 'task01', shots: [1], submit_id: '', status: 'pending',
    prompt, duration, references: taskReferences, fail_reason: '' };
  const tasks = `${ep}/videos/tasks.json`;
  const save = () => write(tasks, JSON.stringify([task]));
  save();
  return { root, write, cli, task, tasks, save, evidence, reviews, image, video,
    output: `${ep}/videos/task01.mp4` };
}
