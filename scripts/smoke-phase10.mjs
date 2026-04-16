import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'smoke:phase0', args: ['scripts/smoke-phase0.mjs'] },
  { name: 'sim:affix-gates', args: ['scripts/sim-affix-gates.mjs'] },
  { name: 'sim:itemgen', args: ['scripts/sim-itemgen-sanity.mjs'] },
  { name: 'validate:support-gems', args: ['scripts/validate-support-gems.mjs'] },
];

for (const step of steps) {
  console.log(`\n[phase10 smoke] running ${step.name}`);
  const result = spawnSync(process.execPath, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`\n[phase10 smoke] failed at ${step.name} with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[phase10 smoke] all checks passed');
