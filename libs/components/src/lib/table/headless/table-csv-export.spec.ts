import { describe, expect, it } from 'vitest';
import { TableColumnDef } from '../table.types';
import { TableCsvSource, tableToCsv } from './table-csv-export';

type Row = {
  name: string;
  age: number;
  active: boolean;
  joined: Date;
  note: string | null;
  tags: string[];
};

const ROWS: Row[] = [
  {
    name: 'Ada',
    age: 36,
    active: true,
    joined: new Date('2020-01-02T03:04:05.000Z'),
    note: null,
    tags: ['a', 'b'],
  },
  {
    name: 'Grace',
    age: 45,
    active: false,
    joined: new Date('2021-06-07T08:09:10.000Z'),
    note: 'says "hi", loudly\nand often',
    tags: [],
  },
];

const COLUMNS: TableColumnDef<Row>[] = [
  { key: 'name', header: 'Name', value: (row) => row.name },
  { key: 'age', header: 'Age', value: (row) => row.age },
  { key: 'active', header: 'Active', value: (row) => row.active },
  { key: 'joined', header: 'Joined', value: (row) => row.joined },
  { key: 'note', header: 'Note', value: (row) => row.note },
  { key: 'tags', value: (row) => row.tags, exportValue: (row) => row.tags.join('|') },
];

const source = (config: Partial<TableCsvSource<Row>> = {}): TableCsvSource<Row> => ({
  rows: () => ROWS,
  visibleColumns: () => COLUMNS.slice(0, 3),
  allColumns: () => COLUMNS,
  ...config,
});

const lines = (csv: string) => csv.split('\r\n');

describe('tableToCsv', () => {
  it('writes a header row and one line per row, from the visible columns', () => {
    expect(lines(tableToCsv(source()))).toEqual(['Name,Age,Active', 'Ada,36,true', 'Grace,45,false']);
  });

  it('separates lines with CRLF', () => {
    expect(tableToCsv(source())).toContain('\r\n');
  });

  it('omits the header row when asked', () => {
    expect(lines(tableToCsv(source(), { header: false }))).toEqual(['Ada,36,true', 'Grace,45,false']);
  });

  it('falls back to the column key when a column has no header', () => {
    expect(lines(tableToCsv(source(), { columns: ['tags'] }))[0]).toBe('tags');
  });

  describe('columns', () => {
    it('takes every declared column with "all"', () => {
      expect(lines(tableToCsv(source(), { columns: 'all' }))[0]).toBe('Name,Age,Active,Joined,Note,tags');
    });

    it('takes an explicit key list in the order given', () => {
      expect(lines(tableToCsv(source(), { columns: ['age', 'name'] }))).toEqual(['Age,Name', '36,Ada', '45,Grace']);
    });

    it('throws in dev mode for a key the table does not declare', () => {
      expect(() => tableToCsv(source(), { columns: ['nope'] })).toThrowError(/ET3505/);
    });
  });

  describe('rows', () => {
    it('defaults to the table rows', () => {
      expect(lines(tableToCsv(source({ rows: () => [ROWS[0]!] })))).toHaveLength(2);
    });

    it('takes an explicit list — a selection, or unfiltered data', () => {
      expect(lines(tableToCsv(source(), { rows: [ROWS[1]!] }))).toEqual(['Name,Age,Active', 'Grace,45,false']);
    });

    it('writes a header-only file for no rows', () => {
      expect(tableToCsv(source(), { rows: [] })).toBe('Name,Age,Active');
    });
  });

  describe('serialization', () => {
    it('writes a date as ISO 8601', () => {
      expect(lines(tableToCsv(source(), { columns: ['joined'], header: false }))[0]).toBe('2020-01-02T03:04:05.000Z');
    });

    it('writes an invalid date as an empty field', () => {
      const rows = [{ ...ROWS[0]!, joined: new Date('nope') }];

      expect(tableToCsv(source(), { columns: ['joined'], header: false, rows })).toBe('');
    });

    it('writes nullish as an empty field rather than "null"', () => {
      expect(lines(tableToCsv(source(), { columns: ['note'], header: false }))[0]).toBe('');
    });

    it('uses a column exportValue over its value accessor', () => {
      expect(lines(tableToCsv(source(), { columns: ['tags'], header: false }))).toEqual(['a|b', '']);
    });
  });

  describe('quoting', () => {
    const quoted = (value: string) =>
      tableToCsv(
        {
          rows: () => [{ value }],
          visibleColumns: () => [{ key: 'v', value: (row) => row.value }],
          allColumns: () => [],
        },
        { header: false },
      );

    it('quotes a field containing the delimiter', () => {
      expect(quoted('a,b')).toBe('"a,b"');
    });

    it('doubles quotes inside a quoted field', () => {
      expect(quoted('say "hi"')).toBe('"say ""hi"""');
    });

    it('quotes a field containing a newline', () => {
      expect(quoted('a\nb')).toBe('"a\nb"');
    });

    it('quotes a field with leading or trailing whitespace', () => {
      expect(quoted(' a ')).toBe('" a "');
    });

    it('leaves an ordinary field unquoted', () => {
      expect(quoted('plain')).toBe('plain');
    });

    it('quotes against the chosen delimiter, not the comma', () => {
      const csv = tableToCsv(source(), { delimiter: ';', rows: [{ ...ROWS[0]!, name: 'a;b' }], header: false });

      expect(csv).toBe('"a;b";36;true');
    });
  });

  describe('formula guard', () => {
    const exported = (value: string, formulaGuard?: boolean) =>
      tableToCsv(
        {
          rows: () => [{ value }],
          visibleColumns: () => [{ key: 'v', value: (row) => row.value }],
          allColumns: () => [],
        },
        { header: false, formulaGuard },
      );

    it.each(['=1+1', '@SUM(A1)', "=cmd|' /C calc'!A0", "+cmd|' /C calc'!A0", '\tcmd', '\rcmd'])(
      'escapes a text field starting with %j',
      (value) => {
        expect(exported(value)).toBe(quoteIfNeeded(`'${value}`));
      },
    );

    it.each(['-5', '+1', '1e3'])('leaves %j alone — a number written as text is inert', (value) => {
      expect(exported(value)).toBe(value);
    });

    it('still escapes an expression that starts like a negative number', () => {
      expect(exported('-5+A1')).toBe("'-5+A1");
    });

    it('leaves real numbers alone — they are not text', () => {
      expect(lines(tableToCsv(source(), { columns: ['age'], header: false }))).toEqual(['36', '45']);
    });

    it('can be turned off', () => {
      expect(exported('=1+1', false)).toBe('=1+1');
    });
  });
});

// The guard runs before quoting, so a guarded field that also needs quoting gets both.
const quoteIfNeeded = (field: string) =>
  /[",\r\n]/.test(field) || field !== field.trim() ? `"${field.replace(/"/g, '""')}"` : field;
