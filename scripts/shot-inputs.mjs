import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readStoryboardShot } from './storyboard-shot.mjs';

export function readyPath(file, prefix = '') {
  if (typeof file !== 'string' || !file.startsWith(prefix) ||
      /[\\\u0000-\u001f\u007f-\u009f]/u.test(file) ||
      path.posix.isAbsolute(file) || file.split('/').some(p => ['', '.', '..'].includes(p))) {
    throw new Error(`Noncanonical input path: ${file}`);
  }
  const base = path.join(fs.realpathSync('.'), prefix);
  const real = fs.realpathSync(file);
  const relative = path.relative(base, real);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative) || !fs.statSync(real).isFile() || !fs.statSync(real).size) {
    throw new Error(`Input escapes ${prefix || 'project'} or is empty/not a file: ${file}`);
  }
  return file;
}

export function taskInputPath(episode, task_id) {
  if (!/^ep(?:0[1-9]|[1-9]\d+)$/.test(episode) ||
      !/^task(?:0[1-9]|[1-9]\d+)$/.test(task_id)) throw new Error('Invalid episode or task_id');
  return `story/episodes/${episode}/task-inputs/${task_id}.json`;
}

export function validateReferences(references) {
  if (!Array.isArray(references)) throw new Error('Expected typed references array');
  for (const ref of references) {
    if (/\.gif$/i.test(ref?.path)) throw new Error('GIF unsupported: temporal semantics require MP4');
    if (!ref || !['image', 'video'].includes(ref.media) ||
        typeof ref.path !== 'string' || !ref.path.endsWith(ref.media === 'image' ? '.png' : '.mp4')) {
      throw new Error('References require image/PNG or video/MP4');
    }
    if (!ref.path.startsWith('references/') &&
        !(ref.media === 'image' && /^assets\/images\/(characters|locations|items|buildings)\//.test(ref.path))) {
      throw new Error('References must use references/ or basic asset image paths');
    }
    readyPath(ref.path, ref.path.startsWith('references/') ? 'references/' : 'assets/images/');
  }
  if (!references.some(ref => ref.media === 'video')) throw new Error('At least one local MP4 is required');
  return references;
}

export function readTaskPlan(storyboard, episode) {
  taskInputPath(episode, 'task01');
  if (storyboard !== `story/episodes/${episode}/storyboard.md`) throw new Error('Noncanonical storyboard');
  readyPath(storyboard, `story/episodes/${episode}/`);
  const shots = [...fs.readFileSync(storyboard, 'utf8').replaceAll('\r\n', '\n').matchAll(/^### shot ([1-9]\d*)$/gm)]
    .map(m => Number(m[1]));
  if (!shots.length || shots.some((n, i) => !Number.isSafeInteger(n) || (i > 0 && n <= shots[i - 1]))) {
    throw new Error('Storyboard shots must be unique and increasing');
  }
  const directory = `story/episodes/${episode}/task-inputs`;
  const assigned = new Set();
  const groups = (fs.existsSync(directory) ? fs.readdirSync(directory) : [])
    .filter(file => file.endsWith('.json')).map(file => {
      const task_id = file.slice(0, -5), inputPath = taskInputPath(episode, task_id);
      readyPath(inputPath, `${directory}/`);
      const manifest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      if (!manifest || Object.keys(manifest).length !== 2 ||
          !Array.isArray(manifest.shots) || !manifest.shots.length || !Array.isArray(manifest.references)) {
        throw new Error(`${task_id}: task input requires only shots and references`);
      }
      return { task_id, ...manifest, inputPath };
    });
  // Validate declarations globally without opening unselected media.
  for (const group of groups) {
    let previous = -1;
    for (const shot of group.shots) {
      const index = shots.indexOf(shot);
      if (!Number.isSafeInteger(shot) || shot < 1 || index < 0) {
        throw new Error(`${group.task_id}: missing source member ${shot}`);
      }
      if (previous >= 0 && index !== previous + 1) throw new Error(`${group.task_id}: nonconsecutive members`);
      if (assigned.has(shot)) throw new Error(`Overlapping task member ${shot}`);
      assigned.add(shot);
      previous = index;
    }
  }
  return { shots, groups: groups.sort((a, b) => a.shots[0] - b.shots[0]) };
}

export function selectTaskGroups(plan, selected = []) {
  if (selected.some(n => !/^[1-9]\d*$/.test(String(n)))) throw new Error('Select existing source shots');
  const requested = selected.length ? [...new Set(selected.map(Number))] : plan.shots;
  if (requested.some(n => !Number.isSafeInteger(n) || !plan.shots.includes(n))) {
    throw new Error('Select existing source shots');
  }
  if (!selected.length && plan.shots.some((n, i) => n !== i + 1)) {
    throw new Error('Whole episode source numbering must be contiguous from 1');
  }
  const groups = plan.groups.filter(g => g.shots.some(n => requested.includes(n)));
  const missing = requested.filter(n => !groups.some(g => g.shots.includes(n)));
  if (missing.length) throw new Error(`Unassigned requested shots: ${missing.join(',')}`);
  for (const group of groups) {
    const additional = group.shots.filter(n => !requested.includes(n));
    if (additional.length) throw new Error(`Partial group ${group.task_id}; additional members required: ${additional.join(',')}`);
  }
  return groups;
}

export function resolveTaskInputs(storyboard, task_id, episode, beforeRead = () => {}) {
  const inputPath = taskInputPath(episode, task_id);
  beforeRead(storyboard);
  beforeRead(inputPath);
  const manifest = readTaskPlan(storyboard, episode).groups.find(g => g.task_id === task_id);
  if (!manifest) throw new Error(`Missing task manifest: ${inputPath}`);
  const members = manifest.shots.map(shot => ({ shot, ...readStoryboardShot(storyboard, shot) }));
  const baseline = members[0].style;
  if (members.some(m => m.style !== baseline)) throw new Error('Different video-style baselines; owner reconciliation required');
  let duration = 0;
  const timeline = members.map(m => {
    const start = duration;
    duration += m.duration;
    if (!Number.isSafeInteger(duration)) throw new Error('Invalid task duration');
    return { shot: m.shot, start, end: duration };
  });
  const headerRefs = members.flatMap(m => m.headerRefs);
  const references = [], assetCards = [], sources = [];
  const slots = new Map(), bindings = [];
  const counts = { image: 0, video: 0 };
  const add = (media, file) => {
    beforeRead(file);
    references.push({ media, path: file });
    return `{${media === 'image' ? '\u56fe\u7247' : '\u89c6\u9891'}${++counts[media]}}`;
  };
  for (const { name, markdown } of headerRefs) {
    if (slots.has(markdown)) continue;
    beforeRead(markdown);
    readyPath(markdown, 'assets/');
    assetCards.push(markdown);
    const slot = add('image', markdown.replace('assets/', 'assets/images/').replace(/\.md$/, '.png'));
    slots.set(markdown, slot);
    bindings.push(`[${name}:${slot}] identity reference`);
  }
  for (const ref of manifest.references) {
    const keys = ['kind', 'media', 'path', 'use', 'sources'];
    if (!ref || Object.keys(ref).some(k => !keys.includes(k)) ||
        typeof ref.use !== 'string' || !ref.use.trim()) throw new Error('Invalid reference declaration/use');
    if (ref.kind === 'local') {
      if (slots.has(ref.path)) throw new Error('Duplicate local reference');
      if (/\.gif$/i.test(ref.path)) throw new Error('GIF unsupported: temporal semantics require MP4');
      beforeRead(ref.path);
      readyPath(ref.path, 'references/');
      if (!Array.isArray(ref.sources) || !ref.sources.length) throw new Error('Local sources required');
      for (const source of ref.sources) {
        beforeRead(source);
        sources.push(readyPath(source, 'references/'));
      }
      const slot = add(ref.media, ref.path);
      slots.set(ref.path, slot);
      bindings.push(`[LOCAL_REFERENCE:${slot}] ${ref.use}`);
    } else throw new Error('Unsupported reference kind');
  }
  validateReferences(references);
  let boundBaseline;
  const blocks = members.map((member, i) => {
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
          return `${indent}[${start + timeline[i].start}s-${end + timeline[i].start}s]`;
        });
    return `Task interval for shot ${member.shot}: ${timeline[i].start}s-${timeline[i].end}s\n${block}`;
  });
  const prompt = [boundBaseline, ...bindings, '',
    'Leading bracketed cues use task time. Inline elapsed times remain local to the named shot.',
    ...blocks].join('\n');
  return { task_id, shots: manifest.shots, timeline, prompt, duration,
    references, assetCards, sources: [...new Set(sources)], inputPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, value, ...extra] = process.argv.slice(2);
    if (action !== 'flags' || extra.length || value === undefined) throw new Error('Usage: shot-inputs.mjs flags JSON');
    const refs = validateReferences(JSON.parse(value));
    process.stdout.write(refs.flatMap(ref => [`--${ref.media}`, ref.path]).join('\n'));
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
