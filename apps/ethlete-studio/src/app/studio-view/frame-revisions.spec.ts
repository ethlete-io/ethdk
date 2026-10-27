import { NO_FRAME_REVISIONS, frameRevisionsWith, revisionOf, sketchRevisionOf } from './frame-revisions';

const button = { product: 'web', part: 'components/button', sketch: null };
const card = { product: 'web', part: 'components/card', sketch: null };
const variantB = { product: 'web', part: 'components/button', sketch: { target: 'components/button', variant: 'b' } };

describe('frame revisions', () => {
  it('reloads only the parts a change names', () => {
    const revisions = frameRevisionsWith(NO_FRAME_REVISIONS, { all: false, parts: [button] });

    expect(revisionOf(revisions, button)).toBe(1);
    expect(revisionOf(revisions, card)).toBe(0);
    expect(revisionOf(revisions, variantB)).toBe(0);
  });

  it('reloads every part on all', () => {
    const revisions = frameRevisionsWith(frameRevisionsWith(NO_FRAME_REVISIONS, { all: false, parts: [button] }), {
      all: true,
    });

    expect(revisionOf(revisions, button)).toBe(2);
    expect(revisionOf(revisions, card)).toBe(2);
  });

  it('reloads only failed frames on errored', () => {
    const revisions = frameRevisionsWith(NO_FRAME_REVISIONS, { all: false, parts: [], errored: true });

    expect(revisionOf(revisions, card)).toBe(0);
    expect(revisionOf(revisions, { ...card, errored: true })).toBe(1);
  });

  it('reloads a sketch for its target and the parts its variants draw', () => {
    const variantCard = { ...card, sketch: { target: 'components/button', variant: 'b' } };
    const once = frameRevisionsWith(NO_FRAME_REVISIONS, { all: false, parts: [card] });
    const sketch = { product: 'web', target: 'components/button' };

    expect(sketchRevisionOf(once, sketch)).toBe(0);
    expect(sketchRevisionOf(frameRevisionsWith(once, { all: false, parts: [variantCard] }), sketch)).toBe(2);
    expect(sketchRevisionOf(frameRevisionsWith(once, { all: false, parts: [button] }), sketch)).toBe(2);
  });
});
