// A failed dynamic import stays failed for the frame page's lifetime, so a failing frame reloads under a new `retry`
// param on each design change after the one it failed at, until it draws again.
export type SketchFrameRetries = {
  seq: number;
  failing: Record<string, number>;
  retry: Record<string, number>;
  reported: Record<string, true>;
  errors: Record<string, string>;
};

export type SketchFrameEvent =
  | { kind: 'report'; shot: string; errored: boolean; error?: string }
  | { kind: 'change'; seq: number }
  | { kind: 'reset' };

export const NO_SKETCH_FRAME_RETRIES: SketchFrameRetries = { seq: 0, failing: {}, retry: {}, reported: {}, errors: {} };

const errorsWith = (errors: Record<string, string>, { shot, error }: { shot: string; error: string | undefined }) => {
  if (errors[shot] === error) return errors;
  if (error !== undefined) return { ...errors, [shot]: error };

  const { [shot]: _gone, ...rest } = errors;

  return rest;
};

export const sketchFrameRetriesWith = (state: SketchFrameRetries, event: SketchFrameEvent): SketchFrameRetries => {
  if (event.kind === 'reset') return { ...NO_SKETCH_FRAME_RETRIES, seq: state.seq };

  if (event.kind === 'change') {
    if (event.seq <= state.seq) return state;

    const due = Object.keys(state.failing);

    return {
      ...state,
      seq: event.seq,
      failing: Object.fromEntries(due.map((shot) => [shot, event.seq])),
      retry: { ...state.retry, ...Object.fromEntries(due.map((shot) => [shot, event.seq])) },
    };
  }

  const error = event.errored ? event.error : undefined;
  const errors = errorsWith(state.errors, { shot: event.shot, error });
  const reported = event.shot in state.reported ? state.reported : { ...state.reported, [event.shot]: true as const };
  const next = errors === state.errors && reported === state.reported ? state : { ...state, errors, reported };

  if (event.errored === event.shot in state.failing) return next;
  if (event.errored) return { ...next, failing: { ...state.failing, [event.shot]: state.seq } };

  const { [event.shot]: _recovered, ...failing } = state.failing;

  return { ...next, failing };
};

export const RETRY_PARAM = 'retry';

export const retriedSrcOf = (src: string, retry: number | undefined) => {
  if (!retry || !URL.canParse(src)) return src;

  const url = new URL(src);

  url.searchParams.set(RETRY_PARAM, String(retry));

  return url.toString();
};

export const erroredVariantsOf = ({
  rows,
  failing,
  targets = [],
}: {
  rows: { key: string; shots: { state: string }[] }[];
  failing: SketchFrameRetries['failing'];
  targets?: { variant: string; error?: string }[];
}) => {
  const unloaded = new Set(targets.filter((entry) => entry.error).map((entry) => entry.variant));

  return rows
    .filter((row) => unloaded.has(row.key) || row.shots.some((shot) => `${row.key} ${shot.state}` in failing))
    .map((row) => row.key);
};

export type SketchRender = { state: 'failed' | 'drawing' | 'drawn'; errors: string[] };

const errorLineOf = (text: string) => {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.find((line) => !line.startsWith('design-explore:')) ?? lines[0] ?? '';
};

/**
 * Whether the live variants of a sketch drew: `failed` with one "variant · state: message" line per failing frame and
 * one "variant: message" line per variant that fails to load, `drawing` while a mounted frame has not reported yet.
 */
export const sketchRenderOf = ({
  rows,
  retries,
  mounted,
  targets = [],
}: {
  rows: { key: string; shots: { state: string }[] }[];
  retries: Pick<SketchFrameRetries, 'failing' | 'reported' | 'errors'>;
  mounted: Iterable<string>;
  targets?: { variant: string; error?: string }[];
}): SketchRender => {
  const live = new Set(rows.map((row) => row.key));
  const unloaded = targets.flatMap((entry) =>
    entry.error && live.has(entry.variant) ? [`${entry.variant}: ${errorLineOf(entry.error)}`] : [],
  );
  const failing = rows.flatMap((row) =>
    row.shots.flatMap(({ state }) => {
      const shot = `${row.key} ${state}`;
      const error = retries.errors[shot];

      if (!(shot in retries.failing)) return [];

      return [error ? `${row.key} · ${state}: ${errorLineOf(error)}` : `${row.key} · ${state}`];
    }),
  );
  const errors = [...unloaded, ...failing];

  if (errors.length > 0) return { state: 'failed', errors };

  const shots = new Set(rows.flatMap((row) => row.shots.map(({ state }) => `${row.key} ${state}`)));
  const waiting = [...mounted].some((shot) => shots.has(shot) && !(shot in retries.reported));

  return { state: waiting ? 'drawing' : 'drawn', errors };
};
