import { provideZonelessChangeDetection, Signal, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  clearQueryDevtoolsMockStore,
  QueryDevtoolsEntry,
  QueryDevtoolsMock,
  queryDevtoolsMockId,
  saveQueryDevtoolsMock,
} from '@ethlete/query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUERY_DEVTOOLS_HOST, QueryDevtoolsHost } from './query-devtools-host';
import { QueryDevtoolsMocksTabComponent } from './query-devtools-mocks-tab.component';
import { createQueryDevtoolsTestHost } from './testing/query-devtools-test-host';
import { QUERY_DEVTOOLS_COPIED_RESET_MS } from './query-devtools-types';

const mock = (patch: Partial<QueryDevtoolsMock> = {}): QueryDevtoolsMock => {
  const parts = { clientName: 'main', method: 'GET', pattern: '/posts', query: '', ...patch };

  return {
    id: queryDevtoolsMockId(parts),
    status: 200,
    body: { items: [] },
    latencyMs: 0,
    capturedAt: null,
    ...parts,
    ...patch,
  };
};

const secureEntry = (): QueryDevtoolsEntry =>
  ({
    id: 'q1',
    kind: 'query',
    meta: { isSecure: true, clientName: 'main', method: 'GET', route: '/posts' },
    handle: { response: () => null },
  }) as unknown as QueryDevtoolsEntry;

const render = async (overrides: Partial<QueryDevtoolsHost> = {}) => {
  TestBed.configureTestingModule({
    imports: [QueryDevtoolsMocksTabComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: QUERY_DEVTOOLS_HOST,
        useValue: createQueryDevtoolsTestHost({
          clientNames: signal(['main']),
          queryEntries: signal([secureEntry()]),
          formatBytes: (bytes: number) => `${bytes} B`,
          ...overrides,
        }),
      },
    ],
  });

  const fixture = TestBed.createComponent(QueryDevtoolsMocksTabComponent);
  await fixture.whenStable();

  return fixture;
};

const noAuthChips = (fixture: { nativeElement: HTMLElement }) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.et-query-devtools-chip')).filter(
    (chip) => chip.textContent?.trim() === 'no auth',
  );

describe('QueryDevtoolsMocksTabComponent', () => {
  afterEach(() => {
    clearQueryDevtoolsMockStore();
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('should warn about auth for a mock with a query string', async () => {
    saveQueryDevtoolsMock(mock({ query: 'page=2' }));

    expect(noAuthChips(await render())).toHaveLength(1);
  });

  it('should warn about auth for a mock without a query string', async () => {
    saveQueryDevtoolsMock(mock());

    expect(noAuthChips(await render())).toHaveLength(1);
  });

  it('should stop confirming a copied definition once its tick has expired', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    saveQueryDevtoolsMock(mock());

    const fixture = await render();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((candidate) => candidate.textContent?.includes('TS') === true);

    button?.click();
    await fixture.whenStable();

    expect(button?.textContent).toContain('Copied');

    await new Promise((resolve) => setTimeout(resolve, QUERY_DEVTOOLS_COPIED_RESET_MS + 100));
    await fixture.whenStable();

    expect(button?.textContent).not.toContain('Copied');
    expect(button?.textContent).toContain('TS');
  });

  it("should keep a seeded mock's type labels across a tab switch", async () => {
    const id = queryDevtoolsMockId({ clientName: 'main', method: 'GET', pattern: '/posts', query: '' });
    const seededTypes = signal<Record<string, ReadonlyMap<string, string>>>({ [id]: new Map([['items', 'Post[]']]) });
    saveQueryDevtoolsMock(mock({ schemaName: null }));

    const annotationsOf = async () => {
      const fixture = await render({ seededTypes });
      const tab = fixture.componentInstance as unknown as {
        editingId: WritableSignal<string | null>;
        editingAnnotations: Signal<ReadonlyMap<string, string> | null>;
      };

      tab.editingId.set(id);

      return tab.editingAnnotations();
    };

    expect((await annotationsOf())?.get('items')).toBe('Post[]');

    TestBed.resetTestingModule();

    expect((await annotationsOf())?.get('items')).toBe('Post[]');
  });

  it('should not re-measure the mock library when a query registers', async () => {
    let reads = 0;
    saveQueryDevtoolsMock(
      mock({
        body: {
          get items() {
            reads++;

            return [];
          },
        },
      }),
    );

    const queryEntries = signal<QueryDevtoolsEntry[]>([secureEntry()]);
    const fixture = await render({ queryEntries });
    const measured = reads;

    expect(measured).toBeGreaterThan(0);

    queryEntries.set([secureEntry(), secureEntry()]);
    fixture.detectChanges();

    expect(reads).toBe(measured);
  });
});
