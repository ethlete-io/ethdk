import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { clearQueryDevtoolsTokenTtl } from '@ethlete/query';
import {
  QUERY_DEVTOOLS_TOKEN_TTL_LIMIT,
  QueryDevtoolsAuthSession,
  QueryDevtoolsEntry,
} from '@ethlete/query/devtools-contract';
import { describe, expect, it } from 'vitest';
import { QueryDevtoolsAuthTabComponent } from './query-devtools-auth-tab.component';
import { QUERY_DEVTOOLS_HOST } from './query-devtools-host';
import { createQueryDevtoolsTestHost } from './testing/query-devtools-test-host';

describe('QueryDevtoolsAuthTabComponent', () => {
  it('should age a session and expire its token as the panel clock advances', async () => {
    const clock = signal(10_000);

    TestBed.configureTestingModule({
      imports: [QueryDevtoolsAuthTabComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: QUERY_DEVTOOLS_HOST,
          useValue: createQueryDevtoolsTestHost({ clock, authEntries: signal([]) }),
        },
      ],
    });

    const fixture = TestBed.createComponent(QueryDevtoolsAuthTabComponent);
    await fixture.whenStable();

    const tab = fixture.componentInstance;
    const session = { savedAt: 10_000, expiresAt: 15 } as QueryDevtoolsAuthSession;

    expect(tab['sessionAge'](session)).toBe('0s ago');
    expect(tab['isExpired'](session)).toBe(false);

    clock.set(Date.now() + 60 * 60 * 1000);

    expect(tab['sessionAge'](session)).not.toBe('0s ago');
    expect(tab['isExpired'](session)).toBe(true);
  });

  it('should put a rejected session name and a clamped lifetime back into their inputs', async () => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsAuthTabComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: QUERY_DEVTOOLS_HOST, useValue: createQueryDevtoolsTestHost({ authEntries: signal([]) }) },
      ],
    });

    const fixture = TestBed.createComponent(QueryDevtoolsAuthTabComponent);
    await fixture.whenStable();

    const tab = fixture.componentInstance;
    const input = document.createElement('input');

    input.value = '   ';
    tab['rename']({ id: 's1', label: 'Admin' } as QueryDevtoolsAuthSession, input);

    expect(input.value).toBe('Admin');

    const entry = { meta: { name: 'auth-tab-spec' } } as QueryDevtoolsEntry;

    input.value = String(QUERY_DEVTOOLS_TOKEN_TTL_LIMIT + 100);
    tab['armTokenTtl']({ entry, input });

    expect(input.value).toBe(String(QUERY_DEVTOOLS_TOKEN_TTL_LIMIT));

    clearQueryDevtoolsTokenTtl('auth-tab-spec');
  });
});
