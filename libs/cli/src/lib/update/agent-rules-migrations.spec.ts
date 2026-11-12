import { cpSync, existsSync, mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readPackageMigrations } from './migration-manifest';
import { PackageManager } from './package-manager';
import { orderMigrations, pendingMigrations } from './plan';
import { runPendingMigrations } from './run-migrations';
import { writeUpdateTasks } from './tasks';

const agentRulesSource = join(__dirname, '../../../../agent-rules');
const docsSource = join(__dirname, '../../../../../apps/docs');
const packageName = '@ethlete/agent-rules';
const yarn: PackageManager = { name: 'yarn', install: ['yarn', 'install'], run: ['yarn'] };

const installAgentRules = () => {
  const root = mkdtempSync(join(tmpdir(), 'cli-agent-rules-migrations-'));
  const target = join(root, 'node_modules', '@ethlete', 'agent-rules');

  mkdirSync(target, { recursive: true });

  for (const entry of ['package.json', 'migrations.json', 'migrations']) {
    const source = join(agentRulesSource, entry);

    if (existsSync(source)) cpSync(source, join(target, entry), { recursive: true });
  }

  return root;
};

const update = (options: { root: string; from: string }) => {
  const { root, from } = options;
  const to = '0.1.0-next.17';
  const packageMigrations = readPackageMigrations({ root, packageName });
  const pending = orderMigrations(pendingMigrations({ packageMigrations, from, to }));
  const outcomes = runPendingMigrations({ root, manager: yarn, pending, dryRun: false });
  const written = writeUpdateTasks({
    root,
    updates: [{ name: packageName, from, to }],
    outcomes,
    manager: yarn,
    generatedAt: '2026-09-25T00:00:00.000Z',
  });

  return { problems: packageMigrations.problems, written };
};

describe('the @ethlete/agent-rules migrations', () => {
  it('leave no required task for a repo on 0.1.0-next.13', () => {
    const { problems, written } = update({ root: installAgentRules(), from: '0.1.0-next.13' });

    expect(problems).toEqual([]);
    expect(written.tasks).toEqual([]);
  });

  it('keep the other guidance fixes optional', () => {
    const { migrations } = readPackageMigrations({ root: installAgentRules(), packageName });

    expect(migrations.filter((entry) => entry.level === 'optional').map((entry) => entry.name)).toEqual([
      'list-state-query-form',
      'search-query-field',
      'sdk-components-over-hand-built-ui',
      'nx-layout',
    ]);
  });

  it('leave nothing for a repo that already has them', () => {
    const { written } = update({ root: installAgentRules(), from: '0.1.0-next.17' });

    expect(written.tasks).toEqual([]);
  });

  it('link docs pages that exist', () => {
    const { migrations } = readPackageMigrations({ root: installAgentRules(), packageName });

    for (const migration of migrations.filter((entry) => entry.docs !== undefined)) {
      const path = (migration.docs ?? '').replace(/\/$/, '/index');

      expect(existsSync(join(docsSource, `${path}.md`)), migration.docs).toBe(true);
    }
  });
});
