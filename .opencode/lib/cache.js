import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CACHE_BASE = path.join(os.homedir(), '.cache', 'short-video-director');

async function readPluginVersion(pluginRoot) {
  const pkg = JSON.parse(await fs.readFile(path.join(pluginRoot, 'package.json'), 'utf-8'));
  return pkg.version;
}

export async function computeSourceHash(pluginRoot) {
  const sources = [];
  for (const subdir of ['skills', 'agents']) {
    const root = path.join(pluginRoot, subdir);
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.name.endsWith('.md')) {
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
