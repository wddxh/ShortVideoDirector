#!/usr/bin/env node
// Run from the project root; SVD_CONFIG is inherited unchanged by the renderer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readTaskPlan, selectTaskGroups, resolveTaskInputs } from './shot-inputs.mjs';
import { readLocalReferenceSpec } from './local-reference-spec.mjs';

const usage = 'Usage: episode-previs.mjs EP --parts PARTS.json --output OUTPUT.mp4 [--font FONT]';

try {
  const [ep, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--parts', '--output', '--font'].includes(key) || options[key] ||
        !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(usage);
    options[key] = path.resolve(args[i + 1]);
  }
  if (!ep || !options['--parts'] || !options['--output']) throw new Error(usage);
  const spec = readLocalReferenceSpec(ep);
  const storyboard = `story/episodes/${ep}/storyboard.md`;
  const groups = selectTaskGroups(readTaskPlan(storyboard, ep));
  const parts = JSON.parse(fs.readFileSync(options['--parts'], 'utf8'));
  if (!Array.isArray(parts) || parts.length !== groups.length) {
    throw new Error(`PARTS requires ${groups.length} entries in source order: ${groups.map(g => g.task_id).join(', ')}`);
  }
  let duration = 0;
  const mapping = groups.map((group, index) => {
    try {
      const task = resolveTaskInputs(storyboard, group.task_id, ep);
      const part = parts[index];
      if (!part || Object.keys(part).sort().join(',') !== 'plan,video' ||
          !['video', 'plan'].every(k => typeof part[k] === 'string' && part[k].trim())) {
        throw new Error('expected {video,plan} paths');
      }
      const video = path.resolve(part.video), plan = path.resolve(part.plan);
      if (!group.references.some(r => r.kind === 'local' && r.media === 'video' &&
          path.resolve(r.path) === video)) throw new Error('video is not a declared local video of this task');
      const entry = { part: index + 1, task_id: task.task_id, shots: task.shots,
        video, plan, start: duration, end: duration + task.duration, duration: task.duration,
        timeline: task.timeline.map(s => ({ shot: s.shot, start: s.start + duration,
          end: s.end + duration })) };
      duration = entry.end;
      return entry;
    } catch (error) {
      throw new Error(`part ${index + 1} / ${group.task_id}: ${error.message}`);
    }
  });
  const renderer = fileURLToPath(new URL('./episode-previs.py', import.meta.url));
  const result = spawnSync('python3', [renderer], { encoding: 'utf8',
    input: JSON.stringify({ ep, ...spec, mapping, duration, output: options['--output'],
      font: options['--font'] }), maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || `renderer exited ${result.status}`);
  process.stdout.write(result.stdout);
} catch (error) {
  console.error(`episode-previs: ${error.message}`);
  process.exitCode = 1;
}
