import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColorTheme, injectLocale, provideColorThemesWithTailwind4 } from '@ethlete/core';
import { QueryErrorResponse, createQueryErrorResponse } from '@ethlete/query';
import '../../test-helpers';
import { QueryErrorDirective } from './headless';
import { queryErrorResponseFromLegacyError } from './query-error-legacy';
import { QueryErrorComponent } from './query-error.component';
import { QUERY_ERROR_IMPORTS } from './query-error.imports';

/** The component needs *a* theme registered with `type: 'error'` - the name is the app's business. */
const COLOR_THEMES: ColorTheme[] = [
  {
    name: 'danger',
    type: 'error',
    primary: { color: { default: '220 38 38' }, onColor: { default: '255 255 255' } },
  },
];

const errorResponse = (status: number, body: unknown): QueryErrorResponse =>
  createQueryErrorResponse(new HttpErrorResponse({ error: body, status, statusText: 'x', url: '/x' }));

@Component({
  selector: 'et-test-query-error-host',
  template: `
    @if (error(); as err) {
      <et-query-error [error]="err" [query]="query" [alwaysAllowRetry]="alwaysAllowRetry()" />
    }
  `,
  imports: [QUERY_ERROR_IMPORTS],
})
class QueryErrorHostComponent {
  public queryError = viewChild(QueryErrorComponent, { read: QueryErrorDirective });

  public error = signal<QueryErrorResponse | null>(null);
  public alwaysAllowRetry = signal(false);

  public executions: unknown[] = [];
  public query = { execute: (args?: unknown) => this.executions.push(args) };
}

const createHost = (): ComponentFixture<QueryErrorHostComponent> => {
  TestBed.configureTestingModule({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  const fixture = TestBed.createComponent(QueryErrorHostComponent);
  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<QueryErrorHostComponent>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<QueryErrorHostComponent>, selector: string) =>
  host(fixture).querySelector(selector)?.textContent?.trim() ?? null;

describe('QueryErrorComponent', () => {
  it('renders nothing without an error', () => {
    const fixture = createHost();

    expect(host(fixture).querySelector('.et-query-error')).toBeNull();
  });

  it('renders a title from the status and the response message', () => {
    const fixture = createHost();

    fixture.componentInstance.error.set(errorResponse(404, { message: 'No such user' }));
    fixture.detectChanges();

    expect(text(fixture, '.et-query-error-title')).toBe('Not found');
    expect(text(fixture, '.et-query-error-message')).toBe('No such user');
    expect(host(fixture).querySelector('.et-query-error')?.getAttribute('role')).toBe('alert');
  });

  it('renders a violation list as a list', () => {
    const fixture = createHost();

    fixture.componentInstance.error.set(
      errorResponse(422, { violations: [{ message: 'Name is required' }, { message: 'Email is invalid' }] }),
    );
    fixture.detectChanges();

    expect(
      [...host(fixture).querySelectorAll('.et-query-error-list-item')].map((li) => li.textContent?.trim()),
    ).toEqual(['Name is required', 'Email is invalid']);
    expect(host(fixture).querySelector('.et-query-error-message')).toBeNull();
    expect(host(fixture).querySelector('.et-query-error')?.hasAttribute('data-list')).toBe(true);
  });

  it('replaces a message that merely repeats its own title', () => {
    const fixture = createHost();

    // An API answering 404 with "Not found" would otherwise render the same two words twice.
    fixture.componentInstance.error.set(errorResponse(404, { message: 'Not found.' }));
    fixture.detectChanges();

    expect(text(fixture, '.et-query-error-title')).toBe('Not found');
    expect(text(fixture, '.et-query-error-message')).toContain('Code: 404');
  });

  it('falls back to the status message when the response carries none', () => {
    const fixture = createHost();

    fixture.componentInstance.error.set(errorResponse(500, null));
    fixture.detectChanges();

    expect(text(fixture, '.et-query-error-message')).toContain('Code: 500');
  });

  describe('retrying', () => {
    it('offers no retry for a failure the policy considers final', () => {
      const fixture = createHost();

      fixture.componentInstance.error.set(errorResponse(404, { message: 'No such user' }));
      fixture.detectChanges();

      expect(fixture.componentInstance.queryError()?.canRetry()).toBe(false);
      expect(host(fixture).querySelector('.et-query-error-actions')).toBeNull();
    });

    it('offers a retry for a failure the policy would repeat, and bypasses the cache', () => {
      const fixture = createHost();

      fixture.componentInstance.error.set(errorResponse(503, { message: 'Try later' }));
      fixture.detectChanges();

      const button = host(fixture).querySelector<HTMLButtonElement>('.et-query-error-actions button');

      expect(button?.textContent?.trim()).toBe('Retry');

      button?.click();

      expect(fixture.componentInstance.executions).toEqual([{ options: { allowCache: false } }]);
    });

    it('offers a retry regardless when asked to', () => {
      const fixture = createHost();

      fixture.componentInstance.alwaysAllowRetry.set(true);
      fixture.componentInstance.error.set(errorResponse(404, { message: 'No such user' }));
      fixture.detectChanges();

      expect(host(fixture).querySelector('.et-query-error-actions button')).toBeTruthy();
    });
  });

  it('uses the German labels for a German locale', () => {
    const fixture = createHost();

    TestBed.runInInjectionContext(() => injectLocale().currentLocale.set('de-DE'));

    fixture.componentInstance.error.set(errorResponse(503, { message: 'Später versuchen' }));
    fixture.detectChanges();

    expect(text(fixture, '.et-query-error-title')).toBe('Dienst nicht verfügbar');
    expect(text(fixture, '.et-query-error-actions button')).toBe('Erneut versuchen');
  });
});

describe('queryErrorResponseFromLegacyError', () => {
  it('classifies a legacy error through the current client normalizer', () => {
    const httpErrorResponse = new HttpErrorResponse({
      error: { violations: [{ message: 'a' }, { message: 'b' }] },
      status: 422,
      statusText: 'Unprocessable',
      url: '/x',
    });

    const converted = queryErrorResponseFromLegacyError({
      url: '/x',
      status: 422,
      statusText: 'Unprocessable',
      detail: httpErrorResponse.error,
      httpErrorResponse,
    });

    expect(converted.code).toBe(422);
    expect(converted.isList).toBe(true);
    expect(converted.isList && converted.errors.map((e) => e.message)).toEqual(['a', 'b']);
  });
});
