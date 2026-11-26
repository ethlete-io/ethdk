import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { QueryDevtoolsCacheTabComponent } from './query-devtools-cache-tab.component';
import { QUERY_DEVTOOLS_HOST, QueryDevtoolsHost } from './query-devtools-host';
import { createQueryDevtoolsTestHost } from './testing/query-devtools-test-host';
import { DroppedCacheEntry } from './query-devtools-types';

const dropped = (url: string): DroppedCacheEntry => ({ client: 'api', method: 'GET', url, cause: 'unbind', at: 1_000 });

describe('QueryDevtoolsCacheTabComponent', () => {
  it('should list entries dropped in the same millisecond without a duplicate-key warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cacheView = signal([
      { name: 'api', baseUrl: '', rows: [], unused: 0, client: null, dropped: [dropped('/a'), dropped('/b')] },
    ]);

    TestBed.configureTestingModule({
      imports: [QueryDevtoolsCacheTabComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: QUERY_DEVTOOLS_HOST,
          useValue: createQueryDevtoolsTestHost({
            cacheView,
            clientFeatures: () => null,
            requestPath: (url: string) => url,
            formatTime: () => '',
          } as unknown as Partial<QueryDevtoolsHost>),
        },
      ],
    });

    const fixture = TestBed.createComponent(QueryDevtoolsCacheTabComponent);
    await fixture.whenStable();

    const kept = cacheView()[0]?.dropped ?? [];

    cacheView.set([{ name: 'api', baseUrl: '', rows: [], unused: 0, client: null, dropped: [dropped('/c'), ...kept] }]);
    await fixture.whenStable();

    const urls = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.et-query-devtools-dropped .et-query-devtools-url'),
    ];

    expect(urls.map((url) => url.textContent)).toEqual(['/c', '/a', '/b']);
    expect(warn.mock.calls.flat().join(' ')).not.toContain('NG0955');

    warn.mockRestore();
  });
});
