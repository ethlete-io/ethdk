export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // The async Clipboard API can be blocked (missing permission, insecure context) — try the legacy path.
    }
  }

  return copyToClipboardViaExecCommand(text);
};

export const readFromClipboard = async (): Promise<string | null> => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return null;
  }

  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
};

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
