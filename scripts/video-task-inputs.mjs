#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fingerprintInputs, configPath } from './review-evidence.mjs';
import { resolveShotInputs, validateReferences } from './shot-inputs.mjs';

const validSettings = (settings) => settings &&
  settings.provider === 'dreamina' &&
  typeof settings.resolution === 'string' && settings.resolution.trim().length > 0 &&
  typeof settings.model === 'string' && settings.model.trim().length > 0 &&
  settings.model !== 'none' && typeof settings.ratio === 'string' &&
  /^[1-9]\d*:[1-9]\d*$/.test(settings.ratio);

export function captureInputs(task, settings) {
  if (task.inflight) throw new Error('Unresolved submission intent');
  if (task.status !== 'pending') throw new Error('Only prepared pending tasks can capture inputs');
  if (!validSettings(settings)) throw new Error('Invalid submission settings');
  const references = validateReferences(task.references).map(({ media, path: file }) =>
    ({ media, ...fingerprintInputs([file])[0] }));
  return { provider: settings.provider, model: settings.model, ratio: settings.ratio,
    resolution: settings.resolution, references };
}

export function verifyInputs(task) {
  try {
    const stored = task.submission;
    const current = captureInputs({ ...task, status: 'pending' }, stored);
    return Array.isArray(stored.references) && current.references.length === stored.references.length &&
      current.references.every((ref, i) => ['media', 'path', 'sha256'].every(key =>
        ref[key] === stored.references[i]?.[key]));
  } catch { return false; }
}

export function retryAuthorization(task, episode) {
  if (task.inflight) throw new Error('Unresolved submission intent');
  const grant = task.retry_authorization;
  if (!grant || typeof grant.decision !== 'string' || !grant.decision.trim() ||
      grant.episode !== episode || grant.shot !== task.shot ||
      !Array.isArray(grant.constraints) || !grant.constraints.every((item) => typeof item === 'string')) {
    throw new Error('Missing or out-of-scope retry authorization');
  }
  if (Object.hasOwn(grant, 'max_attempts') || Object.hasOwn(grant, 'attempts')) {
    if (!Number.isSafeInteger(grant.max_attempts) || grant.max_attempts < 1 ||
        !Number.isSafeInteger(grant.attempts) || grant.attempts < 0 ||
        grant.attempts >= grant.max_attempts) throw new Error('Invalid or exhausted retry limit');
  }
  return grant;
}

export function initialAuthorization(task, episode) {
  if (task.inflight) throw new Error('Unresolved submission intent');
  const grant = task.initial_authorization;
  if (!grant || typeof grant.decision !== 'string' || !grant.decision.trim() ||
      grant.episode !== episode || grant.shot !== task.shot ||
      !Array.isArray(grant.constraints) || !grant.constraints.every((item) => typeof item === 'string')) {
    throw new Error('Missing or out-of-scope initial authorization');
  }
  return grant;
}

function readTask(file, shot) {
  const tasks = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!/^[1-9]\d*$/.test(shot) || !Array.isArray(tasks)) throw new Error('Invalid task selection');
  const matches = tasks.filter((task) => task.shot === Number(shot));
  if (matches.length !== 1) throw new Error('Missing or duplicate registered task');
  return matches[0];
}

function outputTask(output) {
  const match = /^story\/episodes\/(ep(?:0[1-9]|[1-9]\d+))\/videos\/shot(0[1-9]|[1-9]\d+)\.mp4$/.exec(output ?? '');
  if (!match) throw new Error('Expected canonical video output');
  const [, episode, padded] = match;
  const shot = String(Number(padded));
  return { episode, padded, shot, file: `story/episodes/${episode}/videos/tasks.json` };
}

export function videoProfile(file, candidate) {
  if (!/^story\/episodes\/ep(?:0[1-9]|[1-9]\d+)\/videos\/tasks\.json$/.test(file)) {
    throw new Error('Expected canonical tasks path');
  }
  const config = configPath();
  const script = (name, args) => spawnSync('bash',
    [fileURLToPath(new URL(name, import.meta.url)), ...args], { encoding: 'utf8' });
  const detected = script('./detect-mode.sh', [config]);
  if (detected.status !== 0) throw new Error('Unknown video project mode');
  const mode = detected.stdout.trim();
  const provider = script('./read-config.sh', ['视频提供方', config]).stdout.trim();
  if (provider === 'none') throw new Error('Video provider none blocks new preparation/submission');
  if (mode === 'short') {
    if (candidate) {
      for (const [field, key] of [['ratio', '视频比例'], ['resolution', '视频分辨率']]) {
        const fixed = script('./read-config.sh', [key, config]).stdout.trim();
        if (fixed && fixed !== 'auto' && fixed !== candidate[field]) {
          throw new Error(`Episode output profile conflicts with fixed config: ${field}`);
        }
      }
    }
    return { mode, profile: null, source: 'episode' };
  }

  const fields = ['provider', 'model', 'ratio', 'resolution'];
  if (candidate && fields.some((key) => typeof candidate[key] !== 'string' ||
      !candidate[key].trim() || ['auto', 'none'].includes(candidate[key]))) {
    throw new Error('Series video profile requires resolved settings');
  }
  let profile = null;
  const root = 'story/episodes';
  // Episode locks are not a series transaction; callers must serialize preparations.
  const episodes = fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : [];
  for (const entry of episodes.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || !/^ep(?:0[1-9]|[1-9]\d+)$/.test(entry.name)) continue;
    const tasksFile = `${root}/${entry.name}/videos/tasks.json`;
    if (!fs.existsSync(tasksFile)) continue;
    const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
    if (!Array.isArray(tasks)) throw new Error(`Invalid series tasks: ${tasksFile}`);
    for (const task of tasks) {
      if (!task.inflight && !['pending', 'submitted', 'done', 'failed'].includes(task.status)) continue;
      if (!task.submission && task.status === 'pending' && !task.inflight && !task.submit_id) continue;
      const stored = task.submission;
      if (!fields.every((key) => typeof stored?.[key] === 'string' && stored[key].trim() &&
          !['auto', 'none'].includes(stored[key])) || !/^[1-9]\d*:[1-9]\d*$/.test(stored.ratio)) {
        throw new Error(`Series video profile unresolved: ${tasksFile} shot ${task.shot}`);
      }
      if (profile && fields.some((key) => profile[key] !== stored[key])) {
        throw new Error(`Series video profile conflict: ${tasksFile} shot ${task.shot}`);
      }
      profile = Object.fromEntries(fields.map((key) => [key, stored[key]]));
    }
  }
  const source = profile ? 'tasks' : 'config';
  const keys = ['视频提供方', '视频模型版本', '视频比例', '视频分辨率'];
  const fixed = Object.fromEntries(fields.map((field, i) => [field,
    i === 0 ? provider : script('./read-config.sh', [keys[i], config]).stdout.trim()]));
  let delegated = [];
  if (!profile) {
    const text = fs.readFileSync(config, 'utf8');
    const section = /^## 参数选择授权\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(text)?.[1];
    const block = /```json\s*\n([\s\S]*?)\n```/.exec(section ?? '');
    const grant = block ? JSON.parse(block[1]) : null;
    if (typeof grant?.decision === 'string' && grant.decision.trim() && Array.isArray(grant.delegated?.video)) {
      delegated = grant.delegated.video;
    }
  }
  const inherited = profile;
  profile ??= {};
  for (const field of fields) {
    const value = fixed[field];
    const isFixed = value && value !== 'auto';
    if (inherited && isFixed && value !== profile[field]) {
      throw new Error(`Series video profile conflicts with fixed config: ${field}`);
    }
    if (!inherited) {
      if (!isFixed && !delegated.includes(field)) {
        throw new Error(`Series video profile needs fixed config or explicit delegation: ${field}`);
      }
      profile[field] = isFixed ? value : null;
    }
    if (candidate && profile[field] !== null && candidate[field] !== profile[field]) {
      throw new Error(`Series video profile conflict: ${field}`);
    }
  }
  return { mode, profile, source };
}

function checkEpisodeProfile(tasks, task, profile) {
  for (const other of tasks) {
    if (other === task || !['pending', 'submitted', 'done', 'failed'].includes(other.status)) continue;
    const stored = other.submission;
    // New pending rows have no chosen output yet; historical jobs are not defaults.
    if (!stored && other.status === 'pending' && !other.inflight && !other.submit_id) continue;
    if (typeof stored?.resolution !== 'string' || !stored.resolution.trim() ||
        typeof stored?.ratio !== 'string' || !/^[1-9]\d*:[1-9]\d*$/.test(stored.ratio)) {
      throw new Error(`Episode output profile unresolved for shot ${other.shot}`);
    }
    if (stored.resolution !== profile.resolution || stored.ratio !== profile.ratio) {
      throw new Error(`Episode output profile conflict with shot ${other.shot}: ${stored.resolution} ${stored.ratio}`);
    }
  }
}

function gate([prompt, output, references, duration, ratio, model, provider, resolution], task, tasks) {
  const { episode, shot, file } = outputTask(output);
  // Caller records the actual decision and assesses its semantic constraints.
  if (!['pending', 'failed'].includes(task.status)) throw new Error('Task is protected');
  if (task.status === 'failed') retryAuthorization(task, episode);
  else initialAuthorization(task, episode);
  if (!verifyInputs(task)) throw new Error('Input identity missing or changed; intervention required');
  if (videoProfile(file, task.submission).mode === 'short') checkEpisodeProfile(tasks, task, task.submission);
  const sameRefs = JSON.stringify(validateReferences(JSON.parse(references)).map(({ media, path }) =>
    ({ media, path }))) === JSON.stringify(task.references.map(({ media, path }) => ({ media, path })));
  if (!prompt?.trim() || prompt !== task.prompt || !sameRefs ||
      !Number.isInteger(task.duration) || task.duration <= 0 || duration !== String(task.duration) ||
      ratio !== task.submission.ratio || model !== task.submission.model ||
      provider !== task.submission.provider || resolution !== task.submission.resolution) {
    throw new Error('Arguments do not match registered task');
  }
  const current = resolveShotInputs(`story/episodes/${episode}/storyboard.md`, Number(shot), episode);
  if (current.prompt !== task.prompt || current.duration !== task.duration ||
      JSON.stringify(current.references) !== JSON.stringify(task.references.map(({ media, path }) => ({ media, path })))) {
    throw new Error('Current converter fields differ; authorized preparation required');
  }
  const review = spawnSync(process.execPath, [fileURLToPath(new URL('./review-evidence.mjs', import.meta.url)),
    'check', episode, shot], { encoding: 'utf8' });
  if (review.status !== 0) {
    process.stderr.write(review.stdout ?? '');
    process.stderr.write(review.stderr ?? '');
    throw new Error('Current scoped material review required');
  }
}

function transition({ file, shot }, change, write = true) {
  // Serialize within this episode only; stale locks need reconciliation.
  const lock = `${file}.submit-lock`;
  const fd = fs.openSync(lock, 'wx');
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const tasks = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(tasks) || !/^[1-9]\d*$/.test(shot)) throw new Error('Invalid task records');
    const matches = tasks.filter((item) => item.shot === Number(shot));
    if (matches.length !== 1) throw new Error('Missing or duplicate registered task');
    const task = matches[0];
    const result = change(task, tasks);
    if (!write) return result;
    tasks[tasks.findIndex((item) => item.shot === task.shot)] = task;
    fs.writeFileSync(temp, `${JSON.stringify(tasks, null, 2)}\n`, { flag: 'wx' });
    const data = fs.openSync(temp, 'r');
    try { fs.fsyncSync(data); } finally { fs.closeSync(data); }
    fs.renameSync(temp, file);
    const dir = fs.openSync(path.dirname(file), 'r');
    try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    return result;
  } finally {
    fs.closeSync(fd);
    fs.rmSync(temp, { force: true });
    fs.unlinkSync(lock);
  }
}

function settle(output, token, outcome, value) {
  if (!['submitted', 'failed'].includes(outcome) || !value) throw new Error('Invalid known outcome');
  transition(outputTask(output), (task) => {
    if (task.inflight?.token !== token || !['pending', 'failed'].includes(task.status)) {
      throw new Error('Reservation no longer matches');
    }
    task.status = outcome;
    task.submit_id = outcome === 'submitted' ? value : '';
    task.fail_reason = outcome === 'failed' ? value : '';
    delete task.inflight;
  });
}

function reserve(args) {
  return transition(outputTask(args[1]), (task, tasks) => {
    gate(args, task, tasks);
    const kind = task.status === 'pending' ? 'initial' : 'retry';
    if (kind === 'retry' && Object.hasOwn(task.retry_authorization, 'max_attempts')) {
      task.retry_authorization.attempts++;
    }
    task.inflight = { token: randomUUID(), kind, reserved_at: new Date().toISOString() };
    return task.inflight.token;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, ...args] = process.argv.slice(2);
    if (['gate', 'reserve'].includes(action)) {
      if (args.shift() !== '--references-json') throw new Error('Expected --references-json');
    }
    if (action === 'profile' && args.length === 1) {
      console.log(JSON.stringify(videoProfile(args[0])));
    } else if (action === 'capture' && args.length === 6) {
      const captured = transition({ file: args[0], shot: args[1] }, (task, tasks) => {
        const settings = { provider: args[2], model: args[3], ratio: args[4], resolution: args[5] };
        const inputs = captureInputs(task, settings);
        if (videoProfile(args[0], inputs).mode === 'short') checkEpisodeProfile(tasks, task, inputs);
        return inputs;
      }, false);
      console.log(JSON.stringify(captured));
    } else if (action === 'verify' && args.length === 2) {
      if (!verifyInputs(readTask(args[0], args[1]))) throw new Error('Input identity missing or changed');
    } else if (action === 'retry' && args.length === 3) {
      console.log(JSON.stringify(retryAuthorization(readTask(args[0], args[1]), args[2])));
    } else if (action === 'initial' && args.length === 3) {
      console.log(JSON.stringify(initialAuthorization(readTask(args[0], args[1]), args[2])));
    } else if (action === 'reserve' && args.length === 8) {
      console.log(reserve(args));
    } else if (action === 'settle' && args.length === 4) {
      settle(...args);
    } else if (action === 'gate' && args.length === 8) {
      transition(outputTask(args[1]), (task, tasks) => gate(args, task, tasks), false);
    } else throw new Error('Usage: profile TASKS | capture TASKS SHOT PROVIDER MODEL RATIO RESOLUTION | verify TASKS SHOT | initial/retry TASKS SHOT EP | gate/reserve --references-json PROMPT OUTPUT REFERENCES DURATION RATIO MODEL PROVIDER RESOLUTION | settle OUTPUT TOKEN submitted/failed VALUE');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
