import { firstValueFrom, from, of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { tableCsvRowsFromPages } from './table-csv-rows-from-pages';

type Row = { id: number };

const page = (from: number, count: number): Row[] => Array.from({ length: count }, (_, i) => ({ id: from + i }));

describe('tableCsvRowsFromPages', () => {
  it('walks pages until one comes back empty and concatenates them', async () => {
    const pages: Record<number, Row[]> = { 1: page(1, 2), 2: page(3, 2), 3: [] };
    const fetchPage = vi.fn((n: number) => Promise.resolve(pages[n] ?? []));

    await expect(firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage })()))).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
    ]);
    expect(fetchPage.mock.calls.map(([n]) => n)).toEqual([1, 2, 3]);
  });

  it('fetches one page at a time, in order', async () => {
    const inFlight: number[] = [];
    const fetchPage = vi.fn(async (n: number) => {
      inFlight.push(n);
      await Promise.resolve();

      // Each call must have finished before the next starts, so this is always the last one asked for.
      expect(inFlight.at(-1)).toBe(n);

      return n < 3 ? page(n, 1) : [];
    });

    await firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage })()));

    expect(inFlight).toEqual([1, 2, 3]);
  });

  it('takes a custom `hasMore`, so a backend that says so directly needs no empty trailing page', async () => {
    const fetchPage = vi.fn((n: number) => Promise.resolve(page(n, 1)));

    await expect(
      firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage, hasMore: (_, n) => n < 2 })())),
    ).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('starts at `initialPage`, for a 0-based API', async () => {
    const fetchPage = vi.fn((n: number) => Promise.resolve(n < 1 ? page(n, 1) : []));

    await firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage, initialPage: 0 })()));

    expect(fetchPage.mock.calls.map(([n]) => n)).toEqual([0, 1]);
  });

  it('stops at `maxPages` even when `hasMore` never gives up', async () => {
    const fetchPage = vi.fn((n: number) => Promise.resolve(page(n, 1)));

    await expect(firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage, maxPages: 3 })()))).resolves.toHaveLength(
      3,
    );
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('reads an observable page to its first emission', async () => {
    const fetchPage = vi.fn((n: number) => of(n < 2 ? page(n, 1) : []));

    await expect(firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage })()))).resolves.toEqual([{ id: 1 }]);
  });

  it('treats an observable page that completes without emitting as the end', async () => {
    const empty = new Subject<Row[]>();
    const fetchPage = vi.fn(() => empty);
    const rows = firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage })()));

    empty.complete();

    await expect(rows).resolves.toEqual([]);
  });

  it('lets a failing page reject rather than writing a short file', async () => {
    const fetchPage = vi.fn((n: number) => (n === 1 ? Promise.resolve(page(1, 1)) : Promise.reject(new Error('502'))));

    await expect(firstValueFrom(from(tableCsvRowsFromPages<Row>({ fetchPage })()))).rejects.toThrow('502');
  });
});
