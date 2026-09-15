import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { configPath } from './review-evidence.mjs';

const reader = fileURLToPath(new URL('./read-config.sh', import.meta.url));

function positiveRate(value) {
  if (!/^\d+(?:\/\d+|\.\d+)?$/.test(value)) throw new Error('expected positive rational fps');
  let [n, d = '1'] = value.split('/');
  if (n.includes('.')) {
    const [whole, fraction] = n.split('.');
    n = whole + fraction;
    d = '1' + '0'.repeat(fraction.length);
  }
  let numerator = BigInt(n), denominator = BigInt(d);
  if (numerator <= 0n || denominator <= 0n) throw new Error('expected positive rational fps');
  let a = numerator, b = denominator;
  while (b) [a, b] = [b, a % b];
  numerator /= a;
  denominator /= a;
  return denominator === 1n ? String(numerator) : `${numerator}/${denominator}`;
}

export function readLocalReferenceSpec(ep, value = process.env.SVD_CONFIG) {
  if (!/^ep(?:0[1-9]|[1-9]\d+)$/.test(ep ?? '')) throw new Error('Invalid episode');
  const config = configPath(value);
  const read = (suffix, parse) => {
    const key = `${ep} 本地参考${suffix}`;
    try {
      const result = spawnSync('bash', [reader, key, config], { encoding: 'utf8' });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error('missing saved value');
      return parse(result.stdout.trim());
    } catch (error) {
      throw new Error(`${config}: ${key}: ${error.message}`);
    }
  };
  const dimension = text => {
    const number = Number(text);
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number <= 0 || number % 2) {
      throw new Error('expected positive even integer pixels');
    }
    return number;
  };
  return { config, expected: { width: read('宽度', dimension),
    height: read('高度', dimension), fps: read('fps', positiveRate) } };
}
