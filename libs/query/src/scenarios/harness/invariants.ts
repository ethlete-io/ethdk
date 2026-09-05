import { AnyQueryClient } from '../../index';
import { vi } from 'vitest';
import { FakeApi } from './fake-api';

export type InvariantName = 'pending' | 'timers' | 'cache' | 'errors';

export type ScenarioErrorEntry = {
  source: 'ErrorHandler' | 'console.error';
  error: unknown;
};

/**
 * A `console.warn` the scenario captured. Warnings are kept out of the invariants - advice is not a
 * leak - so one never fails a scenario on its own.
 */
export type ScenarioWarningEntry = {
  source: 'console.warn';
  warning: unknown;
};

export type InvariantCheckContext = {
  api: FakeApi;
  client: AnyQueryClient;
  errors: ScenarioErrorEntry[];
  allowed: ReadonlySet<InvariantName>;
};

export const checkInvariants = (ctx: InvariantCheckContext) => {
  const failures: string[] = [];

  if (!ctx.allowed.has('pending')) {
    const pending = ctx.api.pending();

    if (pending.length > 0) {
      failures.push(
        `pending: ${pending.length} request(s) still in flight: ${pending.map((r) => `${r.method} ${r.path}`).join(', ')}`,
      );
    }
  }

  if (!ctx.allowed.has('timers')) {
    const count = vi.getTimerCount();

    if (count > 0) failures.push(`timers: ${count} timer(s) leaked`);
  }

  if (!ctx.allowed.has('cache')) {
    const entries = ctx.client.repository.subtle.cacheEntries();

    if (entries.length > 0) {
      failures.push(`cache: ${entries.length} cache entrie(s) not released: ${entries.map((e) => e.key).join(', ')}`);
    }
  }

  if (!ctx.allowed.has('errors')) {
    if (ctx.errors.length > 0) {
      failures.push(
        `errors: ${ctx.errors.length} unexpected error(s):\n${ctx.errors.map((e) => `[${e.source}] ${String(e.error)}`).join('\n')}`,
      );
    }
  }

  if (failures.length > 0) throw new Error(`Scenario invariants failed:\n${failures.join('\n')}`);
};
