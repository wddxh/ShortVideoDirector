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

async function copyScripts(pluginRoot, cacheDir) {
  const src = path.join(pluginRoot, 'scripts');
  try {
    await fs.access(src);
  } catch {
    return;
  }
  const dst = path.join(cacheDir, 'scripts');
  await fs.mkdir(dst, { recursive: true });
  const walk = async (s, d) => {
    const entries = await fs.readdir(s, { withFileTypes: true });
    for (const e of entries) {
      const sp = path.join(s, e.name);
      const dp = path.join(d, e.name);
      if (e.isDirectory()) {
        await fs.mkdir(dp, { recursive: true });
        await walk(sp, dp);
      } else if (e.isFile()) {
        await fs.copyFile(sp, dp);
      }
    }
  };
  await walk(src, dst);
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
