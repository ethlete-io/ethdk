import { RichTextEditorDomCore } from './rich-text-editor-dom-core';

const NOT_FENCEABLE = /* @__PURE__ */ new Set(['TABLE', 'UL', 'OL', 'BLOCKQUOTE']);

export const createRichTextEditorCodeBlock = (core: RichTextEditorDomCore) => {
  const { doc, renderer, root, getSelection, closestWithin, collapseInto, replaceWith, childrenByTag, blocksInRange } =
    core;

  const codeAtCaret = () => {
    const editable = getSelection();
    const pre = editable ? closestWithin(editable.range.startContainer, 'pre') : null;

    return pre;
  };

  const codeHost = (pre: HTMLElement) => {
    const first = pre.firstElementChild;

    return first instanceof HTMLElement && first.tagName === 'CODE' ? first : pre;
  };

  const textAround = (host: HTMLElement, range: Range) => {
    const start = doc.createRange();
    start.selectNodeContents(host);
    start.setEnd(range.startContainer, range.startOffset);

    const end = doc.createRange();
    end.selectNodeContents(host);
    end.setStart(range.endContainer, range.endOffset);

    return { before: start.toString(), after: end.toString() };
  };

  const atEnd = (host: HTMLElement, range: Range) => textAround(host, range).after.length === 0;

  /**
   * The trailing newline that gives an empty last line its line box sits *after* the caret (see
   * {@link codeBlockEnter}), so a lone `\n` still counts as being on the last line.
   */
  const onLastLine = (host: HTMLElement, range: Range) => {
    const { after } = textAround(host, range);

    return after === '' || after === '\n';
  };

  const onFirstLine = (host: HTMLElement, range: Range) => !textAround(host, range).before.includes('\n');

  const toggleCodeBlock = () => {
    const editable = getSelection();
    const el = root();

    if (!el || !editable) return;

    const existing = codeAtCaret();

    if (existing) {
      const lines = (codeHost(existing).textContent ?? '').split('\n');
      const paragraphs = lines.map((line) => {
        const paragraph = renderer.createElement('p');

        if (line.length > 0) renderer.appendChild(paragraph, renderer.createText(line));
        else renderer.appendChild(paragraph, renderer.createElement('br'));

        return paragraph;
      });

      replaceWith(existing, paragraphs);

      const first = paragraphs[0];

      if (first) collapseInto(first, 0);

      el.normalize();

      return;
    }

    const blocks = blocksInRange(editable.range);

    if (blocks.some((block) => block instanceof HTMLElement && NOT_FENCEABLE.has(block.tagName))) return;

    const pre = renderer.createElement('pre');
    const code = renderer.createElement('code');
    renderer.appendChild(pre, code);

    // With `white-space: pre` an empty block has no line box, and so no caret, without a newline
    // (and a <br> would serialize literally).
    const text = blocks.map((block) => block.textContent ?? '').join('\n') || '\n';

    renderer.appendChild(code, renderer.createText(text));

    renderer.insertBefore(el, pre, blocks[0] ?? null);
    blocks.forEach((block) => {
      if (block.parentNode === el) renderer.removeChild(el, block);
    });

    collapseInto(code.firstChild as Node, 0);
    el.normalize();
  };

  const codeBlockEnter = () => {
    const editable = getSelection();
    const el = root();
    const pre = codeAtCaret();

    if (!editable || !el || !pre) return false;

    const { range } = editable;
    const host = codeHost(pre);
    const text = host.textContent ?? '';
    const { before } = textAround(host, range);

    if (range.collapsed && onLastLine(host, range) && (before === '' || before.endsWith('\n'))) {
      const paragraph = renderer.createElement('p');
      renderer.appendChild(paragraph, renderer.createElement('br'));

      const kept = text.replace(/\n+$/, '');

      if (kept === '') {
        replaceWith(pre, [paragraph]);
      } else {
        host.textContent = kept;
        renderer.insertBefore(el, paragraph, pre.nextSibling);
      }

      collapseInto(paragraph, 0);

      return true;
    }

    range.deleteContents();

    // A newline at the very end renders no line box of its own, so add the one the caret lands on.
    // The two text nodes are left unmerged on purpose - normalizing them would drop the caret.
    const newline = renderer.createText(atEnd(host, range) ? '\n\n' : '\n');

    range.insertNode(newline);
    collapseInto(newline, 1);

    return true;
  };

  /**
   * Nothing else can produce a paragraph at either edge of the content, so without this a code block
   * flush against the start or the end of it is a keyboard trap: {@link exitCodeBlock}'s Escape only
   * ever exits downward.
   */
  const codeBlockArrowStep = (key: 'ArrowUp' | 'ArrowDown') => {
    const editable = getSelection();
    const el = root();
    const pre = codeAtCaret();

    if (!editable || !el || !pre || !editable.range.collapsed) return false;

    const up = key === 'ArrowUp';
    const host = codeHost(pre);
    const neighbor = up ? pre.previousElementSibling : pre.nextElementSibling;
    const atEdge = up ? onFirstLine(host, editable.range) : onLastLine(host, editable.range);

    if (neighbor || !atEdge) return false;

    const paragraph = renderer.createElement('p');
    renderer.appendChild(paragraph, renderer.createElement('br'));
    renderer.insertBefore(el, paragraph, up ? pre : pre.nextSibling);
    collapseInto(paragraph, 0);

    return true;
  };

  const exitCodeBlock = () => {
    const el = root();
    const pre = codeAtCaret();

    if (!el || !pre) return false;

    const next = pre.nextElementSibling;

    if (next instanceof HTMLElement && next.tagName === 'P') {
      collapseInto(next, 0);

      return true;
    }

    const paragraph = renderer.createElement('p');
    renderer.appendChild(paragraph, renderer.createElement('br'));
    renderer.insertBefore(el, paragraph, pre.nextSibling);
    collapseInto(paragraph, 0);

    return true;
  };

  /**
   * Deleting a code block's whole content leaves the `<pre>` behind minus its `<code>`, which the
   * browser removes with the content. The editor never builds a bare `<pre>` itself, so this only
   * ever catches that leftover.
   */
  const repairCodeBlock = () => {
    const editable = getSelection();

    if (!editable) return false;

    const pre = closestWithin(editable.range.startContainer, 'pre');

    if (!pre || childrenByTag(pre, 'code').length > 0) return false;

    const paragraph = renderer.createElement('p');

    while (pre.firstChild) renderer.appendChild(paragraph, pre.firstChild);
    if (!paragraph.firstChild) renderer.appendChild(paragraph, renderer.createElement('br'));

    const { startContainer, startOffset } = editable.range;
    const caretInside = paragraph.contains(startContainer);

    replaceWith(pre, [paragraph]);

    if (caretInside) collapseInto(startContainer, startOffset);
    else collapseInto(paragraph, 0);

    return true;
  };

  const codeBlockBackspace = () => {
    const pre = codeAtCaret();

    if (!pre) return false;

    const text = codeHost(pre).textContent ?? '';

    if (text.trim().length > 0) return false;

    const paragraph = renderer.createElement('p');
    renderer.appendChild(paragraph, renderer.createElement('br'));
    replaceWith(pre, [paragraph]);
    collapseInto(paragraph, 0);

    return true;
  };

  return {
    toggleCodeBlock,
    codeBlockEnter,
    codeBlockArrowStep,
    exitCodeBlock,
    codeBlockBackspace,
    repairCodeBlock,
  };
};

export type RichTextEditorDomCodeBlock = ReturnType<typeof createRichTextEditorCodeBlock>;
