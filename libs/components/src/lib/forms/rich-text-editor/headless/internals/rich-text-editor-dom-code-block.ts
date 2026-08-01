import { RichTextEditorDomCore } from './rich-text-editor-dom-core';

/** Blocks a fenced code block can't take in: their Markdown form doesn't survive inside a fence. */
const NOT_FENCEABLE = /* @__PURE__ */ new Set(['TABLE', 'UL', 'OL', 'BLOCKQUOTE']);

/**
 * Fenced code blocks — `<pre><code>` holding plain text, exactly what a ``` fence round-trips to.
 * Everything inside is literal: no inline marks, no nested blocks, no autoformat and no token
 * triggers (the callers gate those on {@link RichTextMarkStates.codeBlock}), and Enter inserts a
 * real newline instead of splitting the block.
 */
export const createRichTextEditorCodeBlock = (core: RichTextEditorDomCore) => {
  const { doc, renderer, root, getSelection, closestWithin, collapseInto, replaceWith, childrenByTag, blocksInRange } =
    core;

  const codeAtCaret = () => {
    const editable = getSelection();
    const pre = editable ? closestWithin(editable.range.startContainer, 'pre') : null;

    return pre;
  };

  /** The `<code>` inside a `<pre>` (the shape the Markdown pipeline produces), or the `<pre>`. */
  const codeHost = (pre: HTMLElement) => {
    const first = pre.firstElementChild;

    return first instanceof HTMLElement && first.tagName === 'CODE' ? first : pre;
  };

  /** The code text on either side of the caret — which line it is on and whether that line is empty
   *  both follow from these. */
  const textAround = (host: HTMLElement, range: Range) => {
    const start = doc.createRange();
    start.selectNodeContents(host);
    start.setEnd(range.startContainer, range.startOffset);

    const end = doc.createRange();
    end.selectNodeContents(host);
    end.setStart(range.endContainer, range.endOffset);

    return { before: start.toString(), after: end.toString() };
  };

  /** Whether the caret sits at the very end of the code text — where a newline needs a second one
   *  to render a line box the caret can occupy. */
  const atEnd = (host: HTMLElement, range: Range) => textAround(host, range).after.length === 0;

  /**
   * Whether the caret is on the block's last line. The trailing newline that gives an empty last
   * line its line box sits *after* the caret (see {@link codeBlockEnter}), so a lone `\n` still
   * counts as being on the last line — otherwise the line the caret visibly occupies would never
   * be recognized as the last one.
   */
  const onLastLine = (host: HTMLElement, range: Range) => {
    const { after } = textAround(host, range);

    return after === '' || after === '\n';
  };

  /** Whether the caret is on the block's first line — nothing but this line's own text before it. */
  const onFirstLine = (host: HTMLElement, range: Range) => !textAround(host, range).before.includes('\n');

  /**
   * Turns the selected blocks into one code block, or a code block back into paragraphs. Only the
   * text survives the conversion in either direction — a fence has no inline markup.
   */
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

    // Each block becomes one line of code text. A newline keeps an empty block caret-able: with
    // `white-space: pre` there is no line box without one (and a <br> would serialize literally).
    const text = blocks.map((block) => block.textContent ?? '').join('\n') || '\n';

    renderer.appendChild(code, renderer.createText(text));

    renderer.insertBefore(el, pre, blocks[0] ?? null);
    blocks.forEach((block) => {
      if (block.parentNode === el) renderer.removeChild(el, block);
    });

    collapseInto(code.firstChild as Node, 0);
    el.normalize();
  };

  /** Enter inside a code block: a plain newline, never a new block. On the empty last line it
   *  leaves the code block instead — the way out, like lists and quotes. Returns `true` when
   *  handled. */
  const codeBlockEnter = () => {
    const editable = getSelection();
    const el = root();
    const pre = codeAtCaret();

    if (!editable || !el || !pre) return false;

    const { range } = editable;
    const host = codeHost(pre);
    const text = host.textContent ?? '';
    const { before } = textAround(host, range);

    // an already-empty last line means the user wants out
    if (range.collapsed && onLastLine(host, range) && (before === '' || before.endsWith('\n'))) {
      const paragraph = renderer.createElement('p');
      renderer.appendChild(paragraph, renderer.createElement('br'));

      const kept = text.replace(/\n+$/, '');

      if (kept === '') {
        // nothing was written — the code block becomes the paragraph
        replaceWith(pre, [paragraph]);
      } else {
        host.textContent = kept;
        renderer.insertBefore(el, paragraph, pre.nextSibling);
      }

      collapseInto(paragraph, 0);

      return true;
    }

    range.deleteContents();

    // A newline at the very end renders no line box of its own, so add the one the caret lands on
    // (between the two) — text nodes are left unmerged on purpose, so the caret survives.
    const newline = renderer.createText(atEnd(host, range) ? '\n\n' : '\n');

    range.insertNode(newline);
    collapseInto(newline, 1);

    return true;
  };

  /**
   * ArrowDown on the last line of a code block that ends the content — or ArrowUp on the first line
   * of one that starts it: there is no line that way to move to, so create the paragraph the caret is
   * reaching for. Nothing else can produce one at either edge, so a code block flush against the
   * start or end of the content would otherwise be a keyboard trap for anyone who doesn't know about
   * {@link exitCodeBlock}'s Escape (which only ever exits downward). With a block already on that
   * side the browser's own arrow key lands there, so this stays out of the way. Returns `true` when
   * handled.
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

  /** Escape inside a code block moves the caret to a paragraph after it, so the keyboard is never
   *  stuck in literal text. Returns `true` when handled. */
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
   * Selecting everything inside a code block and deleting it leaves the `<pre>` behind — minus its
   * `<code>`, which the browser removes with the content. The caret would then keep typing literal
   * text inside a code block whose tools are all disabled, with no way out, so a `<pre>` that lost
   * its `<code>` becomes a paragraph again. The editor never builds a bare `<pre>` itself (the
   * Markdown pipeline always renders `<pre><code>`), so this only ever catches the leftover.
   * Returns `true` when it repaired something.
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

  /** Backspace in an empty code block removes it, leaving a plain paragraph with the caret. */
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
