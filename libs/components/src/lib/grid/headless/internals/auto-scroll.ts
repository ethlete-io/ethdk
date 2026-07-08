export type AutoScrollPointer = { clientX: number; clientY: number };

export type AutoScroller = {
  /** Begin the edge-proximity loop. No-op if already running. */
  start: (pointer: AutoScrollPointer) => void;
  /** Feed the latest pointer position. */
  update: (pointer: AutoScrollPointer) => void;
  stop: () => void;
};

export const findScrollableAncestor = (start: Element | null): HTMLElement | null => {
  let current = start?.parentElement ?? null;

  while (current) {
    const style = getComputedStyle(current);
    const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight;
    const scrollsX = /(auto|scroll|overlay)/.test(style.overflowX) && current.scrollWidth > current.clientWidth;

    if (scrollsY || scrollsX) return current;

    current = current.parentElement;
  }

  return null;
};

export const createAutoScroller = (options: {
  document: Document;
  getScrollElement: () => HTMLElement | null;
  threshold?: number;
  maxSpeed?: number;
}): AutoScroller => {
  const doc = options.document;
  const threshold = options.threshold ?? 48;
  const maxSpeed = options.maxSpeed ?? 20;

  let pointer: AutoScrollPointer | null = null;
  let el: HTMLElement | null = null;
  let frame: number | null = null;

  const step = () => {
    frame = null;
    const win = doc.defaultView;

    if (!pointer || !el || !win) return;

    const isRoot = el === doc.scrollingElement || el === doc.documentElement || el === doc.body;
    const rect = isRoot
      ? { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight }
      : el.getBoundingClientRect();

    const speed = (distance: number) =>
      Math.ceil(maxSpeed * Math.min(1, Math.max(0, threshold - distance) / threshold));

    let dx = 0;
    let dy = 0;

    if (pointer.clientY - rect.top < threshold && el.scrollTop > 0) {
      dy = -speed(pointer.clientY - rect.top);
    } else if (rect.bottom - pointer.clientY < threshold && el.scrollTop + el.clientHeight < el.scrollHeight) {
      dy = speed(rect.bottom - pointer.clientY);
    }

    if (pointer.clientX - rect.left < threshold && el.scrollLeft > 0) {
      dx = -speed(pointer.clientX - rect.left);
    } else if (rect.right - pointer.clientX < threshold && el.scrollLeft + el.clientWidth < el.scrollWidth) {
      dx = speed(rect.right - pointer.clientX);
    }

    if (dx !== 0 || dy !== 0) {
      el.scrollBy(dx, dy);
    }

    frame = win.requestAnimationFrame(step);
  };

  return {
    start(p) {
      pointer = p;

      if (frame !== null) return;

      const win = doc.defaultView;

      if (!win) return;

      el = options.getScrollElement();

      if (!el) return;

      frame = win.requestAnimationFrame(step);
    },
    update(p) {
      pointer = p;
    },
    stop() {
      pointer = null;
      el = null;

      if (frame !== null) {
        doc.defaultView?.cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
};
