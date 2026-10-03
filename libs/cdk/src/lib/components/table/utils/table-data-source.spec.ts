import { Subject } from 'rxjs';
import { SortDirective } from '../../sort/partials/sort';
import { TableDataSourcePageEvent, TableDataSourcePaginator } from '../types';
import { TableDataSource } from './table-data-source';

type Row = { name: string | null; score: number | string | null | undefined };

const createPaginator = (pageIndex: number, pageSize: number): TableDataSourcePaginator => ({
  page: new Subject<TableDataSourcePageEvent>(),
  initialized: new Subject<void>(),
  pageIndex,
  pageSize,
  length: 0,
  firstPage: () => undefined,
  lastPage: () => undefined,
});

const sortBy = (active: string, direction: 'asc' | 'desc' | '') => ({ active, direction }) as unknown as SortDirective;

describe('TableDataSource', () => {
  it('treats a non-array data value as empty', () => {
    const source = new TableDataSource<Row>();

    source.data = null as unknown as Row[];

    expect(source.data).toEqual([]);
  });

  it('sorts numeric strings numerically and puts nullish values first when ascending', () => {
    const source = new TableDataSource<Row>();
    const rows: Row[] = [
      { name: 'a', score: '10' },
      { name: 'b', score: null },
      { name: 'c', score: 9 },
      { name: 'd', score: undefined },
    ];

    expect(source.sortData(rows.slice(), sortBy('score', 'asc')).map((row) => row.name)).toEqual(['b', 'd', 'c', 'a']);
    expect(
      source
        .sortData(rows.slice(), sortBy('score', 'desc'))
        .map((row) => row.name)
        .slice(0, 2),
    ).toEqual(['a', 'c']);
  });

  it('leaves the order alone without an active sort or direction', () => {
    const source = new TableDataSource<Row>();
    const rows: Row[] = [
      { name: 'b', score: 2 },
      { name: 'a', score: 1 },
    ];

    expect(source.sortData(rows, sortBy('score', ''))).toBe(rows);
    expect(source.sortData(rows, sortBy('', 'asc'))).toBe(rows);
  });

  it('matches a filter case-insensitively and ignores surrounding whitespace', () => {
    const source = new TableDataSource<Row>([
      { name: 'Ada', score: 1 },
      { name: 'Grace', score: 2 },
    ]);
    source.disconnect();

    source.filter = '  ADA ';

    expect(source.filteredData.map((row) => row.name)).toEqual(['Ada']);
  });

  it('pages the rendered data', () => {
    const source = new TableDataSource<Row>(Array.from({ length: 5 }, (_, i) => ({ name: `${i}`, score: i })));
    source.paginator = createPaginator(1, 2);

    expect(source._pageData(source.data).map((row) => row.name)).toEqual(['2', '3']);
  });

  it('moves the page index back to the last page when the filter shrinks the data', async () => {
    const source = new TableDataSource<Row>(Array.from({ length: 10 }, (_, i) => ({ name: `row${i}`, score: i })));
    const paginator = createPaginator(4, 2);
    source.paginator = paginator;

    source.filter = 'row1';
    await Promise.resolve();

    expect(paginator.length).toBe(1);
    expect(paginator.pageIndex).toBe(0);
  });

  it('never moves the page index below zero when the filter matches nothing', async () => {
    const source = new TableDataSource<Row>(Array.from({ length: 10 }, (_, i) => ({ name: `row${i}`, score: i })));
    const paginator = createPaginator(3, 2);
    source.paginator = paginator;

    source.filter = 'no match';
    await Promise.resolve();

    expect(paginator.length).toBe(0);
    expect(paginator.pageIndex).toBe(0);
  });
});
