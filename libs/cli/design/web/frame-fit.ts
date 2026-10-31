/** Sizes the frame root to its content; `padded` keeps a 16 px margin around it, which a bare compare shot leaves out. */
export const fitRoot = (root: HTMLElement, options: { padded: boolean }) => {
  root.ownerDocument.documentElement.style.overflow = 'hidden';
  root.style.width = 'max-content';

  if (options.padded) root.style.padding = '16px';
};
