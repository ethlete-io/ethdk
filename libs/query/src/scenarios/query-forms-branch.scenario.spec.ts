import { DestroyRef } from '@angular/core';
import { defineQueryForm, queryField, searchQueryField, withArgs } from '../index';
import { describe, expect, it, vi } from 'vitest';
import { useScenario } from './harness';

describe('query form branch scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('debounces typing into a branch field the way the source form does', () => {
    const s = scenario();
    s.api.on('GET', '/teams', () => ({ body: { totalHits: 1 } }));

    const getTeams = s.get<{ response: { totalHits: number }; queryParams: { search: string | null } }>('/teams');

    const qf = s.run(() =>
      defineQueryForm({ fields: { search: searchQueryField() } }).observe({ writeToQueryParams: false }),
    );

    const c = s.consumer();
    const draft = qf.branch(c.injector);
    const preview = c.run(() => getTeams(withArgs(() => ({ queryParams: { search: draft.value().search } }))));

    s.tick();
    expect(s.api.requestCount('GET', '/teams')).toBe(1);

    for (const typed of ['c', 'ch', 'che']) {
      draft.fields.search().value.set(typed);
      s.tick(50);
    }

    expect(draft.value().search).toBeNull();
    expect(s.api.requestCount('GET', '/teams')).toBe(1);

    s.tick(300);

    expect(draft.value().search).toBe('che');
    expect(s.api.requestCount('GET', '/teams')).toBe(2);
    expect(preview.response()).toEqual({ totalHits: 1 });

    c.destroy();
  });

  it('a branch given a shorter-lived injector is released with it, not with the form', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({ fields: { search: searchQueryField() } }).observe({ writeToQueryParams: false }),
    );

    const formDestroyRef = s.injector.get(DestroyRef);
    const registeredOnForm = vi.spyOn(formDestroyRef, 'onDestroy');

    const c = s.consumer();
    const draft = qf.branch(c.injector);

    expect(registeredOnForm).not.toHaveBeenCalled();

    qf.branch();
    expect(registeredOnForm).toHaveBeenCalled();

    draft.fields.search().value.set('pending');
    s.tick(50);

    c.destroy();
    s.tick(300);

    expect(draft.value().search).toBeNull();
  });

  it('branch resets chain through isResetBy the way the source form does', () => {
    const s = scenario();

    const qf = s.run(() =>
      defineQueryForm({
        fields: {
          country: queryField<string>(),
          league: queryField<string>({ isResetBy: 'country' }),
          team: queryField<string>({ isResetBy: 'league' }),
        },
      }).observe({ writeToQueryParams: false }),
    );

    qf.setValue({ country: 'de', league: 'bundesliga', team: 'fcb' });
    s.tick();

    const draft = qf.branch();
    draft.fields.country().value.set('us');
    s.tick();

    expect(draft.value()).toEqual({ country: 'us', league: null, team: null });
    expect(qf.value()).toEqual({ country: 'de', league: 'bundesliga', team: 'fcb' });
  });
});
