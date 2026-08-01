import { RichTextEditorTrigger } from '../../rich-text-editor-trigger';

/** A trigger that is currently active at the caret, with everything needed to anchor and insert. */
export type RichTextEditorTriggerMatch = {
  trigger: RichTextEditorTrigger;
  /** The text node the trigger char lives in. */
  textNode: Text;
  /** Index of the trigger char within `textNode`. */
  charOffset: number;
  /** Caret index within `textNode`. */
  caretOffset: number;
  /** Text typed between the trigger char and the caret. */
  query: string;
};

/** A trigger char only opens the popup at a word boundary: line/node start or after whitespace. */
const isWordBoundary = (text: string, index: number) => index === 0 || /\s/.test(text[index - 1] ?? '');

/**
 * Resolves the trigger active at a collapsed caret, or `null`. Reads the DOM directly so it stays
 * correct across typing, Backspace, caret jumps and paste without intercepting keystrokes.
 *
 * The trigger char is never consumed here - it stays in the text; only picking an item replaces it.
 * Requiring a word boundary means `user@domain` in an email never opens the popup (the `@` follows
 * a letter); the query cancels on whitespace unless the trigger opts into `allowSpaces`.
 */
export type ResolveTriggerMatchOptions = {
  triggers: readonly RichTextEditorTrigger[];
  root: HTMLElement;
  range: Range;
};

export const resolveTriggerMatch = ({
  triggers,
  root,
  range,
}: ResolveTriggerMatchOptions): RichTextEditorTriggerMatch | null => {
  if (!range.collapsed) return null;

  const node = range.startContainer;

  if (node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null;

  const textNode = node as Text;
  const caretOffset = range.startOffset;
  const text = textNode.data;

  let best: RichTextEditorTriggerMatch | null = null;

  for (const trigger of triggers) {
    const charOffset = text.lastIndexOf(trigger.char, caretOffset - 1);

    if (charOffset === -1 || !isWordBoundary(text, charOffset)) continue;

    const query = text.slice(charOffset + 1, caretOffset);

    // Cancel once the query runs into whitespace (unless the trigger allows it) - this is what
    // lets the user keep typing past the popup, e.g. an email, without it hijacking the text.
    if (!(trigger.allowSpaces ?? false) && /\s/.test(query)) continue;

    // Nearest qualifying char to the caret wins when several triggers could match.
    if (!best || charOffset > best.charOffset) {
      best = { trigger, textNode, charOffset, caretOffset, query };
    }
  }

  return best;
};

/** Bounding rect of the trigger char, for anchoring the popup. Falls back to a collapsed caret rect. */
export const triggerCharRect = (doc: Document, match: RichTextEditorTriggerMatch): DOMRect => {
  const range = doc.createRange();

  range.setStart(match.textNode, match.charOffset);
  range.setEnd(match.textNode, Math.min(match.charOffset + 1, match.textNode.length));

  const rect = range.getBoundingClientRect();

  if (rect.width > 0 || rect.height > 0) return rect;

  // Empty rect (e.g. a zero-width node): fall back to the collapsed caret position.
  range.collapse(true);

  return range.getBoundingClientRect();
};
