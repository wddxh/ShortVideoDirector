#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolveShotInputs, shotInputPath } from './shot-inputs.mjs';
import { readStoryboardShot } from './storyboard-shot.mjs';

export function checkShotInputs(episode, selected = []) {
  shotInputPath(episode, 1);
  const storyboard = `story/episodes/${episode}/storyboard.md`;
  const board = fs.readFileSync(storyboard, 'utf8');
  const shots = [...board.matchAll(/^### shot ([1-9]\d*)$/gm)].map(m => Number(m[1]));
  if (selected.some(shot => !/^[1-9]\d*$/.test(shot) || !shots.includes(Number(shot)))) {
    throw new Error('Usage: check-shot-inputs.mjs EP [SHOT...]; select existing shots');
  }
  let issue = false;
  const resolved = [];
  if (!shots.length || shots.some((shot, i) => selected.length
    ? i > 0 && shot <= shots[i - 1] : shot !== i + 1)) {
    console.log('storyboard:invalid:shots must be unique and increasing; whole episode must be contiguous from 1');
    issue = true;
  }
  for (const shot of selected.length ? [...new Set(selected.map(Number))] : shots) {
    try { readStoryboardShot(storyboard, shot); }
    catch (error) {
      console.log(`storyboard:incomplete:shot${shot}:${error.message}`);
      issue = true;
      continue;
    }
    try { resolved.push(resolveShotInputs(storyboard, shot, episode)); }
    catch (error) {
      console.log(`shot-inputs:invalid:shot${shot}:${error.message}`);
      issue = true;
    }
  }
  if (!issue) console.log('storyboard:ok\nshot-inputs:ok');
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
