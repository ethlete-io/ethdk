import {
  NO_FRAME_REVISIONS,
  frameRevisionsWith,
  frameRevisionsWithReport,
  reportedFrameOf,
  revisionOf,
  sketchRevisionOf,
} from './frame-revisions';

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

  it('reloads a frame that threw on the next errored change, not before', () => {
    const before = frameRevisionsWith(NO_FRAME_REVISIONS, { all: false, parts: [], errored: true });
    const solid = reportedFrameOf('http://localhost:1/frame.html?product=web&part=components%2Fbutton&state=solid');

    if (!solid) throw new Error('no frame');

    const failing = frameRevisionsWithReport(before, { frame: solid, errored: true });

    expect(revisionOf(failing, button)).toBe(0);
    expect(revisionOf(frameRevisionsWith(failing, { all: false, parts: [], errored: true }), button)).toBe(2);
    expect(revisionOf(frameRevisionsWith(failing, { all: false, parts: [], errored: true }), card)).toBe(0);
  });

  it('keeps the revision a frame shows once it draws again', () => {
    const src = 'http://localhost:1/frame.html?product=web&part=components%2Fbutton&state=solid';
    const failed = reportedFrameOf(src);

    if (!failed) throw new Error('no frame');

    const reloaded = frameRevisionsWith(
      frameRevisionsWithReport(NO_FRAME_REVISIONS, { frame: failed, errored: true }),
      {
        all: false,
        parts: [],
        errored: true,
      },
    );
    const drawn = reportedFrameOf(`${src}&revision=1`);

    if (!drawn) throw new Error('no frame');

    const recovered = frameRevisionsWithReport(reloaded, { frame: drawn, errored: false });

    expect(revisionOf(recovered, button)).toBe(1);
    expect(revisionOf(frameRevisionsWith(recovered, { all: false, parts: [], errored: true }), button)).toBe(1);
  });

  it('reloads a sketch whose variant frame threw on the next errored change', () => {
    const variant = reportedFrameOf(
      'http://localhost:1/frame.html?product=web&part=components%2Fbutton&state=solid&sketch=components%2Fbutton&variant=b',
    );

    if (!variant) throw new Error('no frame');

    const failing = frameRevisionsWithReport(NO_FRAME_REVISIONS, { frame: variant, errored: true });
    const sketch = { product: 'web', target: 'components/button' };

    expect(variant.drawn).toEqual(variantB);
    expect(sketchRevisionOf(frameRevisionsWith(failing, { all: false, parts: [], errored: true }), sketch)).toBe(1);
  });

  it('reads no part frame from a call frame', () => {
    expect(reportedFrameOf('http://localhost:1/frame.html?call=acme%2Fhero&variant=a')).toBeNull();
    expect(reportedFrameOf('not a url')).toBeNull();
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
