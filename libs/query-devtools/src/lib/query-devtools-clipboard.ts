/* eslint-disable ethlete/no-direct-dom-manipulation -- the rule assumes a component with a Renderer2.
   This module is a plain function reached from three unrelated components, and the textarea it copies
   through never reaches a template: see `copyBySelection` below. */
/** Why a clipboard read produced nothing, phrased for the menu line that shows it. */
export type QueryDevtoolsClipboardFailure = 'unavailable' | 'blocked';

/**
 * Reads the clipboard, distinguishing "this browser has no `readText`" from "the user or the permission
 * gate said no". Neither is recoverable here, and both leave the caller to fall back to a box that takes
 * a real paste event - a `ClipboardEvent` needs no permission anywhere.
 *
 * Part of the devtools contract. Not part of the general public contract.
 */
export const readQueryDevtoolsClipboard = (): Promise<
  { ok: true; text: string } | { ok: false; reason: QueryDevtoolsClipboardFailure }
> => {
  if (!navigator.clipboard?.readText) return Promise.resolve({ ok: false as const, reason: 'unavailable' as const });

  return navigator.clipboard.readText().then(
    (text) => ({ ok: true as const, text }),
    () => ({ ok: false as const, reason: 'blocked' as const }),
  );
};

/**
 * The text a real paste event carries, or `null` when it holds no plain text - the fallback path for a
 * blocked {@link readQueryDevtoolsClipboard}.
 *
 * Part of the devtools contract. Not part of the general public contract.
 */
export const textFromQueryDevtoolsPaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData('text/plain');

  return text ? text : null;
};

export type QueryDevtoolsClipboardWrite = { ok: true } | { ok: false; reason: QueryDevtoolsClipboardFailure };

/**
 * The pre-`navigator.clipboard` copy: select the text in an off-screen textarea and let the document
 * copy the selection. It is what makes a copy work on a plain `http://` origin, where
 * `navigator.clipboard` is not exposed at all - a LAN address or a staging box, i.e. where a devtools
 * panel is most often opened. The user's own selection is put back afterwards.
 */
const copyBySelection = (text: string) => {
  const doc = globalThis.document;

  if (typeof doc?.execCommand !== 'function') return false;

  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.top = '0';
  doc.body.appendChild(area);

  const selection = doc.getSelection();
  const previous = selection?.rangeCount ? selection.getRangeAt(0) : null;

  area.select();

  const copied = execCopy(doc);

  area.remove();

  if (previous && selection) {
    selection.removeAllRanges();
    selection.addRange(previous);
  }

  return copied;
};

const execCopy = (doc: Document) => {
  try {
    return doc.execCommand('copy');
  } catch {
    return false;
  }
};

const bySelection = (text: string, reason: QueryDevtoolsClipboardFailure): QueryDevtoolsClipboardWrite =>
  copyBySelection(text) ? { ok: true } : { ok: false, reason };

/**
 * Writes to the clipboard, distinguishing "this browser hands over no clipboard" from "the write was
 * blocked" so a caller can say which happened instead of doing nothing. `html` is written alongside the
 * plain text where the browser takes it, since a rich paste keeps its formatting in Slack.
 *
 * Part of the devtools contract. Not part of the general public contract.
 */
export const writeQueryDevtoolsClipboard = (payload: {
  text: string;
  html?: string;
}): Promise<QueryDevtoolsClipboardWrite> => {
  const { text, html } = payload;
  const clipboard = navigator.clipboard;

  if (!clipboard?.writeText) return Promise.resolve(bySelection(text, 'unavailable'));

  const plain = () => clipboard.writeText(text).then(() => ({ ok: true }) as const);

  if (html !== undefined && 'write' in clipboard && typeof ClipboardItem !== 'undefined') {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });

    return clipboard
      .write([item])
      .then(() => ({ ok: true }) as const)
      .catch(plain)
      .catch(() => bySelection(text, 'blocked'));
  }

  return plain().catch(() => bySelection(text, 'blocked'));
};
