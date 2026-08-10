import { Appointment } from '../../scheduler.types';
import { AppointmentTreeNode } from './scheduler-tree';
import { buildSchedulerAgenda, buildSchedulerAgendaGuides } from './scheduler-agenda';
import { buildAppointmentTree } from './scheduler-tree';

const appointment = (
  id: string,
  start: Date,
  end: Date,
  overrides: Partial<Pick<Appointment, 'parentId'>> = {},
): Appointment => ({
  id,
  parentId: overrides.parentId ?? null,
  title: id,
  start,
  end,
});

const day = new Date(2026, 6, 15);

const buildAgenda = (appointments: Appointment[], days: Date[] = [day]) =>
  buildSchedulerAgenda({ days, tree: buildAppointmentTree(appointments), today: day });

describe('buildSchedulerAgenda', () => {
  it('produces one entry per input day', () => {
    const agenda = buildAgenda([], [day, new Date(2026, 6, 16)]);

    expect(agenda).toHaveLength(2);
    expect(agenda[0]?.date).toEqual(day);
    expect(agenda[1]?.date).toEqual(new Date(2026, 6, 16));
  });

  it('flags today', () => {
    const agenda = buildAgenda([]);

    expect(agenda[0]?.today).toBe(true);
  });

  it('routes an appointment to every day it spans', () => {
    const agenda = buildAgenda(
      [appointment('a', new Date(2026, 6, 15, 18), new Date(2026, 6, 16, 6))],
      [day, new Date(2026, 6, 16)],
    );

    expect(agenda[0]?.nodes.map((node) => node.appointment.id)).toEqual(['a']);
    expect(agenda[1]?.nodes.map((node) => node.appointment.id)).toEqual(['a']);
  });

  it('excludes an appointment that does not touch the day', () => {
    const agenda = buildAgenda([appointment('a', new Date(2026, 6, 16, 9), new Date(2026, 6, 16, 10))]);

    expect(agenda[0]?.nodes).toEqual([]);
  });

  it('keeps a chain in depth-first order with depth preserved', () => {
    const agenda = buildAgenda([
      appointment('parent', new Date(2026, 6, 15, 9), new Date(2026, 6, 15, 10)),
      appointment('child', new Date(2026, 6, 15, 11), new Date(2026, 6, 15, 12), { parentId: 'parent' }),
      appointment('sibling', new Date(2026, 6, 15, 13), new Date(2026, 6, 15, 14)),
    ]);

    expect(agenda[0]?.nodes.map((node) => ({ id: node.appointment.id, depth: node.depth }))).toEqual([
      { id: 'parent', depth: 0 },
      { id: 'child', depth: 1 },
      { id: 'sibling', depth: 0 },
    ]);
  });

  it('keeps a child at its chain depth even when its root does not touch the day', () => {
    const agenda = buildAgenda([
      appointment('parent', new Date(2026, 6, 14, 9), new Date(2026, 6, 14, 10)),
      appointment('child', new Date(2026, 6, 15, 11), new Date(2026, 6, 15, 12), { parentId: 'parent' }),
    ]);

    expect(agenda[0]?.nodes.map((node) => ({ id: node.appointment.id, depth: node.depth }))).toEqual([
      { id: 'child', depth: 1 },
    ]);
  });
});

describe('buildSchedulerAgendaGuides', () => {
  const rows = (...depths: number[]) => depths.map((depth) => ({ depth }) as AppointmentTreeNode);

  it('gives a root row no guides', () => {
    expect(buildSchedulerAgendaGuides(rows(0, 0))).toEqual([[], []]);
  });

  it('draws a tee for a child with a following sibling and an elbow for the last one', () => {
    expect(buildSchedulerAgendaGuides(rows(0, 1, 1))).toEqual([[], ['branch'], ['last-branch']]);
  });

  it('carries a trunk through a nephew row while the parent chain continues', () => {
    expect(buildSchedulerAgendaGuides(rows(0, 1, 2, 1))).toEqual([
      [],
      ['branch'],
      ['trunk', 'last-branch'],
      ['last-branch'],
    ]);
  });

  it('leaves a gap instead of a trunk once the ancestor chain has ended', () => {
    expect(buildSchedulerAgendaGuides(rows(0, 1, 2))).toEqual([[], ['last-branch'], ['gap', 'last-branch']]);
  });

  it('ends a chain at the row that climbs back above it', () => {
    expect(buildSchedulerAgendaGuides(rows(0, 1, 2, 2, 0))).toEqual([
      [],
      ['last-branch'],
      ['gap', 'branch'],
      ['gap', 'last-branch'],
      [],
    ]);
  });
});
