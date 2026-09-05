import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  clearQueryDevtoolsMockStore,
  QueryDevtoolsEntry,
  QueryDevtoolsMock,
  queryDevtoolsMockId,
  saveQueryDevtoolsMock,
} from '@ethlete/query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUERY_DEVTOOLS_HOST } from './query-devtools-host';
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

const render = async () => {
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
        }),
      },
    ],
  });

  const fixture = TestBed.createComponent(QueryDevtoolsMocksTabComponent);
  await fixture.whenStable();

  return fixture;
};

const noAuthChips = (fixture: { nativeElement: HTMLElement }) =>
  Array.from(fixture.nativeElement.querySelectorAll('.et-query-devtools-chip')).filter(
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
    const button = Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.includes('TS') === true,
    );

    button?.click();
    await fixture.whenStable();

    expect(button?.textContent).toContain('Copied');

    await new Promise((resolve) => setTimeout(resolve, QUERY_DEVTOOLS_COPIED_RESET_MS + 100));
    await fixture.whenStable();

    expect(button?.textContent).not.toContain('Copied');
    expect(button?.textContent).toContain('TS');
  });
});
