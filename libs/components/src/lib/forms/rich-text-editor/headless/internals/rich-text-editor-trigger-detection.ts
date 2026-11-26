import { RichTextEditorTrigger } from '../../rich-text-editor-trigger';

export type RichTextEditorTriggerMatch = {
  trigger: RichTextEditorTrigger;
  textNode: Text;
  charOffset: number;
  caretOffset: number;
  query: string;
};

const isWordBoundary = (text: string, index: number) => index === 0 || /\s/.test(text[index - 1] ?? '');

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

  // `lastIndexOf` clamps a negative `fromIndex` to 0, so a caret at a node's start would match the
  // trigger char in front of it and picking an item would add a chip without consuming the text.
  if (caretOffset === 0) return null;

  let best: RichTextEditorTriggerMatch | null = null;

  for (const trigger of triggers) {
    const charOffset = text.lastIndexOf(trigger.char, caretOffset - 1);

    if (charOffset === -1 || !isWordBoundary(text, charOffset)) continue;

    const query = text.slice(charOffset + 1, caretOffset);

    if (!(trigger.allowSpaces ?? false) && /\s/.test(query)) continue;

    if (!best || charOffset > best.charOffset) {
      best = { trigger, textNode, charOffset, caretOffset, query };
    }
  }

  return best;
};

export const triggerCharRect = (doc: Document, match: RichTextEditorTriggerMatch): DOMRect => {
  const range = doc.createRange();

  range.setStart(match.textNode, match.charOffset);
  range.setEnd(match.textNode, Math.min(match.charOffset + 1, match.textNode.length));

  const rect = range.getBoundingClientRect();

  if (rect.width > 0 || rect.height > 0) return rect;

  range.collapse(true);

  return range.getBoundingClientRect();
};
