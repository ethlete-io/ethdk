import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { resolveQueryHeaders } from './query-headers';

describe('resolveQueryHeaders', () => {
  it('returns undefined without headers', () => {
    expect(resolveQueryHeaders(undefined)).toBeUndefined();
  });

  it('returns the same HttpHeaders instance', () => {
    const headers = new HttpHeaders({ 'X-Tenant': 'one' });

    expect(resolveQueryHeaders(headers)).toBe(headers);
  });

  it('converts a record, including multi-value headers', () => {
    const headers = resolveQueryHeaders({ 'X-Tenant': 'one', Accept: ['a', 'b'] });

    expect(headers?.get('X-Tenant')).toBe('one');
    expect(headers?.getAll('Accept')).toEqual(['a', 'b']);
  });

  it('calls a function on every resolve', () => {
    let token = 'a';
    const input = () => ({ 'X-Api-Token': token });

    expect(resolveQueryHeaders(input)?.get('X-Api-Token')).toBe('a');
    token = 'b';
    expect(resolveQueryHeaders(input)?.get('X-Api-Token')).toBe('b');
  });
});
