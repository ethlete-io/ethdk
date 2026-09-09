import { firstValueFrom, of } from 'rxjs';
import { CollectedEvent } from '../model/event';
import { StoredTitle, TimetrackTitleRepairStore } from './ports';
import { redactEventTitles, redactTitleRows, redactTitleUrls, repairStoredTitles$ } from './title';

describe('redactTitleUrls', () => {
  it('drops the query string of a URL a browser put in the title', () => {
    expect(
      redactTitleUrls(
        'accounts.google.com/signin/oauth/v3/consent?as=S-871351748&client_id=1062961139910&rapt=AEjHL4Na - Google Chrome',
      ),
    ).toBe('accounts.google.com/signin/oauth/v3/consent - Google Chrome');
  });

  it('drops the query string of a URL that names its scheme', () => {
    expect(redactTitleUrls('https://gitlab.com/search?q=secret')).toBe('https://gitlab.com/search');
  });

  it('drops a fragment', () => {
    expect(redactTitleUrls('https://example.com/doc#section-4')).toBe('https://example.com/doc');
  });

  it('drops the query string of a URL wrapped in brackets', () => {
    expect(redactTitleUrls('Ticket (jira.example.com/browse/FIP-1?focus=comment)')).toBe(
      'Ticket (jira.example.com/browse/FIP-1',
    );
  });

  it('keeps a URL that carries neither', () => {
    expect(redactTitleUrls('https://example.com/doc - Google Chrome')).toBe('https://example.com/doc - Google Chrome');
  });

  it('keeps an ordinary title', () => {
    expect(redactTitleUrls('timer.rs - ethlete-sdk - Visual Studio Code')).toBe(
      'timer.rs - ethlete-sdk - Visual Studio Code',
    );
  });

  it('keeps a question mark that ends a sentence', () => {
    expect(redactTitleUrls('Is 3.14 enough? - Notes')).toBe('Is 3.14 enough? - Notes');
  });
});

describe('redactEventTitles', () => {
  const focus = (title: string): CollectedEvent => ({
    source: 'window',
    kind: 'window-focus',
    at: new Date('2026-09-09T09:23:00Z'),
    appId: 'google-chrome',
    title,
  });

  it('redacts the title of an event that has one', () => {
    const [event] = redactEventTitles([focus('example.com/a?token=1')]);

    expect(event && 'title' in event ? event.title : null).toBe('example.com/a');
  });

  it('returns the same object when there is nothing to redact', () => {
    const event = focus('timer.rs - Visual Studio Code');

    expect(redactEventTitles([event])[0]).toBe(event);
  });

  it('passes through an event that carries no title', () => {
    const event: CollectedEvent = {
      source: 'idle',
      kind: 'idle-start',
      at: new Date('2026-09-09T09:23:00Z'),
    };

    expect(redactEventTitles([event])[0]).toBe(event);
  });
});

describe('redactTitleRows', () => {
  it('returns only the rows the redaction changed', () => {
    expect(
      redactTitleRows([
        { id: 1, title: 'https://example.com/a?token=x' },
        { id: 2, title: 'timer.rs - Visual Studio Code' },
      ]),
    ).toEqual([{ id: 1, title: 'https://example.com/a' }]);
  });

  it('returns nothing for a page that is already clean', () => {
    expect(redactTitleRows([{ id: 7, title: 'timer.rs - Visual Studio Code' }])).toEqual([]);
  });
});

/** A store of `id -> title`, paged the way the host pages, that records every write it was asked for. */
const repairStore = (titles: Record<number, string>) => {
  const rows = new Map(Object.entries(titles).map(([id, title]): [number, string] => [Number(id), title]));
  const writes: StoredTitle[][] = [];

  const store: TimetrackTitleRepairStore = {
    titlesAfterId$: (afterId, limit) =>
      of(
        [...rows.entries()]
          .map(([id, title]): StoredTitle => ({ id, title }))
          .filter((row) => row.id > afterId)
          .sort((a, b) => a.id - b.id)
          .slice(0, limit),
      ),
    setTitles$: (written) => {
      writes.push([...written]);
      for (const row of written) rows.set(row.id, row.title);

      return of(written.length);
    },
  };

  return { store, writes, rows };
};

describe('repairStoredTitles$', () => {
  it('reports what it read and what it had to change', async () => {
    const { store } = repairStore({
      1: 'https://example.com/a?token=x',
      2: 'timer.rs - Visual Studio Code',
      3: 'https://example.com/b#frag',
    });

    await expect(firstValueFrom(repairStoredTitles$(store))).resolves.toEqual({ scanned: 3, rewritten: 2 });
  });

  it('reads every page rather than only the first', async () => {
    const { store } = repairStore({
      1: 'https://example.com/a?a=1',
      2: 'https://example.com/b?b=2',
      3: 'https://example.com/c?c=3',
    });

    await expect(firstValueFrom(repairStoredTitles$(store, 1))).resolves.toEqual({ scanned: 3, rewritten: 3 });
  });

  it('leaves the titles it read redacted', async () => {
    const { store, rows } = repairStore({ 1: 'accounts.google.com/oauth?rapt=AEjHL4Na - Google Chrome' });

    await firstValueFrom(repairStoredTitles$(store));

    expect(rows.get(1)).toBe('accounts.google.com/oauth - Google Chrome');
  });

  it('writes nothing on a second pass over a store it already repaired', async () => {
    const { store, writes } = repairStore({ 1: 'https://example.com/a?token=x' });

    await firstValueFrom(repairStoredTitles$(store));
    writes.length = 0;
    await firstValueFrom(repairStoredTitles$(store));

    expect(writes).toEqual([]);
  });

  it('reports an empty store rather than never finishing', async () => {
    const { store } = repairStore({});

    await expect(firstValueFrom(repairStoredTitles$(store))).resolves.toEqual({ scanned: 0, rewritten: 0 });
  });

  it('ends on a full last page, rather than reading it again', async () => {
    const { store, writes } = repairStore({ 1: 'https://example.com/a?a=1', 2: 'https://example.com/b?b=2' });

    await firstValueFrom(repairStoredTitles$(store, 2));

    expect(writes).toHaveLength(1);
  });
});
