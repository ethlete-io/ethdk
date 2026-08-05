import { Appointment } from '../../scheduler.types';
import { buildAppointmentTree } from './scheduler-tree';
import { buildSchedulerTimeGrid } from './scheduler-time-grid';

const appointment = (
  id: string,
  start: Date,
  end: Date,
  overrides: Partial<Pick<Appointment, 'parentId' | 'allDay'>> = {},
): Appointment => ({
  id,
  parentId: overrides.parentId ?? null,
  title: id,
  start,
  end,
  allDay: overrides.allDay,
});

const day = new Date(2026, 6, 15);

const buildGrid = (appointments: Appointment[], days: Date[] = [day]) =>
  buildSchedulerTimeGrid({ days, tree: buildAppointmentTree(appointments), today: day });

const blocksOf = (id: string) => (grid: ReturnType<typeof buildGrid>) =>
  grid[0]?.blocks.find((block) => block.node.appointment.id === id);

describe('buildSchedulerTimeGrid', () => {
  it('produces one day column per input day', () => {
    const grid = buildGrid([], [day, new Date(2026, 6, 16)]);

    expect(grid).toHaveLength(2);
    expect(grid[0]?.date).toEqual(day);
    expect(grid[1]?.date).toEqual(new Date(2026, 6, 16));
  });

  it('flags today', () => {
    const grid = buildGrid([]);

    expect(grid[0]?.today).toBe(true);
  });

  it('routes an all-day appointment to the strip, not the blocks', () => {
    const grid = buildGrid([appointment('a', new Date(2026, 6, 15, 0), new Date(2026, 6, 15, 23), { allDay: true })]);

    expect(grid[0]?.allDay.map((node) => node.appointment.id)).toEqual(['a']);
    expect(grid[0]?.blocks).toEqual([]);
  });

  it('positions a timed appointment as a percentage of the day', () => {
    const grid = buildGrid([appointment('a', new Date(2026, 6, 15, 6), new Date(2026, 6, 15, 12))]);
    const block = blocksOf('a')(grid);

    expect(block?.offset).toBeCloseTo(25, 5);
    expect(block?.span).toBeCloseTo(25, 5);
  });

  it('clips a midnight-spanning appointment to each day it touches', () => {
    const grid = buildGrid(
      [appointment('a', new Date(2026, 6, 15, 18), new Date(2026, 6, 16, 6))],
      [day, new Date(2026, 6, 16)],
    );

    const first = blocksOf('a')(grid);
    const second = grid[1]?.blocks.find((block) => block.node.appointment.id === 'a');

    expect(first?.offset).toBeCloseTo(75, 5);
    expect(first?.span).toBeCloseTo(25, 5);
    expect(second?.offset).toBeCloseTo(0, 5);
    expect(second?.span).toBeCloseTo(25, 5);
  });

  it('gives non-overlapping appointments their own full-width column', () => {
    const grid = buildGrid([
      appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10)),
      appointment('b', new Date(2026, 6, 15, 11), new Date(2026, 6, 15, 12)),
    ]);

    expect(blocksOf('a')(grid)).toMatchObject({ column: 0, columnCount: 1, inlineOffset: 0, inlineSize: 100 });
    expect(blocksOf('b')(grid)).toMatchObject({ column: 0, columnCount: 1, inlineOffset: 0, inlineSize: 100 });
  });

  it('splits two overlapping appointments into two evenly-sized columns', () => {
    const grid = buildGrid([
      appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 11)),
      appointment('b', new Date(2026, 6, 15, 10), new Date(2026, 6, 15, 12)),
    ]);

    expect(blocksOf('a')(grid)).toMatchObject({ column: 0, columnCount: 2, inlineOffset: 0, inlineSize: 50 });
    expect(blocksOf('b')(grid)).toMatchObject({ column: 1, columnCount: 2, inlineOffset: 50, inlineSize: 50 });
  });

  it('reuses a freed column for an appointment transitively connected through another', () => {
    const grid = buildGrid([
      appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10)),
      appointment('b', new Date(2026, 6, 15, 9, 30), new Date(2026, 6, 15, 11)),
      appointment('c', new Date(2026, 6, 15, 10, 30), new Date(2026, 6, 15, 12)),
    ]);

    expect(blocksOf('a')(grid)).toMatchObject({ column: 0, columnCount: 2 });
    expect(blocksOf('b')(grid)).toMatchObject({ column: 1, columnCount: 2 });
    expect(blocksOf('c')(grid)).toMatchObject({ column: 0, columnCount: 2 });
  });

  it('keeps a sub-appointment in the block list alongside its parent, packed independently of depth', () => {
    const grid = buildGrid([
      appointment('parent', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 12)),
      appointment('child', new Date(2026, 6, 15, 13), new Date(2026, 6, 15, 14), { parentId: 'parent' }),
    ]);

    expect(blocksOf('parent')(grid)?.node.depth).toBe(0);
    expect(blocksOf('child')(grid)?.node.depth).toBe(1);
    expect(blocksOf('parent')(grid)).toMatchObject({ column: 0, columnCount: 1 });
    expect(blocksOf('child')(grid)).toMatchObject({ column: 0, columnCount: 1 });
  });
});
