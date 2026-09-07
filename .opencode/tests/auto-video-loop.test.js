import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const loop = fileURLToPath(new URL('../skill-overrides/auto-video/loop.sh', import.meta.url));
const template = readFileSync(new URL('../skill-overrides/auto-video/cron-prompt.txt', import.meta.url), 'utf8');
const curl = spawnSync('which', ['curl'], { encoding: 'utf8' }).stdout.trim();

async function runLoop(t, rounds, timeoutMethod = '') {
  const root = mkdtempSync(join(tmpdir(), 'svd-auto-loop-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = ['monitor.pid', 'prompt.txt', 'monitor.log'].map(name => join(root, name));
  const prompt = template.replaceAll('{{TARGET}}', 'ep02').replaceAll('{{SID}}', 'session-test')
    .replaceAll('{{CONFIG}}', 'profiles/a "quoted" \\ config.md').trimEnd();
  files.forEach(file => writeFileSync(file, file === files[1] ? prompt : 'existing'));
  const requests = [];
  let round = -1;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      if (req.method === 'GET') round++;
      const step = rounds[round] ?? {};
      res.statusCode = req.method === 'GET' ? (step.health ?? 200) : (step.post ?? 500);
      res.end(req.method === 'GET' ? (step.body ?? '{"healthy":true}') : '');
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  writeFileSync(join(root, 'sleep'), `#!/bin/bash
n=0
if [ -f ticks ]; then read -r n < ticks; fi
printf '%s\\n' "$((n + 1))" > ticks
printf '%s\\n' "$*" >> intervals
if [ "$n" -ge "$MAX_ROUNDS" ]; then kill -TERM "$PPID"; fi
`, { mode: 0o755 });
  // Timeouts are injected without waiting; all other requests use real local HTTP.
  writeFileSync(join(root, 'curl'), `#!/bin/bash
method=GET
for arg in "$@"; do [ "$arg" = POST ] && method=POST; done
if [ "$method" = "$TIMEOUT_METHOD" ]; then
  printf '%s\\n' "$method" >> timeouts
  exit 28
fi
exec "$REAL_CURL" "$@"
`, { mode: 0o755 });
  const child = spawn('bash', [loop], {
    cwd: root, timeout: 10000,
    env: { ...process.env, PATH: `${root}:${process.env.PATH}`, REAL_CURL: curl,
      NO_PROXY: '*', no_proxy: '*', TIMEOUT_METHOD: timeoutMethod,
      MAX_ROUNDS: String(rounds.length), PORT: String(server.address().port),
      SID: 'session-test', INTERVAL: '1200', PID_FILE: files[0],
      PROMPT_FILE: files[1], LOG_FILE: files[2] },
  });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const [code, signal] = await once(child, 'close');
  assert.equal(signal, null, stderr);
  assert.equal(code, 0, stderr);
  assert.deepEqual(readFileSync(join(root, 'intervals'), 'utf8').trim().split('\n'),
    rounds.map(() => '1200'));
  files.forEach(file => assert.equal(existsSync(file), false, file));
  assert.ok(existsSync(loop));
  return { requests, prompt, root };
}

for (const post of [404, 500, 302]) {
  test(`healthy server with POST ${post} stops after three failures`, async t => {
    const { requests } = await runLoop(t, Array(3).fill({ post }));
    assert.deepEqual(requests.map(r => r.method), ['GET', 'POST', 'GET', 'POST', 'GET', 'POST']);
  });
}

for (const method of ['GET', 'POST']) {
  test(`${method} timeouts stop after three failures`, async t => {
    const { requests, root } = await runLoop(t, Array(3).fill({}), method);
    assert.equal(requests.length, method === 'GET' ? 0 : 3);
    assert.ok(requests.every(r => r.method === 'GET'));
    assert.deepEqual(readFileSync(join(root, 'timeouts'), 'utf8').trim().split('\n'),
      Array(3).fill(method));
  });
}

for (const step of [{ health: 500 }, { body: '{"status":"down"}' }]) {
  test(`failed health ${JSON.stringify(step)} stops without POST`, async t => {
    const { requests } = await runLoop(t, Array(3).fill(step));
    assert.deepEqual(requests.map(r => r.method), ['GET', 'GET', 'GET']);
  });
}

test('health and delivery failures share the consecutive threshold', async t => {
  const { requests } = await runLoop(t, [{ health: 500 }, { post: 404 }, { health: 500 }]);
  assert.deepEqual(requests.map(r => r.method), ['GET', 'GET', 'POST', 'GET']);
});

for (const post of [200, 204]) {
  test(`POST ${post} resets failures and transports the complete target/config prompt`, async t => {
    const { requests, prompt } = await runLoop(t, [
      { post: 500 }, { health: 500 }, { post },
      { post: 404 }, { health: 500 }, { post: 500 },
    ]);
    assert.deepEqual(requests.map(r => r.method),
      ['GET', 'POST', 'GET', 'GET', 'POST', 'GET', 'POST', 'GET', 'GET', 'POST']);
    for (const request of requests) {
      if (request.method === 'GET') {
        assert.equal(request.url, '/global/health');
      } else {
        assert.equal(request.url, '/session/session-test/prompt_async');
        assert.equal(request.headers['content-type'], 'application/json');
        assert.deepEqual(JSON.parse(request.body), { parts: [{ type: 'text', text: prompt }] });
      }
    }
  });
}
