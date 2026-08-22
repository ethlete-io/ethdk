import { Component, Type, signal } from '@angular/core';
import { QueryTestSetup, setupQueryTest } from '@ethlete/query/testing';
import '../../test-helpers';
import { mountControl } from '../testing/control-driver';
import { tick } from '../testing/driver-core';
import { filterOverlayPreviewFromQuery } from './filter-overlay-preview';

type Draft = { region: string };
type SearchArgs = { queryParams: { region: string }; response: { totalHits: number } };
type CountArgs = { queryParams: { region: string }; response: { count: number } };

let query!: QueryTestSetup;

@Component({ template: '', selector: 'et-filter-overlay-preview-test-host' })
class PreviewTestHost {
  public draftValue = signal<Draft>({ region: '' });

  public preview = filterOverlayPreviewFromQuery({
    queryCreator: query.createGet<SearchArgs>('/search'),
    args: (value: Draft) => (value.region ? { queryParams: { region: value.region } } : null),
  })(this.draftValue);
}

@Component({ template: '', selector: 'et-filter-overlay-preview-custom-total-hits-test-host' })
class CustomTotalHitsTestHost {
  public draftValue = signal<Draft>({ region: 'eu' });

  public preview = filterOverlayPreviewFromQuery({
    queryCreator: query.createGet<CountArgs>('/search'),
    args: (value: Draft) => ({ queryParams: { region: value.region } }),
    toTotalHits: (response) => response.count,
  })(this.draftValue);
}

const mount = <T>(component: Type<T>) =>
  mountControl(component, [], () => {
    query = setupQueryTest();
  });

describe('filterOverlayPreviewFromQuery', () => {
  afterEach(() => query.httpTesting.verify());

  it('stays empty and idle while the draft is not worth counting', () => {
    const fixture = mount(PreviewTestHost);
    const { preview } = fixture.componentInstance;

    query.httpTesting.expectNone(() => true);
    expect(preview.loading()).toBe(false);
    expect(preview.hasError()).toBe(false);
    expect(preview.totalHits()).toBeNull();
  });

  it('counts the draft filters through the query response', () => {
    const fixture = mount(PreviewTestHost);
    const { preview, draftValue } = fixture.componentInstance;

    draftValue.set({ region: 'eu' });
    tick();

    expect(preview.loading()).toBe(true);

    query.httpTesting.expectOne((req) => req.url.includes('/search')).flush({ totalHits: 42 });
    tick();

    expect(preview.loading()).toBe(false);
    expect(preview.hasError()).toBe(false);
    expect(preview.totalHits()).toBe(42);
  });

  it('re-executes as the draft keeps changing', () => {
    const fixture = mount(PreviewTestHost);
    const { preview, draftValue } = fixture.componentInstance;

    draftValue.set({ region: 'eu' });
    tick();
    query.httpTesting.expectOne((req) => req.url.includes('/search')).flush({ totalHits: 42 });
    tick();
    expect(preview.totalHits()).toBe(42);

    draftValue.set({ region: 'us' });
    tick();

    expect(preview.loading()).toBe(true);

    query.httpTesting.expectOne((req) => req.url.includes('/search')).flush({ totalHits: 7 });
    tick();

    expect(preview.totalHits()).toBe(7);
  });

  it('surfaces a failed count as an error, not a total', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const fixture = mount(PreviewTestHost);
    const { preview, draftValue } = fixture.componentInstance;

    draftValue.set({ region: 'eu' });
    tick();
    query.httpTesting
      .expectOne((req) => req.url.includes('/search'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    tick();

    expect(preview.loading()).toBe(false);
    expect(preview.hasError()).toBe(true);
    expect(preview.totalHits()).toBeNull();
  });

  it('reads the count through a custom toTotalHits', () => {
    const fixture = mount(CustomTotalHitsTestHost);
    const { preview } = fixture.componentInstance;

    tick();
    query.httpTesting.expectOne((req) => req.url.includes('/search')).flush({ count: 9 });
    tick();

    expect(preview.totalHits()).toBe(9);
  });

  it('warns and stays null when the response has no totalHits and no toTotalHits was given', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const fixture = mount(PreviewTestHost);
    const { preview, draftValue } = fixture.componentInstance;

    draftValue.set({ region: 'eu' });
    tick();
    query.httpTesting.expectOne((req) => req.url.includes('/search')).flush({ count: 9 } as never);
    tick();

    expect(preview.totalHits()).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[filterOverlayPreviewFromQuery]'),
      expect.anything(),
    );
  });
});
