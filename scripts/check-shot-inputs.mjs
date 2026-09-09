#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolveTaskInputs, readTaskPlan, selectTaskGroups } from './shot-inputs.mjs';

export function checkShotInputs(episode, selected = []) {
  const storyboard = `story/episodes/${episode}/storyboard.md`;
  const groups = selectTaskGroups(readTaskPlan(storyboard, episode), selected);
  let issue = false;
  const resolved = [];
  for (const group of groups) {
    try { resolved.push(resolveTaskInputs(storyboard, group.task_id, episode)); }
    catch (error) {
      console.log(`task-inputs:invalid:${group.task_id}:${error.message}`);
      issue = true;
    }
  }
  if (!issue) console.log('storyboard:ok\ntask-inputs:ok');
  return { issue, resolved };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [episode, ...selected] = process.argv.slice(2);
    process.exitCode = checkShotInputs(episode, selected).issue ? 1 : 0;
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
