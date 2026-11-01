import { describe, expect, it } from 'vitest';
import { ListedComment } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import { isInSketch, isQuestion, numberedCommentsOf, otherSizeFrameOf } from './comment-pins';
import { treeOf } from './system-tree';

const comment = (id: string, rest: Partial<ListedComment>): ListedComment => ({
  id,
  part: 'components/card',
  state: 'empty',
  size: 360,
  text: `text ${id}`,
  createdAt: `2026-10-27T10:00:0${id}Z`,
  replies: [],
  threadState: 'agent',
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

describe('isQuestion', () => {
  it('is a question only when the server says the agent asked one', () => {
    expect(isQuestion({ threadState: 'agent' })).toBe(false);
    expect(isQuestion({ threadState: 'question' })).toBe(true);
    expect(isQuestion({ threadState: 'answered' })).toBe(false);
  });
});

describe('comments', () => {
  const comments = numberedCommentsOf([
    comment('2', { point: { x: 10, y: 20 } }),
    comment('1', { size: 520 }),
    comment('3', { sketch: { target: 'components/card', variant: 'b' } }),
  ]);

  it('numbers oldest first and finds the frame of a comment at another size or interaction', () => {
    const hoverFrame: CanvasFrame = { ...frame('h'), place: { ...frame('h').place!, interaction: 'hover' } };

    expect(comments.map((entry) => [entry.id, entry.number])).toEqual([
      ['1', 1],
      ['2', 2],
      ['3', 3],
    ]);
    expect(otherSizeFrameOf([frame('g', 'a'), frame('f')], comment('1', { size: 520 }))).toBe('f');
    expect(otherSizeFrameOf([frame('g', 'a')], comment('1', { size: 520 }))).toBeNull();
    expect(otherSizeFrameOf([frame('f')], comment('1', { interaction: 'hover' }))).toBe('f');
    expect(otherSizeFrameOf([frame('f'), hoverFrame], comment('1', { interaction: 'hover' }))).toBe('h');
  });

  it('shows in a sketch only its own comments and those on the pages that use its target', () => {
    const sketch = { createdAt: '2026-10-29T09:00:00.000Z' };
    const pages = new Set(['pages/home']);
    const onVariant = (createdAt?: string) =>
      comment('4', { sketch: { target: 'components/card', variant: 'a', ...(createdAt && { createdAt }) } });

    expect(isInSketch(onVariant(sketch.createdAt), { sketch, contextPages: pages })).toBe(true);
    expect(isInSketch(onVariant('2026-10-28T09:00:00.000Z'), { sketch, contextPages: pages })).toBe(false);
    expect(isInSketch(onVariant(), { sketch, contextPages: pages })).toBe(false);
    expect(isInSketch(comment('5', { part: 'pages/home' }), { sketch, contextPages: pages })).toBe(true);
    expect(isInSketch(comment('6', {}), { sketch, contextPages: pages })).toBe(false);
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

  it('marks a question in the tree, on its pin', () => {
    const part = {
      layer: 'components',
      name: 'card',
      origin: 'product' as const,
      note: null,
      states: [],
      problems: [],
    };
    const asked = numberedCommentsOf([
      comment('1', {
        replies: [{ by: 'agent', text: 'which?', createdAt: '', question: true }],
        threadState: 'question',
      }),
      comment('2', { sketch: { target: 'components/card', variant: 'b' } }),
    ]);
    const tree = treeOf([part], { comments: asked });

    expect(tree.find((group) => group.key === 'components')?.entries[0]?.badges).toEqual(['question']);
  });

  it('marks an answered thread in the tree', () => {
    const part = {
      layer: 'components',
      name: 'card',
      origin: 'product' as const,
      note: null,
      states: [],
      problems: [],
    };
    const answered = numberedCommentsOf([
      comment('1', { replies: [{ by: 'agent', text: 'Raised it.', createdAt: '' }], threadState: 'answered' }),
    ]);
    const tree = treeOf([part], { comments: answered });

    expect(tree.find((group) => group.key === 'components')?.entries[0]?.badges).toEqual(['answered']);
  });
});
