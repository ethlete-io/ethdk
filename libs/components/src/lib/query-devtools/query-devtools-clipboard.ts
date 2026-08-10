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
