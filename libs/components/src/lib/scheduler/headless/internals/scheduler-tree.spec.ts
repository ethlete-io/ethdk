import { Appointment } from '../../scheduler.types';
import { buildAppointmentTree, flattenAppointmentTree } from './scheduler-tree';

const appointment = (id: string, parentId: string | null): Appointment => ({
  id,
  parentId,
  title: id,
  start: new Date(2026, 0, 1),
  end: new Date(2026, 0, 1, 1),
});

describe('buildAppointmentTree', () => {
  it('nests children under their parent, arbitrarily deep', () => {
    const tree = buildAppointmentTree([
      appointment('a', null),
      appointment('a1', 'a'),
      appointment('a1a', 'a1'),
      appointment('a1a1', 'a1a'),
      appointment('b', null),
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0]?.appointment.id).toBe('a');
    expect(tree[0]?.depth).toBe(0);
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.appointment.id).toBe('a1');
    expect(tree[0]?.children[0]?.depth).toBe(1);
    expect(tree[0]?.children[0]?.children[0]?.appointment.id).toBe('a1a');
    expect(tree[0]?.children[0]?.children[0]?.depth).toBe(2);
    expect(tree[0]?.children[0]?.children[0]?.children[0]?.appointment.id).toBe('a1a1');
    expect(tree[0]?.children[0]?.children[0]?.children[0]?.depth).toBe(3);
    expect(tree[1]?.appointment.id).toBe('b');
  });

  it('preserves input order within a level', () => {
    const tree = buildAppointmentTree([appointment('b', null), appointment('a', null)]);

    expect(tree.map((node) => node.appointment.id)).toEqual(['b', 'a']);
  });

  it('treats a dangling parentId as top-level rather than dropping the appointment', () => {
    const tree = buildAppointmentTree([appointment('a', 'missing-parent')]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.appointment.id).toBe('a');
    expect(tree[0]?.depth).toBe(0);
  });

  it('returns an empty tree for an empty list', () => {
    expect(buildAppointmentTree([])).toEqual([]);
  });
});

describe('flattenAppointmentTree', () => {
  it('lists a parent immediately before its children, depth-first', () => {
    const tree = buildAppointmentTree([
      appointment('a', null),
      appointment('a1', 'a'),
      appointment('a2', 'a'),
      appointment('a1a', 'a1'),
      appointment('b', null),
    ]);

    expect(flattenAppointmentTree(tree).map((node) => node.appointment.id)).toEqual(['a', 'a1', 'a1a', 'a2', 'b']);
  });
});
