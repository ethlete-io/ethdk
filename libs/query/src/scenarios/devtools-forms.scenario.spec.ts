import { describe, expect, it } from 'vitest';
import {
  defineQueryForm,
  isQueryDevtoolsEnabled,
  provideQueryDevtools,
  queryDevtoolsEntries,
  searchQueryField,
  withArgs,
} from '../index';
import { useScenario } from './harness';

type Listing = { response: { items: unknown[] }; queryParams: { search: string | null } };

describe('devtools forms scenario', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideQueryDevtools()],
  });

  const linksOf = (handle: unknown) =>
    queryDevtoolsEntries()
      .find((entry) => entry.handle === handle)
      ?.formLinks?.ids() ?? [];

  const formEntryId = (name: string) => {
    const entry = queryDevtoolsEntries().find(
      (candidate) => candidate.kind === 'query-form' && candidate.meta.name === name,
    );

    if (!entry) throw new Error(`devtools forms scenario: no form entry named "${name}"`);

    return entry.id;
  };

  it('links every query that reads a form, not only the first', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    s.api.on('GET', '/users', () => ({ body: { items: [] } }));
    s.api.on('GET', '/teams', () => ({ body: { items: [] } }));

    const getUsers = s.get<Listing>('/users');
    const getTeams = s.get<Listing>('/teams');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({ name: 'listing', fields: { search: searchQueryField() } }).observe({
        writeToQueryParams: false,
      }),
    );

    const users = c.run(() => getUsers(withArgs(() => ({ queryParams: { search: qf.value().search } }))));
    const teams = c.run(() => getTeams(withArgs(() => ({ queryParams: { search: qf.value().search } }))));

    await s.settle();

    expect(users.response()).toEqual({ items: [] });
    expect(teams.response()).toEqual({ items: [] });

    const formId = formEntryId('listing');

    expect(linksOf(users)).toEqual([formId]);
    expect(linksOf(teams)).toEqual([formId]);
  });

  it('keeps the links after the form commits a new value', async () => {
    const s = scenario();

    expect(isQueryDevtoolsEnabled()).toBe(true);

    s.api.on('GET', '/users', () => ({ body: { items: [] } }));
    s.api.on('GET', '/teams', () => ({ body: { items: [] } }));

    const getUsers = s.get<Listing>('/users');
    const getTeams = s.get<Listing>('/teams');

    const c = s.consumer();
    const qf = c.run(() =>
      defineQueryForm({ name: 'committing', fields: { search: searchQueryField() } }).observe({
        writeToQueryParams: false,
      }),
    );

    const users = c.run(() => getUsers(withArgs(() => ({ queryParams: { search: qf.value().search } }))));
    const teams = c.run(() => getTeams(withArgs(() => ({ queryParams: { search: qf.value().search } }))));

    await s.settle();

    qf.setValue({ search: 'shoes' });
    // A search field debounces by 300ms, so the commit needs fake time before the args see it.
    await s.settle(400);
    await s.settle();

    expect(users.args()?.queryParams?.search).toBe('shoes');
    expect(teams.args()?.queryParams?.search).toBe('shoes');

    const formId = formEntryId('committing');

    expect(linksOf(users)).toEqual([formId]);
    expect(linksOf(teams)).toEqual([formId]);
  });
});
