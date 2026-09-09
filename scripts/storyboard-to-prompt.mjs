#!/usr/bin/env node
import { resolveTaskInputs } from './shot-inputs.mjs';

try {
  const args = process.argv.slice(2);
  if (args[0] === '--json') args.shift();
  if (args.length !== 3 || args[0].startsWith('--')) {
    throw new Error('Usage: storyboard-to-prompt.mjs [--json] STORYBOARD TASK_ID EP');
  }
  console.log(JSON.stringify(resolveTaskInputs(args[0], args[1], args[2])));
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
