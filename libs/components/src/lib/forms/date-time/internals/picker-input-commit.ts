/** What the control knows about its own field when a commit arrives. */
export type PickerCommitOptions = {
  /** The committed value as the field renders it, or `''` while there is none. */
  displayValue: string;
  /** Whether the field currently holds text that did not parse. */
  parseError: boolean;
  /** `false` while the control is disabled or readonly. */
  interactive: boolean;
  /** The control's own parse rules; `null` when the text does not parse. */
  parse: (raw: string) => Date | null;
};

/**
 * What one resolved commit writes. `parsed` is the instant to commit; while it is `null` the
 * control keeps `text` in the field instead - `''` for a cleared field, the unparseable text
 * for a parse error.
 */
export type PickerCommitOutcome = {
  parsed: Date | null;
  text: string;
};

/**
 * Decides what one blur or Enter commit of `raw` does. Returns `null` when the commit must not
 * run at all: a disabled or readonly control never commits, and neither does a field whose text
 * still matches what the control renders.
 */
export const resolvePickerCommit = (raw: string, options: PickerCommitOptions): PickerCommitOutcome | null => {
  if (!options.interactive) {
    return null;
  }

  // an unparseable field renders no display value, so erasing it arrives here as
  // `raw === displayValue` - it must still run, or `parseError` stays latched under an empty field
  if (raw === options.displayValue && !options.parseError) {
    return null;
  }

  if (!raw.trim()) {
    return { parsed: null, text: '' };
  }

  const parsed = options.parse(raw);

  return { parsed, text: parsed === null ? raw : '' };
};
