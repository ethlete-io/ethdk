import { TestBed } from '@angular/core/testing';
import { RequestError } from '@ethlete/query';
import { QueryErrorComponent } from './query-error.component';

const renderError = (detail: unknown, status = 400) => {
  const fixture = TestBed.createComponent(QueryErrorComponent);
  const error = { url: '/x', status, statusText: 'Bad Request', detail } as RequestError;
  fixture.componentRef.setInput('error', error);
  fixture.componentRef.setInput('query', null);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

describe('QueryErrorComponent', () => {
  it.each([
    ['an empty violation list', { violations: [] }],
    ['an empty class-validator message list', { statusCode: 400, error: 'Bad Request', message: [] }],
  ])('falls back to the default message for %s', (_name, detail) => {
    const element = renderError(detail);

    expect(element.querySelector('.et-query-error-message')?.textContent).toContain('(Code: 400)');
  });
});
