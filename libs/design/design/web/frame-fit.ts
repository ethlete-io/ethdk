/** Sizes the frame root to its content inside `padding` px; a bare compare shot passes 0. */
export const fitRoot = (root: HTMLElement, options: { padding: number }) => {
  root.ownerDocument.documentElement.style.overflow = 'hidden';
  root.style.width = 'max-content';

  if (options.padding > 0) root.style.padding = `${options.padding}px`;
};
