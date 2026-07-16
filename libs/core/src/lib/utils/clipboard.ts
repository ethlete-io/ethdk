import { Observable, catchError, defer, from, map, of } from 'rxjs';

export const copyToClipboard = (text: string): Observable<boolean> =>
  defer(() => {
    if (typeof navigator === 'undefined' || typeof document === 'undefined') {
      return of(false);
    }

    if (navigator.clipboard) {
      return from(navigator.clipboard.writeText(text)).pipe(
        map(() => true),
        // The async Clipboard API can be blocked (missing permission, insecure context) — try the legacy path.
        catchError(() => of(copyToClipboardViaExecCommand(text))),
      );
    }

    return of(copyToClipboardViaExecCommand(text));
  });

export const readFromClipboard = (): Observable<string | null> =>
  defer(() => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return of(null);
    }

    return from(navigator.clipboard.readText()).pipe(catchError(() => of(null)));
  });

const copyToClipboardViaExecCommand = (text: string) => {
  const previouslyFocusedElement = document.activeElement;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let didCopy = false;

  try {
    didCopy = document.execCommand('copy');
  } catch {
    // execCommand throws in some environments instead of returning false.
  }

  textarea.remove();

  if (previouslyFocusedElement instanceof HTMLElement) {
    previouslyFocusedElement.focus();
  }

  return didCopy;
};
