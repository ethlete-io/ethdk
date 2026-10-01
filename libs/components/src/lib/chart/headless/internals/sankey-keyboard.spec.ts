import { findSankeyKeyTarget, SankeyKeyboardLink, SankeyKeyboardNode } from './sankey-keyboard';

const NODES: SankeyKeyboardNode[] = [
  { key: 'tickets', column: 0, y: 0, height: 40 },
  { key: 'sponsors', column: 0, y: 60, height: 40 },
  { key: 'merch', column: 0, y: 120, height: 40 },
  { key: 'budget', column: 1, y: 0, height: 60 },
  { key: 'reserve', column: 1, y: 100, height: 60 },
  { key: 'staff', column: 2, y: 20, height: 40 },
  { key: 'travel', column: 2, y: 120, height: 40 },
];

const link = (source: string, target: string): SankeyKeyboardLink => ({
  key: `${source}:${target}`,
  source: { key: source },
});

const LINKS = [
  link('tickets', 'budget'),
  link('sponsors', 'budget'),
  link('sponsors', 'reserve'),
  link('budget', 'staff'),
  link('reserve', 'staff'),
  link('reserve', 'travel'),
];

const from =
  (key: string, kind: 'node' | 'link' = 'node') =>
  (pressed: string) =>
    findSankeyKeyTarget({ nodes: NODES, links: LINKS }, { key: pressed, mark: { kind, key } });

describe('findSankeyKeyTarget', () => {
  it('moves up and down within a column and stops at its ends', () => {
    expect(from('tickets')('ArrowDown')).toEqual({ kind: 'node', key: 'sponsors' });
    expect(from('sponsors')('ArrowUp')).toEqual({ kind: 'node', key: 'tickets' });
    expect(from('merch')('ArrowDown')).toEqual({ kind: 'node', key: 'merch' });
    expect(from('tickets')('ArrowUp')).toEqual({ kind: 'node', key: 'tickets' });
  });

  it('moves left and right to the nearest node of the next column and stops at the edges', () => {
    expect(from('tickets')('ArrowRight')).toEqual({ kind: 'node', key: 'budget' });
    expect(from('merch')('ArrowRight')).toEqual({ kind: 'node', key: 'reserve' });
    expect(from('reserve')('ArrowRight')).toEqual({ kind: 'node', key: 'travel' });
    expect(from('staff')('ArrowLeft')).toEqual({ kind: 'node', key: 'budget' });
    expect(from('tickets')('ArrowLeft')).toEqual({ kind: 'node', key: 'tickets' });
    expect(from('travel')('ArrowRight')).toEqual({ kind: 'node', key: 'travel' });
  });

  it('goes to the first and last node with Home and End', () => {
    expect(from('reserve')('Home')).toEqual({ kind: 'node', key: 'tickets' });
    expect(from('reserve')('End')).toEqual({ kind: 'node', key: 'travel' });
  });

  it('steps into the first outgoing link with Enter, and does nothing on a sink', () => {
    expect(from('sponsors')('Enter')).toEqual({ kind: 'link', key: 'sponsors:budget' });
    expect(from('travel')('Enter')).toBeNull();
  });

  it('cycles the outgoing links of the source with the arrows and returns with Escape', () => {
    expect(from('reserve:staff', 'link')('ArrowDown')).toEqual({ kind: 'link', key: 'reserve:travel' });
    expect(from('reserve:travel', 'link')('ArrowDown')).toEqual({ kind: 'link', key: 'reserve:staff' });
    expect(from('reserve:staff', 'link')('ArrowUp')).toEqual({ kind: 'link', key: 'reserve:travel' });
    expect(from('reserve:travel', 'link')('Home')).toEqual({ kind: 'link', key: 'reserve:staff' });
    expect(from('reserve:staff', 'link')('End')).toEqual({ kind: 'link', key: 'reserve:travel' });
    expect(from('reserve:travel', 'link')('Escape')).toEqual({ kind: 'node', key: 'reserve' });
  });

  it('ignores the node keys on a link and the link keys on a node', () => {
    expect(from('reserve:staff', 'link')('ArrowRight')).toBeNull();
    expect(from('reserve:staff', 'link')('Enter')).toBeNull();
    expect(from('reserve')('Escape')).toBeNull();
    expect(from('missing')('ArrowDown')).toBeNull();
  });
});
