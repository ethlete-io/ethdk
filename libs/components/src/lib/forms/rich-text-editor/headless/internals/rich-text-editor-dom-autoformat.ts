import { HEADING_SELECTOR, RichTextEditorDomCore, HeadingTag, InlineTag } from './rich-text-editor-dom-core';
import { RichTextEditorDomFeatures } from './rich-text-editor-dom-features';
import { RichTextEditorDomLists } from './rich-text-editor-dom-lists';

export const createRichTextEditorAutoformat = (
  core: RichTextEditorDomCore,
  deps: {
    lists: RichTextEditorDomLists;
    features: RichTextEditorDomFeatures;
  },
) => {
  const {
    doc,
    renderer,
    root,
    getSelection,
    closestWithin,
    collapseInto,
    resolveStartNode,
    isBlockEmpty,
    collectDescendants,
  } = core;
  const { toggleList } = deps.lists;
  const { features } = deps;

  /** Returns `true` when it converted, and the caller must then swallow the typed space. */
  const applyBlockAutoformat = (isReserved: (char: string) => boolean) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;

    if (closestWithin(range.startContainer, `li, td, th, pre, code, ${HEADING_SELECTOR}`)) return false;

    // A browser-created <div> line counts as the caret's block too (Chrome inserts <div>s on Enter),
    // and the root stands in for the loose first line a contenteditable holds before any block exists.
    const container = closestWithin(range.startContainer, 'p, div') ?? el;
    const probe = doc.createRange();

    probe.selectNodeContents(container);
    probe.setEnd(range.startContainer, range.startOffset);

    const prefix = probe.toString();

    const { headings, blockquote, codeBlock } = features;

    let action: (() => void) | null = null;

    if (/^[-*+]$/.test(prefix) && !isReserved(prefix)) {
      action = () => toggleList('ul');
    } else if (/^\d{1,9}\.$/.test(prefix) && !isReserved(prefix[0] ?? '')) {
      action = () => toggleList('ol');
    } else if (headings && /^#{1,3}$/.test(prefix) && !isReserved('#')) {
      action = () => headings.toggleHeading(`h${prefix.length}` as HeadingTag);
    } else if (codeBlock && prefix === '```') {
      action = codeBlock.toggleCodeBlock;
    } else if (blockquote && prefix === '>' && !isReserved('>') && !closestWithin(range.startContainer, 'blockquote')) {
      action = blockquote.toggleBlockquote;
    }

    if (!action) return false;

    probe.deleteContents();
    el.normalize();
    collapseInto(container === el ? el : container, 0);
    action();

    const editableAfter = getSelection();
    const landed = editableAfter
      ? closestWithin(resolveStartNode(editableAfter.range), `li, ${HEADING_SELECTOR}`)
      : null;

    if (landed && isBlockEmpty(landed)) {
      if (collectDescendants(landed, 'br').length === 0) {
        renderer.appendChild(landed, renderer.createElement('br'));
      }

      collapseInto(landed, 0);
    }

    return true;
  };

  /** Longer delimiters must come first so `**` wins over `*`, and `__` over `_`. */
  const inlineAutoformatRules: { char: string; tag: InlineTag; re: RegExp }[] = [
    { char: '*', tag: 'strong', re: /\*\*([^\s*](?:[^*]*[^\s*])?)\*\*$/ },
    { char: '*', tag: 'em', re: /(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*$/ },
    { char: '~', tag: 'del', re: /~~([^\s~](?:[^~]*[^\s~])?)~~$/ },
    { char: '`', tag: 'code', re: /`([^`]+)`$/ },
    { char: '_', tag: 'strong', re: /(?<![\w_])__([^\s_](?:[^_]*[^\s_])?)__$/ },
    { char: '_', tag: 'em', re: /(?<![\w_])_([^\s_](?:[^_]*[^\s_])?)_$/ },
  ];

  /** `typed` is the char about to be inserted; returns `true` when it consumed it. */
  const applyInlineAutoformat = (typed: string, isReserved: (char: string) => boolean) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;
    const node = range.startContainer;

    if (!(node instanceof Text)) return false;

    if (closestWithin(node, 'code, pre')) return false;

    const text = (node.textContent ?? '').slice(0, range.startOffset) + typed;

    for (const rule of inlineAutoformatRules) {
      if (rule.char !== typed || isReserved(rule.char)) continue;

      const match = rule.re.exec(text);

      if (!match) continue;

      const inner = match[1] ?? '';
      const start = match.index;

      node.deleteData(start, range.startOffset - start);

      const mark = renderer.createElement(rule.tag) as HTMLElement;

      renderer.appendChild(mark, renderer.createText(inner));

      const insertAt = doc.createRange();

      insertAt.setStart(node, start);
      insertAt.collapse(true);
      insertAt.insertNode(mark);

      // The caret has to land in a real text node: a bare element boundary does not stick and the
      // browser snaps it back inside the mark. The zero-width space is stripped on serialize.
      let target = mark.nextSibling;
      let offset = 0;

      if (!(target instanceof Text) || target.length === 0) {
        target = renderer.createText('\u200b');
        renderer.insertBefore(mark.parentNode as Node, target, mark.nextSibling);
        offset = 1;
      }

      collapseInto(target, offset);

      return true;
    }

    return false;
  };

  return { applyBlockAutoformat, applyInlineAutoformat };
};

export type RichTextEditorDomAutoformat = ReturnType<typeof createRichTextEditorAutoformat>;
