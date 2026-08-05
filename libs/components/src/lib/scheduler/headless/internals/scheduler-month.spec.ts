import { Appointment } from '../../scheduler.types';
import { AppointmentTreeNode, buildAppointmentTree } from './scheduler-tree';
import { buildSchedulerMonthGrid } from './scheduler-month';

const appointment = (id: string, start: Date, end: Date, parentId: string | null = null): Appointment => ({
  id,
  parentId,
  title: id,
  start,
  end,
});

const buildGrid = (
  tree: readonly AppointmentTreeNode[] = [],
  overrides: { maxVisiblePerCell?: number; today?: Date } = {},
) =>
  buildSchedulerMonthGrid({
    focusedDate: new Date(2026, 6, 1),
    weekStartsOn: 1,
    tree,
    maxVisiblePerCell: overrides.maxVisiblePerCell ?? 3,
    today: overrides.today ?? new Date(2026, 6, 1),
  });

describe('buildSchedulerMonthGrid', () => {
  it('covers July 2026 with full weeks starting Monday', () => {
    const weeks = buildGrid();

    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]?.[0]?.date).toEqual(new Date(2026, 5, 29));
    expect(weeks[0]?.[0]?.outsideMonth).toBe(true);
    expect(weeks[4]?.[6]?.date).toEqual(new Date(2026, 7, 2));
  });

  it('flags today within the grid', () => {
    const weeks = buildGrid([], { today: new Date(2026, 6, 15) });
    const flat = weeks.flat();

    expect(flat.find((cell) => cell.today)?.date).toEqual(new Date(2026, 6, 15));
  });

  it('places an appointment on the day it falls on', () => {
    const tree = buildAppointmentTree([appointment('a', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10))]);
    const weeks = buildGrid(tree);
    const cell = weeks.flat().find((c) => c.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(cell?.visible.map((node) => node.appointment.id)).toEqual(['a']);
    expect(cell?.overflow).toEqual([]);
  });

  it('repeats a multi-day appointment on every day it spans', () => {
    const tree = buildAppointmentTree([appointment('a', new Date(2026, 6, 14), new Date(2026, 6, 16))]);
    const weeks = buildGrid(tree);
    const days = [14, 15, 16].map(
      (day) => weeks.flat().find((c) => c.date.getTime() === new Date(2026, 6, day).getTime())?.visible.length,
    );

    expect(days).toEqual([1, 1, 1]);
  });

  it('caps visible appointments per cell and counts the rest as overflow', () => {
    const appointments = ['a', 'b', 'c', 'd'].map((id) =>
      appointment(id, new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10)),
    );
    const tree = buildAppointmentTree(appointments);
    const weeks = buildGrid(tree);
    const cell = weeks.flat().find((c) => c.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(cell?.visible).toHaveLength(3);
    expect(cell?.overflow.map((node) => node.appointment.id)).toEqual(['d']);
  });

  it('keeps chain order depth-first when bucketing a day', () => {
    const tree = buildAppointmentTree([
      appointment('parent', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 12)),
      appointment('child', new Date(2026, 6, 15, 10), new Date(2026, 6, 15, 11), 'parent'),
    ]);
    const weeks = buildGrid(tree);
    const cell = weeks.flat().find((c) => c.date.getTime() === new Date(2026, 6, 15).getTime());

    expect(cell?.visible.map((node) => node.appointment.id)).toEqual(['parent', 'child']);
    expect(cell?.visible[1]?.depth).toBe(1);
  });
});
