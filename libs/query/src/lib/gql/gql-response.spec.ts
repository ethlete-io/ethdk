import { HttpErrorResponse } from '@angular/common/http';
import { unwrapGqlResponse, unwrapGqlResponseWithErrors } from './gql-response';

describe('gql response', () => {
  const error = { message: 'Forbidden', path: ['user', 0, 'email'], extensions: { code: 'FORBIDDEN' } };

  it('unwraps data and drops errors sent next to partial data', () => {
    expect(unwrapGqlResponse({ data: { user: { id: 1 } }, errors: [error] })).toEqual({ user: { id: 1 } });
  });

  it('keeps errors next to partial data when asked to', () => {
    expect(unwrapGqlResponseWithErrors({ data: { user: null }, errors: [error] })).toEqual({
      data: { user: null },
      errors: [error],
    });
  });

  it('reports no errors as an empty list, also when the server sends a non-array errors field', () => {
    expect(unwrapGqlResponseWithErrors({ data: { a: 1 } }).errors).toEqual([]);
    expect(unwrapGqlResponseWithErrors({ data: { a: 1 }, errors: 'nope' as never }).errors).toEqual([]);
  });

  it.each([null, undefined])('throws the server errors as an HttpErrorResponse when data is %s', (data) => {
    let thrown: unknown;

    try {
      unwrapGqlResponse({ data, errors: [error] });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(HttpErrorResponse);
    expect((thrown as HttpErrorResponse).error).toEqual([error]);
  });

  it('throws the server errors when the response carries errors and no data property', () => {
    expect(() => unwrapGqlResponse({ errors: [error] })).toThrow(HttpErrorResponse);
  });

  it.each([null, 'text', 1, {}])('throws ET601 for a response without data: %j', (raw) => {
    expect(() => unwrapGqlResponse(raw)).toThrow(/data/);
  });

  it('passes a null data through when the server sent no errors', () => {
    expect(unwrapGqlResponse({ data: null })).toBeNull();
    expect(unwrapGqlResponse({ data: null, errors: [] })).toBeNull();
  });
});
