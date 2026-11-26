import { rowFieldSourceOf } from '../model/field-source';
import { CALL_LANE_KEY } from '../rows/lane';
import { callHolderBelongsTo } from '../stream/calls';
import { ReviewedRow } from './model';

/** The longest transcript excerpt a call's ask sends. */
export const AUTO_CALL_TRANSCRIPT_MAX_CHARS = 1500;

/** How much of a call's start the excerpt skips: whisper invents text on the near-silence a call opens with. */
export const AUTO_CALL_TRANSCRIPT_SKIP_MS = 30_000;

/**
 * Whether auto mode may ask which issue a call row is: a counted call row nothing named, that the user
 * neither named by hand nor took off the day.
 */
export const isAutoModeCallRow = (
  row: Pick<ReviewedRow, 'issueKey' | 'standInId' | 'sources'> &
    Partial<Pick<ReviewedRow, 'laneKey' | 'hidden' | 'unattended' | 'excluded' | 'state'>>,
) =>
  row.laneKey === CALL_LANE_KEY &&
  !row.issueKey &&
  !row.standInId &&
  !row.hidden &&
  !row.unattended &&
  !row.excluded &&
  row.state !== 'rejected' &&
  rowFieldSourceOf(row, 'issue') !== 'human';

/**
 * An excerpt of what the transcriber heard of one call inside a row's window, for its ask: only the
 * chunks of that call's application, none from its first {@link AUTO_CALL_TRANSCRIPT_SKIP_MS}, cut at a
 * word to {@link AUTO_CALL_TRANSCRIPT_MAX_CHARS}. `undefined` where nothing was heard. The text is the
 * user's own words: `callWritingRequest` masks it.
 */
export const callTranscriptExcerpt = (options: {
  chunks: readonly { atMs: number; appId: string; text: string }[];
  call: { appId: string; from: Date };
  window: { from: Date; to: Date };
  maxChars?: number;
}): string | undefined => {
  const { call, window } = options;
  const fromMs = Math.max(window.from.getTime(), call.from.getTime() + AUTO_CALL_TRANSCRIPT_SKIP_MS);
  const maxChars = options.maxChars ?? AUTO_CALL_TRANSCRIPT_MAX_CHARS;
  const text = options.chunks
    .filter(
      (chunk) =>
        chunk.atMs >= fromMs &&
        chunk.atMs < window.to.getTime() &&
        (callHolderBelongsTo(chunk.appId, call.appId) || callHolderBelongsTo(call.appId, chunk.appId)),
    )
    .sort((left, right) => left.atMs - right.atMs)
    .map((chunk) => chunk.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');

  if (!text) return undefined;
  if (text.length <= maxChars) return text;

  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');

  return `${(lastSpace > maxChars / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};
