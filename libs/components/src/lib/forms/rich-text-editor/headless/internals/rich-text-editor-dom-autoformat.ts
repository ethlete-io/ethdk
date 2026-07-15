import { HEADING_SELECTOR, RichTextEditorDomCore, HeadingTag, InlineTag } from './rich-text-editor-dom-core';
import { RichTextEditorDomHeadings } from './rich-text-editor-dom-headings';
import { RichTextEditorDomLists } from './rich-text-editor-dom-lists';

/**
 * Markdown-as-you-type: block prefixes (`- `, `1. `, `# `) convert the line, and completed inline
 * delimiter runs (`**bold**`, `` `code` ``, …) convert into their mark. Both respect characters
 * reserved by the token-trigger system.
 */
export const createRichTextEditorAutoformat = (
  core: RichTextEditorDomCore,
  deps: { lists: RichTextEditorDomLists; headings: RichTextEditorDomHeadings },
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
  const { toggleHeading } = deps.headings;

  /**
   * Markdown block autoformat: typing a space right after a line-start markdown prefix converts the
   * block — `-`/`*`/`+` into a bulleted list, `1.` into a numbered list, `#`–`###` into a heading.
   * Only fires when the prefix is the entire line before the caret, and never inside contexts the
   * block tools don't apply to (list items, table cells, code, headings). `isReserved` marks
   * characters claimed by the token-trigger system — a reserved prefix never converts, so e.g. a
   * `#` trigger keeps opening its autocomplete instead of becoming a heading.
   * Returns `true` when it converted (the caller must then swallow the typed space).
   */
  const applyBlockAutoformat = (isReserved: (char: string) => boolean) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;

    if (closestWithin(range.startContainer, `li, td, th, pre, code, ${HEADING_SELECTOR}`)) return false;

    // The line starts at the caret's paragraph — a browser-created <div> line counts too (Chrome
    // inserts <div>s on Enter; the serializer maps them to paragraphs) — or at the editor root for
    // the loose first line a contenteditable holds before any block exists.
    const container = closestWithin(range.startContainer, 'p, div') ?? el;
    const probe = doc.createRange();

    probe.selectNodeContents(container);
    probe.setEnd(range.startContainer, range.startOffset);

    const prefix = probe.toString();

    let action: (() => void) | null = null;

    if (/^[-*+]$/.test(prefix) && !isReserved(prefix)) {
      action = () => toggleList('ul');
    } else if (/^\d{1,9}\.$/.test(prefix) && !isReserved(prefix[0] ?? '')) {
      action = () => toggleList('ol');
    } else if (/^#{1,3}$/.test(prefix) && !isReserved('#')) {
      action = () => toggleHeading(`h${prefix.length}` as HeadingTag);
    }

    if (!action) return false;

    probe.deleteContents();
    el.normalize();
    collapseInto(container === el ? el : container, 0);
    action();

    // The consumed prefix usually leaves the converted block empty — give it a line box and a
    // clean collapsed caret so typing continues inside it.
    const editableAfter = getSelection();
    // descend from the restored selection's boundary (e.g. the <ul> after toggleList) to the leaf
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

  /** The inline autoformat rules: markdown delimiter runs completed by the typed closing char.
   *  Longer delimiters come first so `**` wins over `*` (and `__` over `_`). */
  const inlineAutoformatRules: { char: string; tag: InlineTag; re: RegExp }[] = [
    { char: '*', tag: 'strong', re: /\*\*([^\s*](?:[^*]*[^\s*])?)\*\*$/ },
    { char: '*', tag: 'em', re: /(?<!\*)\*([^\s*](?:[^*]*[^\s*])?)\*$/ },
    { char: '~', tag: 'del', re: /~~([^\s~](?:[^~]*[^\s~])?)~~$/ },
    { char: '`', tag: 'code', re: /`([^`]+)`$/ },
    { char: '_', tag: 'strong', re: /(?<![\w_])__([^\s_](?:[^_]*[^\s_])?)__$/ },
    { char: '_', tag: 'em', re: /(?<![\w_])_([^\s_](?:[^_]*[^\s_])?)_$/ },
  ];

  /**
   * Markdown inline autoformat: typing the closing delimiter of `**bold**`, `*italic*`,
   * `` `code` ``, `~~strike~~`, `__bold__` or `_italic_` converts the run into its mark, with the
   * caret placed after the mark so typing continues unformatted. The whole run must live in the
   * caret's text node (marks already applied inside it keep it from matching — a v1 limit).
   * `typed` is the char about to be inserted; returns `true` when it consumed it.
   */
  const applyInlineAutoformat = (typed: string, isReserved: (char: string) => boolean) => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable || !editable.range.collapsed) return false;

    const { range } = editable;
    const node = range.startContainer;

    if (!(node instanceof Text)) return false;

    // backticks & co. are literal inside code spans/blocks
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

      // Land the caret in a real text node after the mark (a zero-width space when nothing
      // follows — stripped on serialize), mirroring codeExit: a bare element boundary doesn't
      // stick and the browser would snap the caret back inside the mark.
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
