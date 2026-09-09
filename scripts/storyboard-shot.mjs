import fs from 'node:fs';

export function readStoryboardShot(file, number) {
  let source;
  try { source = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'); }
  catch { throw new Error(`file not found: ${file}`); }
  const shot = Number(number);
  const headings = [...source.matchAll(/^### shot ([1-9]\d*)$/gmu)];
  const matches = headings.filter((heading) => Number(heading[1]) === shot);
  if (!matches.length) throw new Error(`shot ${shot} not found`);
  if (matches.length > 1) throw new Error(`duplicate shot ${shot}`);
  const selected = matches[0];
  // Preserve the source verbatim within the canonical structural boundaries.
  const remaining = source.slice(selected.index + selected[0].length + 1);
  const boundary = remaining.search(/^(?:#{1,6}[ \t]+|---[ \t]*$|<!--)/mu);
  const block = `${selected[0]}\n${remaining.slice(0, boundary < 0 ? remaining.length : boundary)}`
    .replace(/\n+$/, '');
  const headerEnd = block.search(/^\*\*画面与声音描述：\*\*$/mu);
  if (headerEnd < 0) throw new Error(`prose missing for shot ${shot}`);
  const header = block.slice(0, headerEnd);
  const styles = [...header.matchAll(/^- 视频风格：([^\n]+)$/gmu)];
  if (styles.length !== 1 || !styles[0][1].trim() ||
      header.split('\n').filter(line => line.startsWith('- 视频风格：')).length !== 1) {
    throw new Error(`video style missing or invalid for shot ${shot}`);
  }
  const durations = [...header.matchAll(/^- 时长：([1-9]\d*)s$/gmu)];
  if (durations.length !== 1 || header.split('\n').filter(line => line.startsWith('- 时长：')).length !== 1) {
    throw new Error(`duration missing or invalid for shot ${shot}`);
  }
  const declarations = [...header.matchAll(/^- (?:出场人物|引用资产)：[^\n]*(?:\n(?!- )[^\n]*)*/gmu)]
    .map(([field]) => field).join('\n');
  const headerRefs = [...declarations.matchAll(/\[([^\]]+)\]\((assets\/(?:characters|locations|items|buildings)\/[^)]+\.md)\)/gu)]
    .map(([, name, markdown]) => ({ name, markdown }));
  const duration = Number(durations[0][1]);
  if (!Number.isSafeInteger(duration)) throw new Error(`invalid duration for shot ${shot}`);
  return { block, duration, headerRefs, style: styles[0][0] };
}
