import {
  NO_SKETCH_FRAME_RETRIES,
  SketchFrameEvent,
  erroredVariantsOf,
  sketchRenderOf,
  retriedSrcOf,
  sketchFrameRetriesWith,
} from './sketch-frame-retries';

const run = (...events: SketchFrameEvent[]) => events.reduce(sketchFrameRetriesWith, NO_SKETCH_FRAME_RETRIES);

describe('sketch frame retries', () => {
  it('retries a failing frame on the next change', () => {
    const state = run({ kind: 'change', seq: 3 }, { kind: 'report', shot: 'a default', errored: true });

    expect(state.failing).toEqual({ 'a default': 3 });
    expect(state.retry).toEqual({});

    expect(sketchFrameRetriesWith(state, { kind: 'change', seq: 4 }).retry).toEqual({ 'a default': 4 });
  });

  it('keeps a frame failing while it reloads and retries it again on a later change', () => {
    const state = run(
      { kind: 'report', shot: 'a default', errored: true },
      { kind: 'change', seq: 1 },
      { kind: 'report', shot: 'a default', errored: true },
    );

    expect(state.failing).toEqual({ 'a default': 1 });
    expect(sketchFrameRetriesWith(state, { kind: 'change', seq: 2 }).retry).toEqual({ 'a default': 2 });
  });

  it('stops retrying a frame that draws again and keeps its retry', () => {
    const state = run(
      { kind: 'report', shot: 'a default', errored: true },
      { kind: 'change', seq: 1 },
      { kind: 'report', shot: 'a default', errored: false },
      { kind: 'change', seq: 2 },
    );

    expect(state.failing).toEqual({});
    expect(state.retry).toEqual({ 'a default': 1 });
  });

  it('leaves a frame that draws untouched by a change', () => {
    const state = run({ kind: 'report', shot: 'b default', errored: false }, { kind: 'change', seq: 1 });

    expect(state.retry).toEqual({});
  });

  it('ignores a change it already saw', () => {
    const state = run({ kind: 'change', seq: 2 }, { kind: 'report', shot: 'a default', errored: true });

    expect(sketchFrameRetriesWith(state, { kind: 'change', seq: 2 })).toBe(state);
  });

  it('forgets the frames of the previous sketch on a reset', () => {
    const state = run(
      { kind: 'report', shot: 'a default', errored: true },
      { kind: 'change', seq: 1 },
      { kind: 'reset' },
    );

    expect(state).toEqual({ seq: 1, failing: {}, retry: {}, reported: {}, errors: {} });
  });

  it('adds the retry to the frame URL', () => {
    expect(retriedSrcOf('http://[::1]:4402/frame.html?product=studio&part=x', 4)).toBe(
      'http://[::1]:4402/frame.html?product=studio&part=x&retry=4',
    );
    expect(retriedSrcOf('http://[::1]:4402/frame.html?product=studio', undefined)).toBe(
      'http://[::1]:4402/frame.html?product=studio',
    );
  });

  it('marks a variant whose part module fails on the design server, though it has no frame to report', () => {
    const rows = [
      { key: 'current', shots: [{ state: 'default' }] },
      { key: 'a', shots: [{ state: 'default' }] },
      { key: 'b', shots: [] },
      { key: 'c', shots: [{ state: 'default' }] },
    ];

    expect(
      erroredVariantsOf({
        rows,
        failing: { 'c default': 1 },
        targets: [{ variant: 'a' }, { variant: 'b', error: 'Failed to load url ./missing.ts' }, { variant: 'c' }],
      }),
    ).toEqual(['b', 'c']);
  });

  describe('render', () => {
    const rows = [
      { key: 'a', shots: [{ state: 'default' }, { state: 'hover' }] },
      { key: 'b', shots: [{ state: 'default' }] },
    ];
    const mounted = ['a default', 'a hover', 'b default'];

    it('is drawing while a mounted frame has not reported, though no frame errored', () => {
      const retries = run({ kind: 'report', shot: 'a default', errored: false });

      expect(sketchRenderOf({ rows, retries, mounted })).toEqual({ state: 'drawing', errors: [] });
    });

    it('is drawn once every mounted frame of a live variant reported without error', () => {
      const retries = run(
        { kind: 'report', shot: 'a default', errored: false },
        { kind: 'report', shot: 'a hover', errored: false },
        { kind: 'report', shot: 'b default', errored: false },
        { kind: 'report', shot: 'old default', errored: false },
      );

      expect(sketchRenderOf({ rows, retries, mounted: [...mounted, 'old hover'] })).toEqual({
        state: 'drawn',
        errors: [],
      });
    });

    it('fails with the message of each failing frame and of each variant that does not load', () => {
      const retries = run(
        {
          kind: 'report',
          shot: 'a hover',
          errored: true,
          error: 'design-explore: state "hover" of "x" failed\nboom is not defined',
        },
        { kind: 'report', shot: 'b default', errored: true },
      );

      expect(
        sketchRenderOf({
          rows,
          retries,
          mounted,
          targets: [
            { variant: 'b', error: 'Failed to load url ./b.ts' },
            { variant: 'gone', error: 'x' },
          ],
        }),
      ).toEqual({
        state: 'failed',
        errors: ['b: Failed to load url ./b.ts', 'a · hover: boom is not defined', 'b · default'],
      });
    });

    it('forgets the message once the frame draws again', () => {
      const retries = run(
        { kind: 'report', shot: 'a default', errored: true, error: 'boom' },
        { kind: 'report', shot: 'a default', errored: false },
      );

      expect(retries.errors).toEqual({});
      expect(sketchRenderOf({ rows, retries, mounted: ['a default'] }).state).toBe('drawn');
    });

    it('keeps the state object when a report changes nothing', () => {
      const retries = run({ kind: 'report', shot: 'a default', errored: true, error: 'boom' });

      expect(sketchFrameRetriesWith(retries, { kind: 'report', shot: 'a default', errored: true, error: 'boom' })).toBe(
        retries,
      );
    });
  });
});
