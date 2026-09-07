import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const scripts = join(process.cwd(), 'scripts');
export const settingsText = `## 基本信息
- 已解析图像提供方：dreamina
- 已解析图像模型版本：future-model
- 已解析图片比例：9:16
- 已解析图片分辨率：4k
`;
export function imageProject(t) {
  const root = mkdtempSync(join(tmpdir(), 'svd-image-settings-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (file, text, mode) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text, { mode });
  };
  const read = (file) => readFileSync(join(root, file), 'utf8');
  const exists = (file) => existsSync(join(root, file));
  write('dreamina', `#!/usr/bin/env node
const fs = require('fs');
fs.appendFileSync('calls', JSON.stringify(process.argv.slice(2)) + '\\n');
fs.copyFileSync(process.env.EXPECTED_RECEIPT, 'observed.json');
console.log(process.env.RESPONSE);
`, 0o755);
  write('curl', '#!/usr/bin/env bash\nprintf PNG > "$3"\n', 0o755);
  const cli = (script, args, env = {}) => spawnSync(script.endsWith('.sh') ? 'bash' : 'node',
    [join(scripts, script), ...args], { cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: `${root}:${process.env.PATH}`, ...env } });
  return { root, write, read, exists, cli };
}
