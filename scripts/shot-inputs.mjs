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
      const text = fs.readFileSync(inputPath, 'utf8');
      let manifest;
      try { manifest = JSON.parse(text); }
      catch (error) {
        const location = error.message.match(/ at position \d+(?: \(line \d+ column \d+\))?$/)?.[0] ?? '';
        throw new Error(`Invalid JSON in ${inputPath}${location}`);
      }
      if (!manifest || Object.keys(manifest).some(key => !['shots', 'references', 'prompt'].includes(key)) ||
          !Array.isArray(manifest.shots) || !manifest.shots.length || !Array.isArray(manifest.references)) {
        throw new Error(`${task_id}: task input requires shots and references, with optional prompt`);
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

export function assembleTask(storyboard, task_id, episode, beforeRead = () => {}) {
  const observed = new Set();
  const observe = file => {
    if (observed.has(file)) return;
    observed.add(file);
    beforeRead(file);
  };
  const inputPath = taskInputPath(episode, task_id);
  observe(storyboard);
  observe(inputPath);
  const manifest = readTaskPlan(storyboard, episode).groups.find(g => g.task_id === task_id);
  if (!manifest) throw new Error(`Missing task manifest: ${inputPath}`);
  const members = manifest.shots.map(shot => ({ shot, ...readStoryboardShot(storyboard, shot) }));
  let duration = 0;
  const timeline = members.map(m => {
    const start = duration;
    duration += m.duration;
    if (!Number.isSafeInteger(duration)) throw new Error('Invalid task duration');
    return { shot: m.shot, start, end: duration };
  });
  const headerRefs = members.flatMap(m => m.headerRefs);
  const references = [], assetCards = [], sources = [];
  const identities = new Set(), localPaths = new Set(), referenceDetails = [];
  const add = (media, file) => {
    observe(file);
    references.push({ media, path: file });
  };
  for (const { name, markdown } of headerRefs) {
    if (identities.has(markdown)) continue;
    observe(markdown);
    readyPath(markdown, 'assets/');
    assetCards.push(markdown);
    const file = markdown.replace('assets/', 'assets/images/').replace(/\.md$/, '.png');
    add('image', file);
    identities.add(markdown);
    referenceDetails.push({ media: 'image', path: file, name, markdown });
  }
  for (const ref of manifest.references) {
    const keys = ['kind', 'media', 'path', 'use', 'sources'];
    if (!ref || Object.keys(ref).some(k => !keys.includes(k)) ||
        typeof ref.use !== 'string' || !ref.use.trim()) throw new Error('Invalid reference declaration/use');
    if (ref.kind === 'local') {
      if (localPaths.has(ref.path)) throw new Error('Duplicate local reference');
      if (/\.gif$/i.test(ref.path)) throw new Error('GIF unsupported: temporal semantics require MP4');
      observe(ref.path);
      readyPath(ref.path, 'references/');
      if (!Array.isArray(ref.sources) || !ref.sources.length) throw new Error('Local sources required');
      for (const source of ref.sources) {
        observe(source);
        sources.push(readyPath(source, 'references/'));
      }
      add(ref.media, ref.path);
      localPaths.add(ref.path);
      referenceDetails.push({ media: ref.media, path: ref.path, use: ref.use });
    } else throw new Error('Unsupported reference kind');
  }
  validateReferences(references);
  const common = { task_id, shots: manifest.shots, timeline, duration,
    references, assetCards, sources: [...new Set(sources)], inputPath };
  return { common, manifest, members, referenceDetails };
}

export function resolveTaskInputs(storyboard, task_id, episode, beforeRead = () => {}) {
  const { common, manifest } = assembleTask(storyboard, task_id, episode, beforeRead);
  if (typeof manifest.prompt !== 'string' || !manifest.prompt.trim()) {
    throw new Error(`${task_id}: final task input requires a nonblank prompt string`);
  }
  return { ...common, prompt: manifest.prompt };
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
