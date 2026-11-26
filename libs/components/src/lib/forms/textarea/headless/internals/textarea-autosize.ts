export type AutosizeStyleMetrics = {
  /** Resolved line height in px. */
  lineHeight: number;
  /** Total block padding (top + bottom) in px. */
  paddingBlock: number;
  /** Total block border (top + bottom) in px. */
  borderBlock: number;
};

export type AutosizeMeasurements = AutosizeStyleMetrics & {
  /** `scrollHeight` of the textarea while its block-size is collapsed (content + block padding). */
  contentBlockSize: number;
};

export type AutosizeBounds = {
  minRows: number;
  maxRows: number | null;
};

/**
 * Computes the target border-box block-size for an autosizing textarea.
 *
 * `contentBlockSize` (scrollHeight) already includes block padding, so row
 * bounds are converted to the same box before clamping; the border is added
 * last because `scrollHeight` never includes it.
 */
export const computeAutosizeBlockSize = (measurements: AutosizeMeasurements, bounds: AutosizeBounds) => {
  const { contentBlockSize, lineHeight, paddingBlock, borderBlock } = measurements;
  const { minRows, maxRows } = bounds;

  const minBlockSize = minRows * lineHeight + paddingBlock;
  const maxBlockSize = maxRows === null ? Infinity : maxRows * lineHeight + paddingBlock;

  const clamped = Math.min(Math.max(contentBlockSize, minBlockSize), maxBlockSize);

  return clamped + borderBlock;
};

/** Reads the style metrics needed by {@link computeAutosizeBlockSize} from a live textarea. */
export const readTextareaStyleMetrics = (textarea: HTMLTextAreaElement): AutosizeStyleMetrics => {
  const style = getComputedStyle(textarea);

  const fontSize = parseFloat(style.fontSize) || 16;
  const parsedLineHeight = parseFloat(style.lineHeight);
  const lineHeight = Number.isNaN(parsedLineHeight) ? fontSize * 1.2 : parsedLineHeight;

  const paddingBlock = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const borderBlock = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);

  return { lineHeight, paddingBlock, borderBlock };
};

/**
 * Whether the browser sizes a textarea from its own content, which makes
 * {@link computeAutosizeBlockSize} and its measurement pass unnecessary. The CSS side of that
 * path lives in `TextareaAutosizeStylesComponent` behind the same `@supports` condition.
 */
export const supportsNativeAutosize = () =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content');
