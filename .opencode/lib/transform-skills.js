import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'fs/promises';
import path from 'path';
import { parseAgentFile as parseFrontmatterFile } from './load-agents.js';

// parseSkillFile 与 parseAgentFile 行为一致；alias 出来让代码语义更清晰
export const parseSkillFile = parseFrontmatterFile;
