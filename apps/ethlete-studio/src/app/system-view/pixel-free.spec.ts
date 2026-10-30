import { SketchTarget } from '../../host/design';
import { pixelFreeLinesOf } from './pixel-free';

const target = (variant: string, extra: Partial<SketchTarget> = {}): SketchTarget => ({
  variant,
  states: ['default', 'open'],
  unchanged: ['default', 'open'],
  changes: { added: [], dropped: [], note: null },
  ...extra,
});

describe('pixelFreeLinesOf', () => {
  it('says what a variant without a pixel change changes instead, with both notes', () => {
    const note = { before: 'An inbox.', after: 'An inbox. The editor is open only while focus is within it.' };
    const sketch = {
      targets: [target('c', { changes: { added: [], dropped: ['comment-draft-focus'], note } })],
      variantInfo: { c: { note: 'Restores L.' } },
    };

    expect(pixelFreeLinesOf(sketch, ['c'])).toEqual([
      {
        variant: 'c',
        text: 'c changes no pixel: part note changed, state comment-draft-focus dropped',
        note,
        variantNote: 'Restores L.',
      },
    ]);
  });

  it('skips a variant with a changed state, an error, no changes field, or one not shown', () => {
    const sketch = {
      targets: [
        target('a', { unchanged: ['default'] }),
        target('b', { error: 'broken' }),
        target('c', { changes: undefined }),
        target('d', { changes: { added: [], dropped: ['open', 'closed'], note: null } }),
        target('e'),
      ],
    };

    expect(pixelFreeLinesOf(sketch, ['a', 'b', 'c', 'd']).map((line) => line.text)).toEqual([
      'd changes no pixel: states open, closed dropped',
    ]);
  });
});
