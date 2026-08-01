import { Observable } from 'rxjs';

/**
 * Namespaces a token in the serialized Markdown (`{{type:id}}`). Apps pick their own
 * values (`'block'`, `'mention'`, `'link'`, …); the union just nudges the common ones.
 */
export type RichTextEditorTriggerType = 'block' | 'mention' | 'link' | (string & {});

/** A single row shown in the trigger popup and the source of an inserted token. */
export type RichTextEditorTriggerItem = {
  /** Stable identity, embedded in the token as `{{type:id}}`. Must match `[A-Za-z0-9._:-]+`. */
  id: string;
  /** Text shown in the popup row and rendered inside the inserted chip. */
  label: string;
  /** Optional secondary line rendered under the label in the popup. */
  description?: string;
  /** Arbitrary passthrough for consumers that render custom rows/chips. */
  data?: unknown;
  /** When `true`, the row is shown but cannot be selected. */
  disabled?: boolean;
};

/**
 * Where a trigger gets its items from. Either a static list, or a function of the current
 * query returning items synchronously, as a `Promise`, or as an `Observable` (for
 * search-as-you-type). Function sources are re-run (debounced) as the query changes.
 */
export type RichTextEditorTriggerItemSource =
  | readonly RichTextEditorTriggerItem[]
  | ((
      query: string,
    ) => RichTextEditorTriggerItem[] | Promise<RichTextEditorTriggerItem[]> | Observable<RichTextEditorTriggerItem[]>);

/**
 * Resolves a stored token id back to an item so a `{{type:id}}` value can render as a
 * labelled chip in display/read contexts. Sync, `Promise`, or `Observable`; returning
 * `null` (or omitting the resolver) falls back to rendering the raw id.
 */
export type RichTextEditorTriggerItemResolver = (
  id: string,
) =>
  | RichTextEditorTriggerItem
  | null
  | Promise<RichTextEditorTriggerItem | null>
  | Observable<RichTextEditorTriggerItem | null>;

/** A single trigger character and the domain-specific items it offers. */
export type RichTextEditorTrigger = {
  /** The character that opens the popup at a word boundary (e.g. `'#'`, `'@'`). */
  char: string;
  /** Namespaces the inserted token. Unique per editor. Must match `[a-z][a-z0-9-]*`. */
  type: RichTextEditorTriggerType;
  /** The items offered while this trigger is active. */
  items: RichTextEditorTriggerItemSource;
  /** Renders stored `{{type:id}}` tokens as labelled chips. See {@link RichTextEditorTriggerItemResolver}. */
  resolveItem?: RichTextEditorTriggerItemResolver;
  /** Keep the popup open when the query contains spaces. @default false */
  allowSpaces?: boolean;
  /** Minimum query length before items are requested. @default 0 */
  minQueryLength?: number;
  /** Debounce applied to async (function) sources, in ms. @default 150 */
  debounceTime?: number;
};

/**
 * Declares a trigger for the rich text editor's building-block autocomplete. A thin
 * identity helper - kept as a function so the config type is inferred and the call site
 * reads intentionally. Pass the results to `[etRichTextEditorTriggers]`.
 *
 * ```ts
 * createRichTextEditorTrigger({ char: '#', type: 'block', items: MERGE_FIELDS })
 * ```
 */
export const createRichTextEditorTrigger = (trigger: RichTextEditorTrigger): RichTextEditorTrigger => trigger;
