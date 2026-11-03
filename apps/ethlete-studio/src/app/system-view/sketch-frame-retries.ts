// A failed dynamic import stays failed for the frame page's lifetime, so a failing frame reloads under a new `retry`
// param on each design change after the one it failed at, until it draws again.
export type SketchFrameRetries = {
  seq: number;
  failing: Record<string, number>;
  retry: Record<string, number>;
};

export type SketchFrameEvent =
  { kind: 'report'; shot: string; errored: boolean } | { kind: 'change'; seq: number } | { kind: 'reset' };

export const NO_SKETCH_FRAME_RETRIES: SketchFrameRetries = { seq: 0, failing: {}, retry: {} };

export const sketchFrameRetriesWith = (state: SketchFrameRetries, event: SketchFrameEvent): SketchFrameRetries => {
  if (event.kind === 'reset') return { ...NO_SKETCH_FRAME_RETRIES, seq: state.seq };

  if (event.kind === 'change') {
    if (event.seq <= state.seq) return state;

    const due = Object.keys(state.failing);

    return {
      seq: event.seq,
      failing: Object.fromEntries(due.map((shot) => [shot, event.seq])),
      retry: { ...state.retry, ...Object.fromEntries(due.map((shot) => [shot, event.seq])) },
    };
  }

  if (event.errored === event.shot in state.failing) return state;
  if (event.errored) return { ...state, failing: { ...state.failing, [event.shot]: state.seq } };

  const { [event.shot]: _recovered, ...failing } = state.failing;

  return { ...state, failing };
};

export const RETRY_PARAM = 'retry';

export const retriedSrcOf = (src: string, retry: number | undefined) => {
  if (!retry || !URL.canParse(src)) return src;

  const url = new URL(src);

  url.searchParams.set(RETRY_PARAM, String(retry));

  return url.toString();
};
