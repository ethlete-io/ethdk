import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AnyNewQuery,
  AnyPagedQueryStack,
  AnyQueryBatch,
  AnyQueryGroup,
  HttpRequestLoadingState,
  QuerySequence,
} from '@ethlete/query';
import '../../../test-helpers';
import { ButtonComponent } from '../button.component';
import { QueryButtonDirective, QueryButtonSource } from './query-button.directive';

const loadingState = (percentage?: number): HttpRequestLoadingState => ({
  executeTime: 0,
  progress:
    percentage === undefined ? null : { total: 100, loaded: percentage, percentage, speed: null, remainingTime: null },
});

@Component({
  template: `<button
    [etQueryButton]="source()"
    [showProgress]="showProgress()"
    [loading]="loading()"
    (click)="clicks.update((count) => count + 1)"
    et-button
  >
    Save
  </button>`,
  imports: [ButtonComponent, QueryButtonDirective],
})
class QueryButtonTestHost {
  source = signal<QueryButtonSource | null>(null);
  showProgress = signal(true);
  loading = signal(false);
  clicks = signal(0);
}

describe('QueryButtonDirective', () => {
  let fixture: ComponentFixture<QueryButtonTestHost>;
  let host: QueryButtonTestHost;
  let button: HTMLButtonElement;

  const spinner = () => button.querySelector('et-spinner');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [QueryButtonTestHost] });
    fixture = TestBed.createComponent(QueryButtonTestHost);
    host = fixture.componentInstance;
    button = fixture.nativeElement.querySelector('button');
  });

  it('accepts every v3 query shape without a wrapper', () => {
    expectTypeOf<AnyNewQuery>().toExtend<QueryButtonSource>();
    expectTypeOf<AnyPagedQueryStack>().toExtend<QueryButtonSource>();
    expectTypeOf<AnyQueryBatch>().toExtend<QueryButtonSource>();
    expectTypeOf<QuerySequence<[unknown]>>().toExtend<QueryButtonSource>();
    expectTypeOf<AnyQueryGroup>().toExtend<QueryButtonSource>();
  });

  it('stays idle without a source', () => {
    fixture.detectChanges();

    expect(button.hasAttribute('data-loading')).toBe(false);
    expect(button.hasAttribute('aria-busy')).toBe(false);
    expect(spinner()).toBeNull();
  });

  describe('with a query loading source', () => {
    const loading = signal<HttpRequestLoadingState | null>(null);

    beforeEach(() => {
      loading.set(null);
      host.source.set({ loading });
    });

    it('stays idle while the query is not loading', () => {
      fixture.detectChanges();

      expect(button.hasAttribute('data-loading')).toBe(false);
      expect(spinner()).toBeNull();
    });

    it('puts the button into its loading state while the query loads', () => {
      loading.set(loadingState());
      fixture.detectChanges();

      expect(button.getAttribute('data-loading')).toBe('true');
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(spinner()?.classList.contains('et-spinner--determinate')).toBe(false);
    });

    it('blocks a click while the query loads', () => {
      loading.set(loadingState());
      fixture.detectChanges();

      button.click();

      expect(host.clicks()).toBe(0);
    });

    it('lets a click through once the query settles', () => {
      loading.set(loadingState());
      fixture.detectChanges();
      loading.set(null);
      fixture.detectChanges();

      button.click();

      expect(host.clicks()).toBe(1);
      expect(button.hasAttribute('data-loading')).toBe(false);
    });

    it('shows the query progress on a determinate spinner', () => {
      loading.set(loadingState(40));
      fixture.detectChanges();

      expect(spinner()?.classList.contains('et-spinner--determinate')).toBe(true);
      expect(spinner()?.getAttribute('aria-valuenow')).toBe('40');
    });

    it('keeps the spinner indeterminate when showProgress is off', () => {
      host.showProgress.set(false);
      loading.set(loadingState(40));
      fixture.detectChanges();

      expect(button.getAttribute('data-loading')).toBe('true');
      expect(spinner()?.classList.contains('et-spinner--determinate')).toBe(false);
    });

    it('keeps the loading input working alongside the query', () => {
      host.loading.set(true);
      fixture.detectChanges();

      expect(button.getAttribute('data-loading')).toBe('true');

      button.click();

      expect(host.clicks()).toBe(0);
    });
  });

  it('accepts a boolean loading signal, as a paged query stack exposes', () => {
    const loading = signal(true);

    host.source.set({ loading });
    fixture.detectChanges();

    expect(button.getAttribute('data-loading')).toBe('true');
    expect(spinner()?.classList.contains('et-spinner--determinate')).toBe(false);
  });

  it('reads running and progress, as a batch or a sequence exposes', () => {
    const running = signal(true);
    const progress = signal(25);

    host.source.set({ running, progress });
    fixture.detectChanges();

    expect(button.getAttribute('data-loading')).toBe('true');
    expect(spinner()?.getAttribute('aria-valuenow')).toBe('25');

    running.set(false);
    fixture.detectChanges();

    expect(button.hasAttribute('data-loading')).toBe(false);
  });
});
