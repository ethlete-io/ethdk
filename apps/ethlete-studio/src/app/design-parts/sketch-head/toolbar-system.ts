/** Every Studio page shows its actions as icon buttons with a tooltip in the shared toolbar, never as a text button there or a button in the page head. */
export const toolbarSystemViolationsOf = (page: HTMLElement) => {
  const toolbarButtons = [...page.querySelectorAll<HTMLElement>('ethlete-sketch-head [role="toolbar"] button')];
  const headButtons = [...page.querySelectorAll<HTMLElement>('header button')].filter(
    (button) => !button.closest('ethlete-shell-main'),
  );

  return [
    ...toolbarButtons
      .filter((button) => !button.classList.contains('et-icon-button') && !button.hasAttribute('et-icon-button'))
      .map((button) => `text button in the toolbar: ${button.textContent?.trim()}`),
    ...toolbarButtons
      .filter((button) => !button.getAttribute('aria-label'))
      .map(() => 'toolbar button without a name for its tooltip'),
    ...headButtons.map(
      (button) => `button in a page head: ${button.getAttribute('aria-label') ?? button.textContent?.trim()}`,
    ),
  ];
};
