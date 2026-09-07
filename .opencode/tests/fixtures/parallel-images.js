import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { imageProject } from './image-project.js';

export const settings = { provider: 'dreamina', model: 'future-model', ratio: '9:16', resolution: '4k' };
export const job = (name, images = []) => ({ source: `assets/items/${name}.md`,
  output: `assets/images/items/${name}.png`, prompt: name, images, settings });

export async function waitFor(check) {
  const end = Date.now() + 10000;
  while (!check()) {
    if (Date.now() > end) throw new Error('barrier timed out');
    await delay(10);
  }
}

export function parallelImages(t) {
  const f = imageProject(t);
  f.write('dreamina', `#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const name = args.find(a => a.startsWith('--prompt=')).slice(9).split(/\\s+/).at(-1);
fs.writeFileSync('args-' + name, JSON.stringify(args));
fs.appendFileSync('calls', name + '\\n');
const refs = args.includes('--images') ? args[args.indexOf('--images') + 1].split(',') : [];
fs.writeFileSync('started-' + name, JSON.stringify(refs.map(p => fs.readFileSync(p, 'utf8'))));
const timer = setInterval(() => {
  if (!fs.existsSync('release-' + name)) return;
  clearInterval(timer);
  const status = fs.readFileSync('release-' + name, 'utf8') || 'success';
  console.log(JSON.stringify({ gen_status: status, submit_id: 'id-' + name,
    image_url: 'mock://' + name, fail_reason: 'rejected-' + name }));
}, 10);
`, 0o755);
  f.write('curl', '#!/usr/bin/env bash\nprintf "fresh-%s" "$4" > "$3"\n', 0o755);
  const start = (script, args) => {
    const child = spawn(script.endsWith('.sh') ? 'bash' : 'node',
      [join(process.cwd(), 'scripts', script), ...args], { cwd: f.root,
        env: { ...process.env, PATH: `${f.root}:${process.env.PATH}` } });
    let stdout = '', stderr = '';
    child.stdout.on('data', b => stdout += b);
    child.stderr.on('data', b => stderr += b);
    const result = new Promise(resolve => child.on('close', status => resolve({ status, stdout, stderr })));
    return { result, child };
  };
  return { ...f, start };
}
