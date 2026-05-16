import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'fs/promises';
import path from 'path';
import { parseAgentFile as parseFrontmatterFile } from './load-agents.js';

// parseSkillFile 与 parseAgentFile 行为一致；alias 出来让代码语义更清晰
export const parseSkillFile = parseFrontmatterFile;

export function rewriteFrontmatter(cc) {
  const result = {
    name: cc.name,
    description: (cc.description || '').slice(0, 1024),
  };
  const metadata = {};
  const PASSTHROUGH_TO_METADATA = ['context', 'agent', 'user-invocable', 'argument-hint', 'model'];
  for (const key of PASSTHROUGH_TO_METADATA) {
    if (cc[key] !== undefined) {
      metadata[`svd-${key}`] = String(cc[key]);
    }
  }
  if (Object.keys(metadata).length > 0) {
    result.metadata = metadata;
  }
  return result;
}
