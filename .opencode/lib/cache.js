import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { transformAllSkills } from './transform-skills.js';
import { loadAllAgents } from './load-agents.js';

const CACHE_BASE = path.join(os.homedir(), '.cache', 'short-video-director');

async function readPluginVersion(pluginRoot) {
  const pkg = JSON.parse(await fs.readFile(path.join(pluginRoot, 'package.json'), 'utf-8'));
  return pkg.version;
}

export async function computeSourceHash(pluginRoot) {
  const sources = [];
  for (const subdir of ['skills', 'agents', 'scripts']) {
    const root = path.join(pluginRoot, subdir);
    try {
      await fs.access(root);
    } catch {
      continue;
    }
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (subdir === 'scripts' || e.name.endsWith('.md')) {
          const st = await fs.stat(p);
          sources.push(`${p}:${st.mtimeMs}:${st.size}`);
        }
      }
    };
    await walk(root);
  }
  sources.push(`plugin-version:${await readPluginVersion(pluginRoot)}`);
  return crypto
    .createHash('sha256')
    .update(sources.sort().join('\n'))
    .digest('hex')
    .slice(0, 16);
}

async function copyDirRecursive(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDirRecursive(sp, dp);
    } else if (e.isFile()) {
      await fs.copyFile(sp, dp);
    }
  }
}

async function copyScripts(pluginRoot, cacheDir) {
  const src = path.join(pluginRoot, 'scripts');
  try {
    await fs.access(src);
  } catch {
    return;
  }
  await copyDirRecursive(src, path.join(cacheDir, 'scripts'));
}

/**
 * 复制 skills/_*\/ 共享资源目录（如 _meta/）到 cache。
 * transformAllSkills 因每个目录被当作 skill 处理 + 缺少 SKILL.md 而 silently 跳过，
 * 这里负责递归把 `_` 前缀目录原样搬运过去。
 */
async function copySharedSkillResources(pluginRoot, cacheSkillsDir) {
  const skillsRoot = path.join(pluginRoot, 'skills');
  try {
    await fs.access(skillsRoot);
  } catch {
    return;
  }
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!e.name.startsWith('_')) continue;
    await copyDirRecursive(
      path.join(skillsRoot, e.name),
      path.join(cacheSkillsDir, e.name)
    );
  }
}

export async function loadAndTransform(pluginRoot) {
  const hash = await computeSourceHash(pluginRoot);
  const cacheDir = path.join(CACHE_BASE, hash);
  const cacheSkillsDir = path.join(cacheDir, 'skills');
  const agentsCachePath = path.join(cacheDir, 'agents.json');

  let agents;
  try {
    agents = JSON.parse(await fs.readFile(agentsCachePath, 'utf-8'));
    await fs.access(cacheSkillsDir);
  } catch {
    await fs.mkdir(cacheDir, { recursive: true });
    agents = await loadAllAgents(pluginRoot);
    await transformAllSkills(pluginRoot, cacheSkillsDir);
    await copySharedSkillResources(pluginRoot, cacheSkillsDir);
    await copyScripts(pluginRoot, cacheDir);
    await fs.writeFile(agentsCachePath, JSON.stringify(agents, null, 2));
    await pruneOldCaches(CACHE_BASE, 3);
  }
  return { cacheSkillsDir, agents };
}

export async function pruneOldCaches(base, keep) {
  let entries;
  try {
    entries = await fs.readdir(base, { withFileTypes: true });
  } catch { return; }
  const dirs = await Promise.all(
    entries.filter(e => e.isDirectory()).map(async e => {
      const p = path.join(base, e.name);
      const st = await fs.stat(p);
      return { path: p, mtime: st.mtimeMs };
    })
  );
  dirs.sort((a, b) => b.mtime - a.mtime);
  for (const d of dirs.slice(keep)) {
    await fs.rm(d.path, { recursive: true, force: true });
  }
}
