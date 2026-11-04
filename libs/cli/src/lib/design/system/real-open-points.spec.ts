import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../paths';
import { readOpenPoints } from './read-open-points';
import { resolveProduct } from './resolve-product';

const REPO = resolve(__dirname, '../../../../../..');
const BUDGET_FILE = resolve(__dirname, 'real-open-points.budget.json');

const RATCHETED = ['missing-state', 'contrast', 'missing-motion'];

type Budget = Record<string, Record<string, number>>;

const countsOf = (): Budget => {
  const config = readConfig(REPO);
  const budget: Budget = {};

  for (const [name, entry] of Object.entries(config?.products ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const counts: Record<string, number> = {};

    for (const { part, points } of readOpenPoints(resolveProduct({ target: REPO, name, config: entry }))) {
      for (const { kind } of points.filter((point) => RATCHETED.includes(point.kind))) {
        const key = `${part} ${kind}`;

        counts[key] = (counts[key] ?? 0) + 1;
      }
    }

    budget[name] = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  }

  return budget;
};

describe('open points of the real design system', () => {
  it('stay within the committed budget', () => {
    const actual = countsOf();

    if (process.env['WRITE_BUDGET']) writeFileSync(BUDGET_FILE, `${JSON.stringify(actual, null, 2)}\n`);

    const budget: Budget = JSON.parse(readFileSync(BUDGET_FILE, 'utf8'));
    const grown: string[] = [];
    const shrunk: string[] = [];

    for (const product of new Set([...Object.keys(actual), ...Object.keys(budget)])) {
      for (const key of new Set([...Object.keys(actual[product] ?? {}), ...Object.keys(budget[product] ?? {})])) {
        const now = actual[product]?.[key] ?? 0;
        const allowed = budget[product]?.[key] ?? 0;
        const line = `${product}: ${key} ${allowed} -> ${now}`;

        if (now > allowed) grown.push(line);
        if (now < allowed) shrunk.push(line);
      }
    }

    expect(grown, 'More open points than the budget allows. Fix them or the change that added them.').toEqual([]);
    expect(
      shrunk,
      'Fewer open points than the budget. Lower the budget: WRITE_BUDGET=1 npx vitest run real-open-points.spec.ts',
    ).toEqual([]);
  });
});
