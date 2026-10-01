import { findSankeyKeyTarget, SankeyKeyboardLink, SankeyKeyboardNode } from './sankey-keyboard';

const NODES: SankeyKeyboardNode[] = [
  { key: 'tickets', column: 0, x: 0, y: 0, width: 10, height: 40 },
  { key: 'sponsors', column: 0, x: 0, y: 60, width: 10, height: 40 },
  { key: 'merch', column: 0, x: 0, y: 120, width: 10, height: 40 },
  { key: 'budget', column: 1, x: 100, y: 0, width: 10, height: 60 },
  { key: 'reserve', column: 1, x: 100, y: 100, width: 10, height: 60 },
  { key: 'staff', column: 2, x: 200, y: 20, width: 10, height: 40 },
  { key: 'travel', column: 2, x: 200, y: 120, width: 10, height: 40 },
];

const TURNED = NODES.map((node) => ({ ...node, x: node.y, y: node.x, width: node.height, height: node.width }));

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

  describe('in a vertical flow', () => {
    const turned =
      (key: string, kind: 'node' | 'link' = 'node') =>
      (pressed: string) =>
        findSankeyKeyTarget(
          { nodes: TURNED, links: LINKS, direction: 'vertical' },
          { key: pressed, mark: { kind, key } },
        );

    it('moves left and right within a row and stops at its ends', () => {
      expect(turned('tickets')('ArrowRight')).toEqual({ kind: 'node', key: 'sponsors' });
      expect(turned('sponsors')('ArrowLeft')).toEqual({ kind: 'node', key: 'tickets' });
      expect(turned('merch')('ArrowRight')).toEqual({ kind: 'node', key: 'merch' });
      expect(turned('tickets')('ArrowLeft')).toEqual({ kind: 'node', key: 'tickets' });
    });

    it('moves down and up to the nearest node of the next row and stops at the edges', () => {
      expect(turned('tickets')('ArrowDown')).toEqual({ kind: 'node', key: 'budget' });
      expect(turned('merch')('ArrowDown')).toEqual({ kind: 'node', key: 'reserve' });
      expect(turned('reserve')('ArrowDown')).toEqual({ kind: 'node', key: 'travel' });
      expect(turned('staff')('ArrowUp')).toEqual({ kind: 'node', key: 'budget' });
      expect(turned('tickets')('ArrowUp')).toEqual({ kind: 'node', key: 'tickets' });
      expect(turned('travel')('ArrowDown')).toEqual({ kind: 'node', key: 'travel' });
    });

    it('cycles the outgoing links with left and right', () => {
      expect(turned('reserve:staff', 'link')('ArrowRight')).toEqual({ kind: 'link', key: 'reserve:travel' });
      expect(turned('reserve:staff', 'link')('ArrowLeft')).toEqual({ kind: 'link', key: 'reserve:travel' });
      expect(turned('reserve:staff', 'link')('ArrowDown')).toBeNull();
      expect(turned('reserve:travel', 'link')('Escape')).toEqual({ kind: 'node', key: 'reserve' });
    });
  });

  it('ignores the node keys on a link and the link keys on a node', () => {
    expect(from('reserve:staff', 'link')('ArrowRight')).toBeNull();
    expect(from('reserve:staff', 'link')('Enter')).toBeNull();
    expect(from('reserve')('Escape')).toBeNull();
    expect(from('missing')('ArrowDown')).toBeNull();
  });
});
