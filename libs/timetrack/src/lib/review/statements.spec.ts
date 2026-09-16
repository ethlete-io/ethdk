import { describe, expect, it } from 'vitest';
import { TimeWindow, windowsMs } from '../model/time-window';
import { BreakWindow, breaksBetweenRows } from '../stream/breaks';
import { EMPTY_DAY_REVIEW_EDITS } from './model';
import { clearStatements, deleteStatement, statedPresence, writeStatement } from './statements';

const at = (hour: number, minute = 0) => new Date(2026, 8, 10, hour, minute);

const window = (from: [number, number], to: [number, number]): TimeWindow => ({
  from: at(...from),
  to: at(...to),
});

const breakAt = (from: [number, number], to: [number, number]): BreakWindow => ({
  ...window(from, to),
  locked: false,
});

const ROWS = [window([9, 0], [12, 0]), window([12, 0], [17, 0])];

describe('writeStatement', () => {
  it('puts both ends of the statement on the nearest increment the rows sit on', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(10, 4), to: at(10, 52) });

    expect(edits.statements).toEqual([{ id: expect.any(String), kind: 'away', ...window([10, 0], [10, 45]) }]);
  });

  it('keeps a statement shorter than one increment one increment long', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(10, 1), to: at(10, 3) });

    expect(edits.statements).toEqual([{ id: expect.any(String), kind: 'away', ...window([10, 0], [10, 15]) }]);
  });

  it('takes the stretch a new statement covers out of the statements that contradict it', () => {
    const away = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(10, 0), to: at(11, 0) });
    const both = writeStatement({ edits: away, kind: 'present', from: at(10, 30), to: at(11, 0) });

    expect(both.statements).toEqual([
      { id: expect.any(String), kind: 'away', ...window([10, 0], [10, 30]) },
      { id: expect.any(String), kind: 'present', ...window([10, 30], [11, 0]) },
    ]);
  });

  it('leaves a statement of its own kind alone', () => {
    const first = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(10, 0), to: at(11, 0) });
    const second = writeStatement({ edits: first, kind: 'away', from: at(10, 30), to: at(11, 30) });

    expect(second.statements).toHaveLength(2);
  });

  it('gives every statement an id of its own', () => {
    const first = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(10, 0), to: at(11, 0) });
    const second = writeStatement({ edits: first, kind: 'away', from: at(10, 0), to: at(11, 0) });

    expect(new Set(second.statements.map((statement) => statement.id)).size).toBe(2);
  });
});

describe('a statement over the day', () => {
  it('removes the break a present statement covers', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(10, 0), to: at(11, 0) });

    expect(
      breaksBetweenRows({ breaks: [breakAt([10, 0], [11, 0])], rows: ROWS, statements: edits.statements }),
    ).toEqual([]);
  });

  it('brings the break back when that statement is deleted', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(10, 0), to: at(11, 0) });
    const undone = deleteStatement({ edits, id: edits.statements[0]?.id ?? '' });

    expect(
      breaksBetweenRows({ breaks: [breakAt([10, 0], [11, 0])], rows: ROWS, statements: undone.statements }),
    ).toEqual([breakAt([10, 0], [11, 0])]);
  });

  it('shortens a break where the present statement covers one end of it', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(10, 30), to: at(11, 0) });

    expect(
      breaksBetweenRows({ breaks: [breakAt([10, 0], [11, 0])], rows: ROWS, statements: edits.statements }),
    ).toEqual([breakAt([10, 0], [10, 30])]);
  });

  it('draws a break where an away statement covers a stretch the day held none', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(14, 0), to: at(15, 0) });

    expect(breaksBetweenRows({ breaks: [], rows: ROWS, statements: edits.statements })).toEqual([
      breakAt([14, 0], [15, 0]),
    ]);
  });

  it('draws a break an away statement states over a call the day holds as presence', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(14, 0), to: at(15, 0) });

    expect(
      breaksBetweenRows({
        breaks: [],
        rows: ROWS,
        presence: [window([14, 0], [15, 0])],
        statements: edits.statements,
      }),
    ).toEqual([breakAt([14, 0], [15, 0])]);
  });

  it('joins an away statement to the break it touches rather than drawing two', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(11, 0), to: at(11, 30) });

    expect(
      breaksBetweenRows({ breaks: [breakAt([10, 0], [11, 0])], rows: ROWS, statements: edits.statements }),
    ).toEqual([breakAt([10, 0], [11, 30])]);
  });

  it('holds its answer when a later measurement moves the break it was written over', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(10, 0), to: at(11, 0) });
    const first = breaksBetweenRows({
      breaks: [breakAt([10, 0], [11, 0])],
      rows: ROWS,
      statements: edits.statements,
    });
    const moved = breaksBetweenRows({
      breaks: [{ ...window([10, 7], [10, 53]), locked: false }],
      rows: ROWS,
      statements: edits.statements,
    });

    expect(first).toEqual([]);
    expect(moved).toEqual([]);
  });

  it('puts every break back when the day is reset', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(10, 0), to: at(11, 0) });
    const reset = clearStatements({ edits });

    expect(
      breaksBetweenRows({ breaks: [breakAt([10, 0], [11, 0])], rows: ROWS, statements: reset.statements }),
    ).toEqual([breakAt([10, 0], [11, 0])]);
  });
});

describe('statedPresence', () => {
  it('leaves the measured presence alone when the day states nothing', () => {
    expect(statedPresence({ presence: [window([9, 0], [12, 0])], statements: [] })).toEqual([window([9, 0], [12, 0])]);
  });

  it('takes the stretch an away statement covers out of the presence', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'away', from: at(10, 0), to: at(11, 0) });

    expect(statedPresence({ presence: [window([9, 0], [12, 0])], statements: edits.statements })).toEqual([
      window([9, 0], [10, 0]),
      window([11, 0], [12, 0]),
    ]);
  });

  it('adds a stretch nothing measured that a present statement claims', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(12, 0), to: at(13, 0) });

    expect(statedPresence({ presence: [window([9, 0], [12, 0])], statements: edits.statements })).toEqual([
      window([9, 0], [13, 0]),
    ]);
  });

  it('counts a stretch a present statement already held once', () => {
    const edits = writeStatement({ edits: EMPTY_DAY_REVIEW_EDITS, kind: 'present', from: at(10, 0), to: at(11, 0) });

    expect(windowsMs(statedPresence({ presence: [window([9, 0], [12, 0])], statements: edits.statements }))).toBe(
      3 * 60 * 60 * 1000,
    );
  });
});
