import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  defineQueryForm,
  queryField,
  Sort,
  transformToBooleanArray,
  transformToDate,
  transformToNumber,
  transformToNumberArray,
  transformToSort,
  transformToSortQueryParam,
  transformToString,
} from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('query form transforms scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('reads a hand-edited number list, dropping what is not a number and wrapping a single value', async () => {
    const s = scenario();
    const idsField = () => queryField<number[] | null>({ queryParamToValue: transformToNumberArray });

    await s.reloadAt('/?ids=1&ids=x&ids=3&single=7');

    const qf = s.run(() => defineQueryForm({ fields: { ids: idsField(), single: idsField() } }).observe());
    s.tick();

    expect(qf.value()).toEqual({ ids: [1, 3], single: [7] });
  });

  it('reads booleans from true/1 and a date-only value as local midnight', async () => {
    const s = scenario();

    await s.reloadAt('/?flags=1&flags=false&from=2026-09-01');

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          flags: queryField<boolean[] | null>({ queryParamToValue: transformToBooleanArray }),
          from: queryField<Date | null>({ queryParamToValue: transformToDate }),
        },
      }).observe(),
    );
    s.tick();

    expect(qf.value().flags).toEqual([true, false]);
    expect(qf.value().from?.getTime()).toBe(new Date(2026, 8, 1).getTime());
  });

  it('reads an unreadable URL value as null instead of throwing', async () => {
    const s = scenario();

    await s.reloadAt('/?from=not-a-date&owner=ada');

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          from: queryField<Date | null>({ queryParamToValue: transformToDate }),
          owner: queryField<string | null>({ queryParamToValue: transformToString, skipAutoTransform: true }),
        },
      }).observe(),
    );
    s.tick();

    expect(qf.value()).toEqual({ from: null, owner: 'ada' });
  });

  it.fails('falls back to the default when a transform rejects the URL value (reads null instead)', async () => {
    const s = scenario();
    const positive = (value: unknown) => {
      const n = transformToNumber(value);

      return n !== null && n > 0 ? n : null;
    };

    await s.reloadAt('/?page=-3');

    const qf = s.run(() =>
      defineQueryForm({
        fields: { page: queryField<number>({ defaultValue: 1, queryParamToValue: positive }) },
      }).observe(),
    );
    s.tick();

    expect(qf.value().page).toBe(1);
  });

  it('round-trips a custom sort field through transformToSort and transformToSortQueryParam', async () => {
    const s = scenario();
    const router = TestBed.inject(Router);
    const orderField = () =>
      queryField<Sort | null>({ queryParamToValue: transformToSort, valueToQueryParam: transformToSortQueryParam });

    const c = s.consumer();
    const qf = c.run(() => defineQueryForm({ fields: { order: orderField() } }).observe());

    qf.setValue({ order: { active: 'createdAt', direction: 'desc' } });
    await s.settle();
    expect(router.parseUrl(router.url).queryParams).toEqual({ order: 'createdAt:desc' });

    const url = router.url;
    c.destroy();

    await s.reloadAt(url);

    const restored = s.run(() => defineQueryForm({ fields: { order: orderField() } }).observe());
    s.tick();

    expect(restored.value().order).toEqual({ active: 'createdAt', direction: 'desc' });
  });
});
