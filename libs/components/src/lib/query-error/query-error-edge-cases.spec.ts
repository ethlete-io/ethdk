import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4 } from '@ethlete/core';
import {
  QueryErrorResponse,
  createQueryErrorResponse,
  registerQueryErrorParser,
  setDefaultQueryRetryFn,
  shouldRetryRequest,
  symfonyQueryErrorParser,
} from '@ethlete/query';
import '../../test-helpers';
import { testColorSwatch } from '../testing/color-themes';
import { QueryErrorDirective } from './headless';
import { QUERY_ERROR_IMPORTS } from './query-error.imports';

registerQueryErrorParser(symfonyQueryErrorParser);
setDefaultQueryRetryFn(shouldRetryRequest);

const COLOR_THEMES: ColorTheme[] = [{ name: 'danger', type: 'error', primary: testColorSwatch('220 38 38') }];

const STATUS_500 = 'Something went wrong on our end. Please try again later. (Code: 500)';

const errorResponse = (status: number, body: unknown): QueryErrorResponse =>
  createQueryErrorResponse(new HttpErrorResponse({ error: body, status, statusText: 'x', url: '/x' }));

@Component({
  selector: 'et-test-query-error-edge-host',
  template: `<et-query-error [error]="error()" [query]="query()" (retryRequest)="retries = retries + 1" />`,
  imports: [QUERY_ERROR_IMPORTS],
})
class QueryErrorEdgeHostComponent {
  public error = signal<QueryErrorResponse | null>(null);
  public query = signal<{ execute: () => unknown } | null>(null);
  public retries = 0;
}

const createHost = (): ComponentFixture<QueryErrorEdgeHostComponent> => {
  TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  const fixture = TestBed.createComponent(QueryErrorEdgeHostComponent);
  fixture.detectChanges();

  return fixture;
};

const show = (fixture: ComponentFixture<QueryErrorEdgeHostComponent>, error: QueryErrorResponse | null) => {
  fixture.componentInstance.error.set(error);
  fixture.detectChanges();
};

const host = (fixture: ComponentFixture<QueryErrorEdgeHostComponent>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<QueryErrorEdgeHostComponent>, selector: string) =>
  host(fixture).querySelector(selector)?.textContent?.trim() ?? null;
const view = (fixture: ComponentFixture<QueryErrorEdgeHostComponent>) =>
  fixture.debugElement.children[0]!.injector.get(QueryErrorDirective).view();

describe('QueryErrorDirective edge cases', () => {
  it('renders nothing for a bound null, and clears the status attributes', () => {
    const fixture = createHost();
    const element = host(fixture).querySelector('et-query-error')!;

    expect(element.querySelector('et-banner')).toBeNull();
    expect(element.hasAttribute('data-status')).toBe(false);

    show(fixture, errorResponse(500, { message: 'Boom' }));
    expect(element.getAttribute('data-status')).toBe('500');

    show(fixture, null);
    expect(element.querySelector('et-banner')).toBeNull();
    expect(element.hasAttribute('data-status')).toBe(false);
  });

  it('falls back to the status message for an empty string body', () => {
    const fixture = createHost();

    show(fixture, errorResponse(500, ''));

    expect(view(fixture)?.messages).toEqual([STATUS_500]);
  });

  it('falls back to the status message for a whitespace-only message', () => {
    const fixture = createHost();

    show(fixture, errorResponse(500, { message: '   ' }));

    expect(text(fixture, '.et-query-error-message')).toBe(STATUS_500);
  });

  it('drops blank entries from a violation list instead of rendering empty bullets', () => {
    const fixture = createHost();

    show(fixture, errorResponse(422, ['Name is required', '', 'Email is invalid']));

    expect(view(fixture)?.messages).toEqual(['Name is required', 'Email is invalid']);
  });

  it('renders a list that is all blank as the status message', () => {
    const fixture = createHost();

    show(fixture, errorResponse(422, ['', ' ']));

    expect(view(fixture)?.isList).toBe(false);
    expect(host(fixture).querySelector('.et-query-error-list')).toBeNull();
  });

  it('describes a failure that never reached a server as status 0', () => {
    const fixture = createHost();

    show(fixture, createQueryErrorResponse(new Error('offline')));

    expect(view(fixture)?.status).toBe(0);
    expect(text(fixture, '.et-query-error-title')).toBeTruthy();
    expect(text(fixture, '.et-query-error-message')).not.toContain('Http failure');
  });

  it('renders a hand-built list error with no entries as the status message', () => {
    const fixture = createHost();
    const base = errorResponse(500, null);

    show(fixture, { raw: base.raw, retryState: base.retryState, code: 500, isList: true, errors: [] });

    expect(view(fixture)?.messages).toEqual([STATUS_500]);
  });

  it('reports no retry delay for an error the policy would not retry', () => {
    const fixture = createHost();

    show(fixture, errorResponse(404, null));

    expect(view(fixture)?.canRetry).toBe(false);
    expect(view(fixture)?.retryDelay).toBe(0);
  });

  it('still emits a retry without a query to run', () => {
    const fixture = createHost();

    show(fixture, errorResponse(503, null));
    host(fixture).querySelector<HTMLButtonElement>('.et-query-error-actions button')!.click();

    expect(fixture.componentInstance.retries).toBe(1);
  });
});
