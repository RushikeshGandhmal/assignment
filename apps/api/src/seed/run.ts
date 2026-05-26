// CLI entry point for `pnpm seed`. Reads count and seed from env / args,
// runs the seed against the configured DATABASE_FILE.
import { db } from '../db/index.js';
import { env } from '../env.js';
import { seed } from './seed.js';

function parseArgs(): { count: number; randomSeed: number } {
  const args = process.argv.slice(2);
  let count = 10_000;
  let randomSeed = 42;
  for (const arg of args) {
    if (arg.startsWith('--count=')) count = Number(arg.slice('--count='.length));
    if (arg.startsWith('--seed=')) randomSeed = Number(arg.slice('--seed='.length));
  }
  if (process.env.SEED_COUNT) count = Number(process.env.SEED_COUNT);
  if (process.env.SEED_RANDOM) randomSeed = Number(process.env.SEED_RANDOM);
  return { count, randomSeed };
}

const { count, randomSeed } = parseArgs();

console.log(`[seed] target=${env.DATABASE_FILE} count=${count} randomSeed=${randomSeed}`);
const start = performance.now();
seed({ db, employeeCount: count, randomSeed });
const elapsed = Math.round(performance.now() - start);
console.log(`[seed] done in ${elapsed}ms`);
