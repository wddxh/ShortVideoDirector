#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateAssetLocalReferences } from './local-reference.mjs';
import { validateImagePaths } from './image-generation-paths.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const isFile = file => fs.existsSync(file) && fs.statSync(file).isFile();

export async function runImages(jobs, { force = false, concurrency = 5, retryMissingId = false } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('invalid concurrency');
  if (!Array.isArray(jobs) || !jobs.length) throw new Error('jobs must be a nonempty array');
  const byOutput = new Map();
  for (const job of jobs) {
    const { source, output, prompt, images, settings: s } = job ?? {};
    validateImagePaths(source, output);
    const strings = [source, output, prompt, s?.provider, s?.model, s?.ratio, s?.resolution];
    if (strings.some(v => typeof v !== 'string' || !v.trim() || v.includes('\0')) ||
        s.provider !== 'dreamina' || s.model === 'none' || s.resolution === 'none' ||
        !/^[1-9]\d*:[1-9]\d*$/.test(s.ratio) || !output.endsWith('.png') ||
        !Array.isArray(images) || images.some(v => typeof v !== 'string' || !v.trim() || /[,\0]/.test(v))) {
      throw new Error(`invalid image job: ${source ?? '?'}`);
    }
    const value = { source, output, prompt, images, settings: {
      provider: s.provider, model: s.model, ratio: s.ratio, resolution: s.resolution } };
    const key = path.resolve(output);
    const prior = byOutput.get(key);
    if (prior && JSON.stringify(prior.job) !== JSON.stringify(value)) {
      throw new Error(`conflicting output: ${output}`);
    }
    if (!prior) byOutput.set(key, { job: value, state: 'waiting', dependencies: [] });
  }
  const entries = [...byOutput.values()];
  let pending;
  try {
    const file = 'assets/images/pending.json';
    pending = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    if (!Array.isArray(pending)) throw new Error();
    for (const item of pending) path.resolve(item.output_path);
  } catch { throw new Error('cannot read pending state'); }
  const pendingByOutput = new Map(pending.map(p => [path.resolve(p.output_path), p]));
  const foundPending = new Set();
  for (const entry of entries) {
    const { job } = entry;
    for (const file of [job.output, ...job.images]) {
      const item = pendingByOutput.get(path.resolve(file));
      if (item) foundPending.add(item);
    }
    for (const ref of job.images) {
      const dependency = byOutput.get(path.resolve(ref));
      if (dependency) entry.dependencies.push(dependency);
      else if (!pendingByOutput.has(path.resolve(ref)) && !isFile(ref)) {
        throw new Error(`missing dependency: ${ref}`);
      }
    }
  }
  if (foundPending.size) {
    const outcomes = entries.map(({ job }) => ({ ...job, status: 'blocked' }));
    for (const p of foundPending) console.log(`PENDING ${p.submit_id} ${p.asset_path} ${p.output_path}`);
    for (const e of outcomes) console.log(`BLOCKED ${e.source} ${e.output}`);
    return { status: 2, generated: 0, skipped: 0, outcomes };
  }
  for (const { job } of entries) {
    for (const output of [job.output, ...job.images.filter(ref => !byOutput.has(path.resolve(ref)))]) {
      const receipt = output.replace(/\.png$/, '.generation.json');
      if (fs.existsSync(`${output}.claim`)) throw new Error(`output claim exists: ${output}`);
      if (output.endsWith('.png') && fs.existsSync(receipt)) {
        const record = JSON.parse(fs.readFileSync(receipt, 'utf8'));
        const retry = retryMissingId && output === job.output && !record.submit_id?.trim() &&
          ['unknown', 'prepared'].includes(record.status);
        if (!retry && !['done', 'failed'].includes(record.status)) {
          throw new Error(`Image receipt requires reconciliation: ${output}`);
        }
      }
    }
    validateAssetLocalReferences(job.source, job.images);
  }
  // Validate the whole graph, even when old outputs exist under --force.
  const checked = new Set();
  while (checked.size < entries.length) {
    const ready = entries.filter(e => !checked.has(e) && e.dependencies.every(d => checked.has(d)));
    if (!ready.length) throw new Error('cyclic image dependencies');
    ready.forEach(e => checked.add(e));
  }
  entries.sort((a, b) => a.job.source.localeCompare(b.job.source, 'en', { numeric: true }));
  let generated = 0, skipped = 0, status = 0;
  const active = new Set();
  const complete = e => ['done', 'skipped'].includes(e.state);
  const launch = entry => {
    entry.state = 'running';
    const { job: j } = entry;
    const task = execute('image-gen-dreamina.sh', [...(force ? ['--force'] : []),
      ...(retryMissingId ? ['--retry-missing-id'] : []),
      j.prompt, j.output, j.settings.ratio, j.settings.resolution, j.settings.model,
      j.images.join(','), j.source]).then(result => {
      if (result.status === 0 && isFile(j.output)) {
        if (result.stdout.trim() === `SKIP ${j.output}`) {
          entry.state = 'skipped'; skipped++;
        } else { entry.state = 'done'; generated++; }
      } else {
        entry.state = result.status === 2 ? 'pending' : 'failed';
        status = entry.state === 'failed' || status === 1 ? 1 : 2;
        if (entry.state === 'pending') console.log(`${result.stdout.trim()} ${j.source} ${j.output}`);
        else console.log(`FAILED ${j.source} ${j.output}`);
        if (entry.state === 'failed' && result.stdout) process.stdout.write(result.stdout);
        if (result.status === 0) console.error(`FAIL output not created: ${j.output}`);
      }
      if (result.stderr) process.stderr.write(result.stderr);
    }).finally(() => active.delete(task));
    active.add(task);
  };
  while (true) {
    if (!status) {
      for (const entry of entries) {
        if (active.size >= concurrency) break;
        if (entry.state === 'waiting' && entry.dependencies.every(complete)) launch(entry);
      }
    }
    if (!active.size) break;
    await Promise.race(active);
  }
  for (const entry of entries) {
    if (entry.state === 'waiting') {
      entry.state = 'blocked';
      console.log(`BLOCKED ${entry.job.source} ${entry.job.output}`);
    }
  }
  if (!status) console.log(`OK generated ${generated} skipped ${skipped}`);
  return { status, generated, skipped,
    outcomes: entries.map(e => ({ ...e.job, status: e.state })) };
}

function execute(script, args) {
  return new Promise(resolve => {
    const child = spawn('bash', [path.join(scripts, script), ...args]);
    let stdout = '', stderr = '';
    child.stdout.on('data', b => stdout += b);
    child.stderr.on('data', b => stderr += b);
    child.on('error', error => resolve({ status: 1, stdout, stderr: error.message }));
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

export function parseImageArgs(args) {
  let force = false, concurrency = 5;
  let retryMissingId = false;
  const inputs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--force') force = true;
    else if (args[i] === '--retry-missing-id') retryMissingId = true;
    else if (args[i] === '--concurrency') {
      const value = args[++i];
      if (!/^[1-9]\d*$/.test(value ?? '')) throw new Error('invalid concurrency');
      concurrency = Number(value);
    } else if (args[i].startsWith('--')) throw new Error(`unknown option: ${args[i]}`);
    else inputs.push(args[i]);
  }
  if (!Number.isSafeInteger(concurrency)) throw new Error('invalid concurrency');
  if (!inputs.length) throw new Error('at least one input is required');
  return { force, concurrency, inputs, ...(retryMissingId ? { retryMissingId } : {}) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { inputs, ...options } = parseImageArgs(process.argv.slice(2));
    if (inputs.length !== 1) throw new Error('usage: generate-images-dreamina.mjs [--force] [--retry-missing-id] [--concurrency N] JOBS.json');
    const jobs = JSON.parse(fs.readFileSync(inputs[0], 'utf8'));
    process.exitCode = (await runImages(jobs, options)).status;
  } catch (error) { console.error(`FAIL ${error.message}`); process.exitCode = 1; }
}
