#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CHECKS = [
  'lint:changesets',
  'versions:check',
  'lint:size',
  'lint:cli-related-map',
  'lint:migration-entries',
  'lint:studio-label-specs',
  'lint:studio-adrs',
  'lint:runner-os',
  'lint:commit-messages',
  'lint:spec-typecheck',
  'lint:no-verify-briefs',
  'lint:person-names',
  'docs:error-codes:check',
  'sdk:tokens:check',
];

export const commandsFor = (check, head, base) => {
  if (check === 'lint:changesets')
    return [
      ['node', ['tools/scripts/lint-changesets.js', '--rev', head]],
      ['yarn', ['lint:changeset-coverage']],
    ];
  if (check === 'lint:person-names') return [['node', ['tools/scripts/check-person-names.mjs', '--range', base, head]]];
  return [['yarn', [check]]];
};

/** Runs every sub-second pre-push check on the range, in order, and returns the failed ones with their output. */
export const runChecks = (base, head, { cwd = process.cwd(), stopAtFirst = false, log = console.log } = {}) => {
  const env = { ...process.env, NX_BASE: base, NX_HEAD: head, NX_NO_CLOUD: 'true', NX_DAEMON: 'false' };
  const failed = [];
  for (const check of CHECKS) {
    const run = commandsFor(check, head, base)
      .map(([command, args]) => spawnSync(command, args, { cwd, env, encoding: 'utf8' }))
      .find((result) => result.status !== 0);
    if (!run) continue;
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.replace(/\n$/, '');
    log(`pre-push: ${check} failed:`);
    log(output);
    failed.push({ check, output });
    if (stopAtFirst) break;
  }
  return failed;
};

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const [base, head] = process.argv.slice(2);
  process.exit(runChecks(base, head, { cwd: resolve(import.meta.dirname, '../..') }).length ? 1 : 0);
}
