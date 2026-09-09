#!/usr/bin/env node
import fs from 'node:fs';
import { readTaskPlan, selectTaskGroups, readyPath } from './shot-inputs.mjs';

try {
  const [episode, allowGaps, ...extra] = process.argv.slice(2);
  if (extra.length || !['0', '1'].includes(allowGaps)) throw new Error('Usage: concat-videos.mjs EP 0|1');
  const root = `story/episodes/${episode}`;
  const plan = readTaskPlan(`${root}/storyboard.md`, episode);
  const groups = allowGaps === '1' ? plan.groups : selectTaskGroups(plan);
  const tasks = JSON.parse(fs.readFileSync(`${root}/videos/tasks.json`, 'utf8'));
  if (!Array.isArray(tasks)) throw new Error('Expected tasks array');
  const outputs = [];
  for (const group of groups) {
    const matches = tasks.filter(t => t.task_id === group.task_id);
    if (matches.length > 1) throw new Error(`Duplicate record: ${group.task_id}`);
    const task = matches[0];
    if (task && JSON.stringify(task.shots) !== JSON.stringify(group.shots)) {
      throw new Error(`Membership drift: ${group.task_id}`);
    }
    const output = `${root}/videos/${group.task_id}.mp4`;
    if (!task || task.status !== 'done' || task.inflight || !fs.existsSync(output)) {
      if (allowGaps === '1') { console.error(`Skipped incomplete task: ${group.task_id}`); continue; }
      throw new Error(`Incomplete output coverage: ${group.task_id}`);
    }
    outputs.push(readyPath(output, `${root}/videos/`));
  }
  if (!outputs.length) throw new Error('No completed generation tasks');
  console.log(outputs.join('\n'));
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
