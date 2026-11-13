export const setupStudioMenu = (root: HTMLElement) => {
  const trigger = root.querySelector<HTMLButtonElement>('[data-studio-trigger]');
  const surface = root.querySelector<HTMLElement>('[data-studio-menu]');
  const items = [...(surface?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];

  if (!trigger || !surface || !items.length) return;

  const highlight = (item: HTMLButtonElement) => {
    for (const candidate of items) {
      candidate.tabIndex = candidate === item ? 0 : -1;
      candidate.toggleAttribute('data-active', candidate === item);
    }
  };

  const close = (restoreFocus = true) => {
    surface.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };

  const open = (last = false) => {
    surface.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const item = last ? items[items.length - 1] : items[0];
    if (!item) return;
    highlight(item);
    item.focus();
  };

  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-studio-trigger]')) {
      if (surface.hidden) open();
      else close();
    } else if (target?.closest('[data-studio-action]')) close();
    else if (!target || !surface.contains(target)) close(false);
  });

  root.addEventListener('keydown', (event) => {
    if (event.target === trigger && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      open(event.key === 'ArrowUp');
      return;
    }
    if (surface.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') close(false);
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const current = items.findIndex((item) => item === event.target);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      const item = items[next];
      if (item) {
        highlight(item);
        item.focus();
      }
    }
  });

  root.addEventListener('pointerover', (event) => {
    const item =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-studio-action]') : null;
    if (item && surface.contains(item)) highlight(item);
  });
};
