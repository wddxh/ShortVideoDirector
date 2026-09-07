#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateImagePaths } from './image-generation-paths.mjs';

try {
  const [action, ...args] = process.argv.slice(2);
  let record;
  let output;
  if (['check', 'prepare', 'retry-check', 'retry-prepare'].includes(action) && args.length === 6) {
    const [source, target, provider, model, ratio, resolution] = args;
    if (args.some((v) => !v.trim()) || provider !== 'dreamina' || model === 'none' ||
        resolution === 'none' || !/^[1-9]\d*:[1-9]\d*$/.test(ratio) || !target.endsWith('.png')) {
      throw new Error('Invalid image generation settings');
    }
    validateImagePaths(source, target);
    output = target;
    const priorFile = output.replace(/\.png$/, '.generation.json');
    let prior;
    if (fs.existsSync(priorFile)) {
      prior = JSON.parse(fs.readFileSync(priorFile, 'utf8'));
      if (action.startsWith('retry-') && prior.submit_id?.trim()) {
        throw new Error(`Known submit_id=${prior.submit_id}; retrieve/reconcile, not missing-ID retry`);
      }
      const retry = action.startsWith('retry-') && !prior.submit_id?.trim() &&
        ['unknown', 'prepared'].includes(prior.status);
      if (retry) {
        // Atomic rename failure can leave the only received ID beside the receipt.
        for (const name of fs.readdirSync(path.dirname(priorFile))) {
          if (!name.startsWith(`${path.basename(priorFile)}.`) || !name.endsWith('.tmp')) continue;
          const evidence = JSON.parse(fs.readFileSync(path.join(path.dirname(priorFile), name), 'utf8'));
          if (evidence.submit_id?.trim()) {
            throw new Error(`Local receipt evidence submit_id=${evidence.submit_id}; retrieve/reconcile before retry`);
          }
        }
        if (fs.existsSync('assets/images/pending.json.lock')) {
          throw new Error('Pending lock exists; reconcile owner before missing-ID retry');
        }
        if (['source_path', 'output_path', 'provider', 'model', 'ratio', 'resolution'].some(
          (key, i) => prior[key] !== [source, output, provider, model, ratio, resolution][i])) {
          throw new Error('Missing-ID retry settings mismatch');
        }
        if (fs.existsSync(output)) throw new Error('Local output requires reconciliation before retry');
        if ((prior.missing_id_retries ?? 0) >= 2) throw new Error('Missing-ID retries exhausted');
      } else if (!['done', 'failed'].includes(prior.status)) {
        throw new Error(`Image receipt requires reconciliation: ${output} (${prior.status})`);
      }
    }
    if (action.endsWith('check')) {
      if ((!prior || prior.status === 'done') && fs.existsSync(output) && fs.statSync(output).isFile()) {
        console.log('SKIP');
      }
      process.exit(0);
    }
    record = { source_path: source, output_path: output, provider, model, ratio, resolution,
      status: 'prepared' };
    if (prior?.missing_id_responses) record.missing_id_responses = prior.missing_id_responses;
    if (prior?.missing_id_retries !== undefined) record.missing_id_retries = prior.missing_id_retries;
    if (action === 'retry-prepare' && prior && ['unknown', 'prepared'].includes(prior.status)) {
      record.missing_id_retries = (prior.missing_id_retries ?? 0) + 1;
      console.error('WARN missing-ID retry; remote duplicates possible');
    }
  } else if (action === 'missing-id' && args.length === 1) {
    [output] = args;
    record = JSON.parse(fs.readFileSync(output.replace(/\.png$/, '.generation.json'), 'utf8'));
    if (record.submit_id?.trim()) throw new Error('Known ID cannot become missing-ID');
    record.status = 'unknown';
    record.missing_id_responses ??= [];
    record.missing_id_responses.push(fs.readFileSync(0, 'utf8'));
  } else if (action === 'settle' && (args.length === 2 || args.length === 3)) {
    const [target, status, submitId] = args;
    output = target;
    if (!['received', 'pending', 'done', 'failed', 'unknown'].includes(status) ||
        (['received', 'pending'].includes(status) && !submitId?.trim())) throw new Error('Invalid image outcome');
    record = JSON.parse(fs.readFileSync(output.replace(/\.png$/, '.generation.json'), 'utf8'));
    if (record.output_path !== output) throw new Error('Receipt output mismatch');
    if (submitId && record.submit_id && submitId !== record.submit_id) {
      throw new Error('Receipt submit_id mismatch');
    }
    record.status = status;
    if (submitId) record.submit_id = submitId;
    delete record.output_sha256;
    if (status === 'done') {
      record.output_sha256 = createHash('sha256').update(fs.readFileSync(output)).digest('hex');
    }
  } else {
    throw new Error('Usage: check/prepare/retry-check/retry-prepare SOURCE OUTPUT PROVIDER MODEL RATIO RESOLUTION | missing-id OUTPUT (stdin response) | settle OUTPUT received/pending/done/failed/unknown [SUBMIT_ID]');
  }
  const file = output.replace(/\.png$/, '.generation.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(temporary, file);
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
