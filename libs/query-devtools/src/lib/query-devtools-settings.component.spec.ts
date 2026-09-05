import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { QUERY_DEVTOOLS_HOST } from './query-devtools-host';
import { QueryDevtoolsSettingsComponent } from './query-devtools-settings.component';
import { createQueryDevtoolsTestHost } from './testing/query-devtools-test-host';
import { EventLogItem } from './query-devtools-types';

const eventRow = (client: string, id: number): EventLogItem => ({
  id,
  timestamp: 0,
  client,
  type: 'request-success',
  method: 'GET',
  url: `${client}/thing`,
  isSecure: false,
  status: 200,
  queryId: null,
  cause: null,
  destroyCause: null,
  refreshed: null,
  durationMs: null,
  bytes: null,
  isEstimatedBytes: false,
});

const clientOptions = (fixture: ComponentFixture<QueryDevtoolsSettingsComponent>) => {
  const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
    'select[aria-label="Event log client"]',
  );

  return Array.from(select?.options ?? []).map((option) => option.value);
};

describe('QueryDevtoolsSettingsComponent', () => {
  const eventClient = signal<string | null>(null);

  beforeEach(() => {
    eventClient.set(null);

    TestBed.configureTestingModule({
      imports: [QueryDevtoolsSettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: QUERY_DEVTOOLS_HOST,
          useValue: createQueryDevtoolsTestHost({
            eventClient,
            eventLog: signal([eventRow('https://api.example.com', 1), eventRow('https://cms.example.com', 2)]),
            clientNames: signal(['Main API', 'CMS']),
          }),
        },
      ],
    });
  });

  it('should offer the Events picker the same client key the log stores', async () => {
    const fixture = TestBed.createComponent(QueryDevtoolsSettingsComponent);
    await fixture.whenStable();

    expect(clientOptions(fixture)).toEqual(['', 'https://api.example.com', 'https://cms.example.com']);
  });

  it('should keep the picked client selected instead of snapping back to all clients', async () => {
    eventClient.set('https://cms.example.com');

    const fixture = TestBed.createComponent(QueryDevtoolsSettingsComponent);
    await fixture.whenStable();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      'select[aria-label="Event log client"]',
    );

    expect(select?.value).toBe('https://cms.example.com');
  });
});
