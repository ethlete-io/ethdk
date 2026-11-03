import {
  NO_SKETCH_FRAME_RETRIES,
  SketchFrameEvent,
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

    expect(state).toEqual({ seq: 1, failing: {}, retry: {} });
  });

  it('adds the retry to the frame URL', () => {
    expect(retriedSrcOf('http://[::1]:4402/frame.html?product=studio&part=x', 4)).toBe(
      'http://[::1]:4402/frame.html?product=studio&part=x&retry=4',
    );
    expect(retriedSrcOf('http://[::1]:4402/frame.html?product=studio', undefined)).toBe(
      'http://[::1]:4402/frame.html?product=studio',
    );
  });
});
