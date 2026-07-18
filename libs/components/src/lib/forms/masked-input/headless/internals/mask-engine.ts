import { MaskSpec } from '../input-mask.types';

type CaretQuery = {
  spec: MaskSpec;
  display: string;
  count: number;
};

/** The smallest caret position in `display` with `count` raw characters before it. */
export const caretForRawCount = (query: CaretQuery) => {
  const { spec, display, count } = query;

  for (let index = 0; index <= display.length; index++) {
    if (spec.toRaw(display.slice(0, index)).length >= count) {
      return index;
    }
  }

  return display.length;
};

/**
 * Moves the caret forward past formatting characters so the next keystroke lands in
 * a slot (e.g. after `12` completes to `12-`, the caret belongs after the dash).
 * Stops at unfilled guide slots.
 */
export const advanceCaretPastLiterals = (options: { spec: MaskSpec; display: string; caret: number }) => {
  const { spec, display, caret } = options;
  let advanced = caret;

  while (advanced < display.length) {
    const char = display[advanced];

    if (char === spec.placeholderChar) {
      break;
    }

    // a character that increases the raw count is content, not formatting
    if (spec.toRaw(display.slice(0, advanced + 1)).length > spec.toRaw(display.slice(0, advanced)).length) {
      break;
    }

    advanced += 1;
  }

  return advanced;
};

export const renderMaskDisplay = (options: { spec: MaskSpec; raw: string; guide: boolean }) => {
  const { spec, raw, guide } = options;

  return guide && spec.toGuideDisplay ? spec.toGuideDisplay(raw) : spec.toDisplay(raw);
};

export type MaskEditOptions = {
  spec: MaskSpec;
  /** The raw value before this edit — detects edits that only removed formatting. */
  previousRaw: string;
  /** The element's text after the native edit. */
  text: string;
  /** The element's caret (`selectionStart`) after the native edit. */
  caret: number;
  /** The `InputEvent.inputType`, when available. */
  inputType?: string;
  /** Render the guide display (unfilled slots) — used while the field is focused. */
  guide?: boolean;
};

export type MaskEditResult = {
  raw: string;
  display: string;
  caret: number;
};

/** Reconciles a native edit into `{ raw, display, caret }` — the engine's main entry. */
export const applyMaskEdit = (options: MaskEditOptions): MaskEditResult => {
  const { spec, previousRaw, text, caret, inputType, guide = false } = options;

  let raw = spec.toRaw(text);
  let anchorBefore = spec.toRaw(text.slice(0, caret)).length;
  const deletion = !!inputType?.startsWith('delete');

  // a deletion that left the raw value untouched only removed formatting (e.g.
  // backspace over the dash in `12-|34`) — delete the adjacent content character instead
  if (deletion && raw === previousRaw && raw.length > 0) {
    if (inputType === 'deleteContentForward') {
      raw = raw.slice(0, anchorBefore) + raw.slice(anchorBefore + 1);
    } else if (anchorBefore > 0) {
      raw = raw.slice(0, anchorBefore - 1) + raw.slice(anchorBefore);
      anchorBefore -= 1;
    }
  }

  const display = renderMaskDisplay({ spec, raw, guide });

  // end-anchored masks (right-growing numbers) never glide past formatting and cap the
  // caret at the end of the content — before a suffix, even when typed input overflowed
  if ((spec.caretAnchor ?? 'start') === 'end') {
    return { raw, display, caret: caretForRawCount({ spec, display, count: Math.min(anchorBefore, raw.length) }) };
  }

  let nextCaret = caretForRawCount({ spec, display, count: anchorBefore });

  if (!deletion) {
    nextCaret = advanceCaretPastLiterals({ spec, display, caret: nextCaret });
  }

  return { raw, display, caret: nextCaret };
};
