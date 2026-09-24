import { AnyQueryClient } from '../../index';
import { vi } from 'vitest';
import { FakeApi } from './fake-api';

export type InvariantName = 'pending' | 'timers' | 'cache' | 'errors' | 'requests';

export const MAX_REQUESTS_PER_ROUTE = 20;

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

  if (!ctx.allowed.has('requests')) {
    const counts = new Map<string, number>();

    for (const r of ctx.api.requests) {
      const key = `${r.method} ${r.path}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const storms = [...counts].filter(([, count]) => count > MAX_REQUESTS_PER_ROUTE);

    if (storms.length > 0) {
      failures.push(
        `requests: more than ${MAX_REQUESTS_PER_ROUTE} requests to one route: ${storms.map(([key, count]) => `${key} (${count})`).join(', ')}`,
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
