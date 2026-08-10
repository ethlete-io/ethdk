import { HttpHeaders } from '@angular/common/http';
import { exoticOf, headerEntries, isHeadersValue } from './query-devtools-exotic';

describe('exoticOf', () => {
  it('should read the headers an HttpHeaders holds, not its private fields', () => {
    const headers = new HttpHeaders({ 'x-tenant': 'fc27', authorization: 'Bearer abc' });

    expect(exoticOf(headers)).toEqual({
      typeName: 'HttpHeaders',
      entries: [
        { k: 'x-tenant', v: 'fc27' },
        { k: 'authorization', v: 'Bearer abc' },
      ],
    });
  });

  it('should join a repeated header the way the wire format does', () => {
    expect(headerEntries(new HttpHeaders({ 'x-trace': ['one', 'two'] }))).toEqual([{ k: 'x-trace', v: 'one, two' }]);
  });

  it('should read a Map and a Set, which Object.entries reports as empty', () => {
    expect(Object.entries(new Map([['a', 1]]))).toEqual([]);

    expect(exoticOf(new Map([['a', 1]]))).toEqual({ typeName: 'Map', entries: [{ k: 'a', v: 1 }] });
    expect(exoticOf(new Set(['x', 'y']))).toEqual({
      typeName: 'Set',
      entries: [
        { k: '0', v: 'x' },
        { k: '1', v: 'y' },
      ],
    });
  });

  it('should render a Date as a leaf holding its ISO value', () => {
    expect(exoticOf(new Date('2026-01-31T09:00:00.000Z'))).toEqual({
      typeName: 'Date',
      display: '2026-01-31T09:00:00.000Z',
    });
  });

  it('should not crash on an invalid Date', () => {
    expect(exoticOf(new Date('nonsense'))).toEqual({ typeName: 'Date', display: 'Invalid Date' });
  });

  it('should name a function rather than dumping its source', () => {
    const headerProvider = () => new HttpHeaders();

    expect(exoticOf(headerProvider)).toEqual({ typeName: 'fn', display: 'headerProvider' });
    expect(exoticOf(() => 1)).toEqual({ typeName: 'fn', display: 'anonymous' });
  });

  it('should expand a File into readable parts', () => {
    const file = new File(['abc'], 'report.pdf', { type: 'application/pdf' });
    const exotic = exoticOf(file);

    expect(exotic?.typeName).toBe('File');
    expect(exotic?.entries).toEqual(
      expect.arrayContaining([
        { k: 'name', v: 'report.pdf' },
        { k: 'size', v: 3 },
        { k: 'type', v: 'application/pdf' },
      ]),
    );
  });

  it('should read a FormData entry by entry', () => {
    const body = new FormData();

    body.append('scope', 'season');

    expect(exoticOf(body)).toEqual({ typeName: 'FormData', entries: [{ k: 'scope', v: 'season' }] });
  });

  it('should leave a plain object, an array and a primitive alone', () => {
    expect(exoticOf({ a: 1 })).toBeNull();
    expect(exoticOf([1, 2])).toBeNull();
    expect(exoticOf('text')).toBeNull();
    expect(exoticOf(null)).toBeNull();
    expect(exoticOf(undefined)).toBeNull();
  });
});

describe('isHeadersValue', () => {
  it('should accept an HttpHeaders and reject look-alikes', () => {
    expect(isHeadersValue(new HttpHeaders({ a: 'b' }))).toBe(true);
    expect(isHeadersValue({ keys: () => [], getAll: () => null })).toBe(false);
    expect(isHeadersValue({ a: 1 })).toBe(false);
    expect(isHeadersValue(null)).toBe(false);
  });
});
