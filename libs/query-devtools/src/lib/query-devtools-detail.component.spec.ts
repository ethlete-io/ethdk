import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { QueryDevtoolsDetailComponent } from './query-devtools-detail.component';
import { QUERY_DEVTOOLS_HOST } from './query-devtools-host';
import { createQueryDevtoolsTestHost } from './testing/query-devtools-test-host';
import { QueryDevtoolsSelection } from './query-devtools-types';

const selection = (id: string) => ({ entry: { id }, query: { id } }) as unknown as QueryDevtoolsSelection;

describe('QueryDevtoolsDetailComponent', () => {
  it('should fold the older runs again when another query is selected', () => {
    TestBed.configureTestingModule({
      imports: [QueryDevtoolsDetailComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: QUERY_DEVTOOLS_HOST, useValue: createQueryDevtoolsTestHost() },
      ],
    });
    TestBed.overrideComponent(QueryDevtoolsDetailComponent, { set: { template: '', imports: [] } });

    const fixture = TestBed.createComponent(QueryDevtoolsDetailComponent);
    const detail = fixture.componentInstance;

    fixture.componentRef.setInput('sel', selection('a'));
    detail['foldedRunsOpen'].set(true);

    fixture.componentRef.setInput('sel', selection('b'));

    expect(detail['foldedRunsOpen']()).toBe(false);
  });
});
