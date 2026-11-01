import { describe, expect, it } from 'vitest';
import { ListedComment } from '../../host/design';
import { CanvasFrame } from '../components/design-canvas/canvas-frame';
import {
  ageOf,
  commentDraftOf,
  commentPlaceOf,
  draftKeyOf,
  isCommentModeKey,
  isInSketch,
  isQuestion,
  numberedCommentsOf,
  otherSizeCountOf,
  otherSizeFrameOf,
  pinsOf,
  withOtherSizeNotes,
} from './comment-pins';
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

const DU = { author: 'Du', initials: 'Du', count: 1 };

describe('isQuestion', () => {
  it('is a question only when the server says the agent asked one', () => {
    expect(isQuestion({ threadState: 'agent' })).toBe(false);
    expect(isQuestion({ threadState: 'question' })).toBe(true);
    expect(isQuestion({ threadState: 'answered' })).toBe(false);
  });
});

describe('comment pins', () => {
  it('draws the pin face from the latest sender and counts all messages', () => {
    const [pin] = pinsOf(
      [frame('a')],
      numberedCommentsOf([
        comment('1', {
          replies: [
            { by: 'user', text: 'Why?', createdAt: '' },
            { by: 'agent', author: 'claude-opus-5-5', text: 'Fixed.', createdAt: '' },
          ],
        }),
      ]),
    );

    expect(pin).toMatchObject({ author: 'Claude', initials: 'C', agent: 'claude', count: 3 });
  });

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
      { ...DU, id: '2', frameId: 'a', label: '2', text: 'text 2', point: { x: 10, y: 20 } },
      { ...DU, id: '3', frameId: 'b', label: '3', text: 'text 3' },
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

  it('tells the age of a comment', () => {
    const now = Date.parse('2026-10-27T12:00:00Z');

    expect(
      ['2026-10-27T11:59:30Z', '2026-10-27T11:55:00Z', '2026-10-27T09:00:00Z', '2026-10-25T12:00:00Z'].map(
        (createdAt) => ageOf(createdAt, now),
      ),
    ).toEqual(['jetzt', '5 min', '3 h', '2 T']);
  });

  it('notes the comments at other sizes on a label, and finds the frame of their state', () => {
    const wide = comment('1', { size: 520 });
    const others = [wide, comment('2', { size: 'fitted' }), comment('3', {})];
    const [plain, variant] = withOtherSizeNotes([frame('f'), frame('g', 'a')], { comments: others });

    expect(plain?.note).toBe('2 Kommentare in anderen Größen');
    expect(variant?.note).toBeUndefined();
    expect(withOtherSizeNotes([frame('f')], { comments: [wide] })[0]?.note).toBe('1 Kommentar in einer anderen Größe');
    expect(otherSizeFrameOf([frame('g', 'a'), frame('f')], wide)).toBe('f');

    const pointed = { part: 'components/card', state: 'empty', point: { x: 1, y: 2 } };
    const notes = [
      { ...pointed, size: 520 },
      { ...pointed, size: 360 },
      { part: 'components/card', state: 'empty' },
    ];
    const [noted, sketched] = withOtherSizeNotes([frame('f'), frame('g', 'a')], { comments: [wide], notes });

    expect(noted?.note).toBe('1 Kommentar, 1 Notiz in einer anderen Größe');
    expect(sketched?.note).toBeUndefined();
    expect(withOtherSizeNotes([frame('f')], { comments: others, notes })[0]?.note).toBe(
      '2 Kommentare, 1 Notiz in anderen Größen',
    );
    expect(withOtherSizeNotes([frame('f')], { comments: [], notes: [{ ...pointed, size: 'fitted' }] })[0]?.note).toBe(
      '1 Notiz in einer anderen Größe',
    );
    expect(otherSizeFrameOf([frame('g', 'a')], wide)).toBeNull();
  });

  it('pins a comment only on the frame of its interaction and counts it on the others', () => {
    const hoverPlace = { part: 'components/card', state: 'empty', size: 360, interaction: 'hover' };
    const hoverFrame: CanvasFrame = { ...frame('h'), place: hoverPlace };
    const hoverComment = comment('1', { interaction: 'hover' });
    const onHover = numberedCommentsOf([hoverComment, comment('2', { interaction: 'rest' })]);
    const onRest = comment('3', {});

    expect(pinsOf([frame('f'), hoverFrame], onHover).map((pin) => [pin.id, pin.frameId])).toEqual([
      ['1', 'h'],
      ['2', 'f'],
    ]);
    expect(
      withOtherSizeNotes([frame('f'), hoverFrame], { comments: [hoverComment] }).map((noted) => noted.note),
    ).toEqual(['1 Kommentar in einer anderen Interaktion', undefined]);
    expect(withOtherSizeNotes([hoverFrame], { comments: [onRest, comment('4', { size: 520 })] })[0]?.note).toBe(
      '1 Kommentar in einer anderen Größe, 1 Kommentar in einer anderen Interaktion',
    );
    expect(
      withOtherSizeNotes([frame('f'), hoverFrame], {
        comments: [hoverComment, onRest],
        everyInteraction: true,
      }).map((noted) => noted.note),
    ).toEqual([undefined, undefined]);
    expect(otherSizeFrameOf([frame('f')], hoverComment)).toBe('f');
    expect(commentPlaceOf(hoverPlace, null)).toEqual(hoverPlace);
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

  it('starts a draft only on a frame with a place', () => {
    const bare: CanvasFrame = { id: 'c', src: '', label: '' };

    expect(commentDraftOf([frame('a'), bare], { frameId: 'a', point: null })).toEqual({
      frameId: 'a',
      place: frame('a').place,
      point: null,
    });
    expect(commentDraftOf([frame('a'), bare], { frameId: 'c', point: { x: 1, y: 1 } })).toBeNull();
  });

  it('sends on Enter, breaks the line on Shift+Enter, cancels on Esc, and waits while composing', () => {
    const key = (key: string, shiftKey = false, isComposing = false) => draftKeyOf({ key, shiftKey, isComposing });

    expect([key('Enter'), key('Enter', true), key('Escape'), key('Enter', false, true), key('a')]).toEqual([
      'send',
      null,
      'cancel',
      null,
      null,
    ]);
  });

  it('toggles comment mode on a bare C outside a text field', () => {
    const key = (rest: Partial<Parameters<typeof isCommentModeKey>[0]>) =>
      isCommentModeKey({ key: 'c', ctrlKey: false, metaKey: false, altKey: false, target: null, ...rest });

    expect([
      key({}),
      key({ key: 'C' }),
      key({ ctrlKey: true }),
      key({ target: document.createElement('textarea') }),
      key({ key: 'x' }),
    ]).toEqual([true, true, false, false, false]);
  });
});
