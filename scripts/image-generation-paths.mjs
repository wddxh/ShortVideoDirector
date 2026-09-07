import path from 'node:path';

export function validateImagePaths(source, output) {
  const relative = value => typeof value === 'string' && value.trim() && !/[\u0000-\u001f\\]/u.test(value)
    ? path.relative(process.cwd(), path.resolve(value)).split(path.sep).join('/') : '';
  const card = relative(source), image = relative(output);
  const categories = '(characters|locations|items|buildings)';
  if (!new RegExp(`^(assets/${categories}/|references/).+\\.md$`).test(card) ||
      !new RegExp(`^(assets/images/${categories}/|references/).+\\.png$`).test(image)) {
    throw new Error('Expected basic asset or references/ exploration source/output paths');
  }
}
