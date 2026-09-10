#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { assembleTask } from './shot-inputs.mjs';

export function resolveDreaminaMaterials(storyboard, task_id, episode, beforeRead = () => {}) {
  const { common, members, referenceDetails } = assembleTask(storyboard, task_id, episode, beforeRead);
  const counts = { image: 0, video: 0 }, slots = new Map();
  const referenceSlots = referenceDetails.map(ref => {
    const slot = `{${ref.media === 'image' ? '图片' : '视频'}${++counts[ref.media]}}`;
    slots.set(ref.markdown ?? ref.path, slot);
    return { ...ref, slot };
  });
  const baseline = members[0].style;
  if (members.some(m => m.style !== baseline)) throw new Error('Different video-style baselines; owner reconciliation required');
  let boundBaseline;
  const shotBlocks = members.map((member, i) => {
    const ownRefs = new Set(member.headerRefs.map(r => r.markdown));
    // Bind the full member before extracting style so its links retain member scope.
    const block = member.block.replace(/\[([^\]]+)\]\(((?:assets|references)\/[^)]+)\)/gu, (_, name, file) => {
        if (!ownRefs.has(file)) throw new Error(`Undeclared shot reference: shot ${member.shot}: ${file}`);
        return `[${name}:${slots.get(file)}]`;
      }).replace(/^(- 视频风格：[^\n]+)\n/mu, (_, style) => {
        boundBaseline ??= style;
        return '';
      }).replace(/^([ \t]*)\[(-?\d+(?:\.\d+)?)s-(-?\d+(?:\.\d+)?)s\]/gm,
        (_, indent, from, to) => {
          const start = Number(from), end = Number(to);
          if (!(0 <= start && start < end && end <= member.duration)) {
            throw new Error(`Invalid temporal cue in shot ${member.shot}: ${from}s-${to}s`);
          }
          return `${indent}[${start + common.timeline[i].start}s-${end + common.timeline[i].start}s]`;
        });
    return { shot: member.shot, block };
  });
  return { ...common, materials: { style: boundBaseline, shotBlocks, referenceSlots } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 3 || args.some(arg => arg.startsWith('--'))) {
      throw new Error('Usage: storyboard-materials-dreamina.mjs STORYBOARD TASK_ID EP');
    }
    console.log(JSON.stringify(resolveDreaminaMaterials(...args)));
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
