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

export function shotInputPath(episode, shot) {
  if (!/^ep(?:0[1-9]|[1-9]\d+)$/.test(episode) || !Number.isSafeInteger(Number(shot)) ||
      Number(shot) < 1) throw new Error('Invalid episode or shot');
  return `story/episodes/${episode}/shot-inputs/shot${String(Number(shot)).padStart(2, '0')}.json`;
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

export function resolveShotInputs(storyboard, shot, episode) {
  const inputPath = shotInputPath(episode, shot);
  if (storyboard !== `story/episodes/${episode}/storyboard.md`) throw new Error('Noncanonical storyboard');
  readyPath(storyboard, `story/episodes/${episode}/`);
  readyPath(inputPath, `story/episodes/${episode}/shot-inputs/`);
  const manifest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(manifest?.references) ||
      Object.keys(manifest).some(k => k !== 'references')) {
    throw new Error('Shot input must contain only references');
  }
  const { block, duration, headerRefs } = readStoryboardShot(storyboard, shot);
  const references = [], assetCards = [], sources = [];
  const slots = new Map(), bindings = [];
  const counts = { image: 0, video: 0 };
  const add = (media, file) => {
    references.push({ media, path: file });
    return `{${media === 'image' ? '\u56fe\u7247' : '\u89c6\u9891'}${++counts[media]}}`;
  };
  for (const { name, markdown } of headerRefs) {
    if (slots.has(markdown)) continue;
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
      readyPath(ref.path, 'references/');
      if (!Array.isArray(ref.sources) || !ref.sources.length) throw new Error('Local sources required');
      for (const source of ref.sources) sources.push(readyPath(source, 'references/'));
      const slot = add(ref.media, ref.path);
      slots.set(ref.path, slot);
      bindings.push(`[LOCAL_REFERENCE:${slot}] ${ref.use}`);
    } else throw new Error('Unsupported reference kind');
  }
  validateReferences(references);
  const prompt = [...bindings, '', block].join('\n').replace(/\[([^\]]+)\]\(((?:assets|references)\/[^)]+)\)/gu,
    (_, name, file) => {
      if (!slots.has(file)) throw new Error(`Undeclared shot reference: ${file}`);
      return `[${name}:${slots.get(file)}]`;
    });
  return { prompt, duration,
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
