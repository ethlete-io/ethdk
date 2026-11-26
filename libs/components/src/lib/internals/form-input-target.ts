export const isFormInputTarget = (target: EventTarget | null) => {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  // eslint-disable-next-line ethlete/no-dom-query -- the target is an arbitrary event target, not a directive; jsdom lacks isContentEditable, so specs need the attribute walk
  const editableHost = target.closest('[contenteditable]');

  return editableHost !== null && editableHost.getAttribute('contenteditable') !== 'false';
};
