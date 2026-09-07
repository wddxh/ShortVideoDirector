#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const title = '本地制作参考';

function validateDeclaration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['images', 'sources'].includes(key))) {
    throw new Error('Local reference must contain only images and sources');
  }
  for (const key of ['images', 'sources']) {
    const paths = value[key];
    if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length) {
      throw new Error(`Local reference ${key} must be nonempty and unique`);
    }
    for (const file of paths) {
      if (typeof file !== 'string' || !file.startsWith('references/') ||
          /[,\\\u0000-\u001f\u007f-\u009f]/u.test(file) ||
          file.split('/').some(part => ['', '.', '..'].includes(part)) ||
          (key === 'images' && !file.endsWith('.png'))) {
        throw new Error(`Invalid local reference ${key} path: ${JSON.stringify(file)}`);
      }
    }
  }
}

export function assertLocalReferenceReady(localReference, root = '.') {
  if (!localReference) return;
  validateDeclaration({ images: localReference.images, sources: localReference.sources });
  const base = path.join(fs.realpathSync(root), 'references');
  for (const file of [...localReference.images, ...localReference.sources]) {
    const real = fs.realpathSync(path.resolve(root, file));
    const relative = path.relative(base, real);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative) || !fs.statSync(real).isFile()) {
      throw new Error(`Local reference escapes references/ or is not a file: ${file}`);
    }
  }
}

export function parseLocalReference(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let section = false, found = false, fence = null, comment = false;
  const body = [], blocks = [];
  for (const line of lines) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.marker}{${fence.length},} *$`).test(line)) {
        if (section) blocks.push(fence);
        fence = null;
      } else if (section) fence.lines.push(line);
      continue;
    }
    let visible = '', position = 0;
    while (position < line.length) {
      if (comment) {
        const end = line.indexOf('-->', position);
        if (end < 0) break;
        comment = false;
        position = end + 3;
      } else {
        const start = line.indexOf('<!--', position);
        if (start < 0) { visible += line.slice(position); break; }
        visible += line.slice(position, start);
        comment = true;
        position = start + 4;
      }
    }
    if (comment || visible !== line) {
      if (section) body.push(line);
      continue;
    }
    const heading = /^##(?: (.*))? *$/.exec(visible);
    if (heading) {
      section = heading[1]?.trim() === title;
      if (section && found) throw new Error(`Duplicate ${title} section`);
      found ||= section;
      continue;
    }
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(visible);
    if (opening) {
      fence = { marker: opening[1][0], length: opening[1].length,
        language: opening[2].trim(), lines: [] };
    } else if (section) body.push(line);
  }
  if (!found) return null;
  if ((section && fence) || blocks.length !== 1 || blocks[0].language !== 'json') {
    throw new Error(`${title} requires one fenced json block`);
  }
  const value = JSON.parse(blocks[0].lines.join('\n'));
  validateDeclaration(value);
  return { ...value, narrative: body.join('\n').replace(/^\n+|\n+$/g, '') };
}

export function validateAssetLocalReferences(card, images) {
  const localReference = fs.existsSync(card)
    ? parseLocalReference(fs.readFileSync(card, 'utf8')) : null;
  const declared = localReference?.images ?? [];
  const start = images.length - declared.length;
  if (start < 0 || declared.some((file, i) => images[start + i] !== file ||
      images.findIndex(image => path.resolve(image) === path.resolve(file)) !== start + i) ||
      images.some(file => path.resolve(file).startsWith(`${path.resolve('references')}${path.sep}`) &&
        !declared.includes(file))) {
    throw new Error('Local reference images must appear once as the exact ordered suffix');
  }
  assertLocalReferenceReady(localReference);
  return localReference;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, card, refs, ...extra] = process.argv.slice(2);
    if (!card || extra.length || !['parse', 'ready', 'validate-asset'].includes(action) ||
        (action === 'validate-asset' ? refs === undefined : refs !== undefined)) {
      throw new Error('Usage: local-reference.mjs parse|ready CARD | validate-asset CARD CSV');
    }
    const localReference = action === 'validate-asset'
      ? validateAssetLocalReferences(card, refs ? refs.split(',') : [])
      : parseLocalReference(fs.readFileSync(card, 'utf8'));
    if (action === 'ready') assertLocalReferenceReady(localReference);
    console.log(JSON.stringify(localReference));
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
