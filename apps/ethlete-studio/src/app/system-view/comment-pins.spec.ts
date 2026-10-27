import { describe, expect, it } from 'vitest';
import { ListedComment } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { commentPlaceOf, numberedCommentsOf, otherSizeCountOf, pinsOf } from './comment-pins';
import { treeOf } from './system-tree';

const comment = (id: string, rest: Partial<ListedComment>): ListedComment => ({
  id,
  part: 'components/card',
  state: 'empty',
  size: 360,
  text: `text ${id}`,
  createdAt: `2026-10-27T10:00:0${id}Z`,
  stale: null,
  ...rest,
});

const frame = (id: string, variant?: string): CanvasFrame => ({
  id,
  src: '',
  label: '',
  place: {
    part: 'components/card',
    state: 'empty',
    size: 360,
    ...(variant ? { sketch: { target: 'components/card', variant } } : {}),
  },
});

describe('comment pins', () => {
  const comments = numberedCommentsOf([
    comment('2', { point: { x: 10, y: 20 } }),
    comment('1', { size: 520 }),
    comment('3', { sketch: { target: 'components/card', variant: 'b' } }),
  ]);

  it('numbers oldest first and pins a comment only on the frame of its size and sketch variant', () => {
    expect(comments.map((entry) => [entry.id, entry.number])).toEqual([
      ['1', 1],
      ['2', 2],
      ['3', 3],
    ]);
    expect(pinsOf([frame('a'), frame('b', 'b')], comments)).toEqual([
      { id: '2', frameId: 'a', label: '2', text: 'text 2', point: { x: 10, y: 20 } },
      { id: '3', frameId: 'b', label: '3', text: 'text 3' },
    ]);
  });

  it('counts the comments at another size, and rounds a clicked point', () => {
    expect(otherSizeCountOf({ part: 'components/card', state: 'empty', size: 360 }, comments)).toBe(1);
    expect(commentPlaceOf({ part: 'p', state: 's', size: 'fitted' }, { x: 1.6, y: 2.2 })).toEqual({
      part: 'p',
      state: 's',
      size: 'fitted',
      point: { x: 2, y: 2 },
    });
  });

  it('marks a commented part, and a sketch with a comment on a variant', () => {
    const part = {
      layer: 'components',
      name: 'card',
      origin: 'product' as const,
      note: null,
      states: [],
      problems: [],
    };
    const tree = treeOf([part], { comments: comments.slice(1) });

    expect(tree.find((group) => group.key === 'components')?.entries[0]?.badges).toEqual(['comment open']);
  });
});
