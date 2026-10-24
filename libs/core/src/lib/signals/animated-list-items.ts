import { DestroyRef, ElementRef, effect, inject, untracked } from '@angular/core';
import { buildElementSignal, firstElementSignal, SignalElementBindingType } from './element';
import { injectPrefersReducedMotion } from './media-queries';
import { signalIsRendered } from './render-utils';

export type AnimatedListItemsConfig = {
  /**
   * The element that holds the items. It must be positioned (e.g. `position: relative`) and be the
   * `offsetParent` of every item, because removed items fade out as absolutely positioned copies in it.
   * Defaults to the host `ElementRef`.
   */
  host?: SignalElementBindingType;
  /** Selector for the items that move. Match the leaf rows only, never an item and its container. */
  items: string;
  /** Duration in ms of a move. @default 300 */
  moveDuration?: number;
  /** Easing of a move. @default 'ease' */
  moveEasing?: string;
  /** Duration in ms of the fade-in of a new item. @default 150 */
  enterDuration?: number;
  /** Duration in ms of the fade-out of a removed item. @default 100 */
  leaveDuration?: number;
  /** Above this number of moved items, items do not move and only fade. @default 30 */
  maxMoves?: number;
};

type ItemBox = { top: number; left: number; width: number; height: number };

const translateOf = (element: Element) => {
  const match = /matrix\(([^)]+)\)/.exec(getComputedStyle(element).transform);
  const values = match?.[1]?.split(',').map(Number);

  return { x: values?.[4] ?? 0, y: values?.[5] ?? 0 };
};

const layoutBoxOf = (element: HTMLElement, host: HTMLElement): ItemBox => {
  let top = 0;
  let left = 0;
  let current: HTMLElement | null = element;

  while (current && current !== host) {
    top += current.offsetTop;
    left += current.offsetLeft;
    current = current.offsetParent as HTMLElement | null;
  }

  return { top, left, width: element.offsetWidth, height: element.offsetHeight };
};

/**
 * Animates the items of a list when its content changes: an item that stays slides from its old spot to
 * its new one, a new item fades in, and a removed item fades out where it was. Set up once in an injection
 * context. A change during a running move starts from where the item is now. With `prefers-reduced-motion`,
 * items only fade.
 *
 * @example
 * injectAnimatedListItems({ host: this.listElement, items: '.my-row' });
 */
export const injectAnimatedListItems = (config: AnimatedListItemsConfig) => {
  const hostBinding = config.host ?? inject<ElementRef<HTMLElement>>(ElementRef);
  const prefersReducedMotion = injectPrefersReducedMotion();
  const destroyRef = inject(DestroyRef);
  const isRendered = signalIsRendered();
  const hostSignal = firstElementSignal(buildElementSignal(hostBinding));

  const moveDuration = config.moveDuration ?? 300;
  const moveEasing = config.moveEasing ?? 'ease';
  const enterDuration = config.enterDuration ?? 150;
  const leaveDuration = config.leaveDuration ?? 100;
  const maxMoves = config.maxMoves ?? 30;

  const copies = new WeakSet<Node>();
  const moves = new Map<Element, Animation>();
  let boxes = new Map<HTMLElement, ItemBox>();
  let observer: MutationObserver | null = null;

  const measure = (host: HTMLElement) => {
    const next = new Map<HTMLElement, ItemBox>();

    for (const item of Array.from(host.querySelectorAll<HTMLElement>(config.items))) {
      if (!copies.has(item)) next.set(item, layoutBoxOf(item, host));
    }

    return next;
  };

  const fadeOutCopy = (host: HTMLElement, item: HTMLElement, box: ItemBox) => {
    const copy = item.cloneNode(true) as HTMLElement;

    copy.removeAttribute('id');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    Object.assign(copy.style, {
      position: 'absolute',
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: '0',
      pointerEvents: 'none',
    });

    copies.add(copy);
    host.append(copy);

    const fade = copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: leaveDuration, easing: 'ease-out' });
    const remove = () => copy.remove();

    fade.finished.then(remove).catch(remove);
  };

  const run = (host: HTMLElement) => {
    const previous = boxes;
    const next = measure(host);
    const shifts: { item: HTMLElement; x: number; y: number }[] = [];

    boxes = next;

    for (const [item, box] of next) {
      const before = previous.get(item);

      if (!before) {
        item.animate([{ opacity: 0 }, { opacity: 1 }], { duration: enterDuration, easing: 'ease-out' });
        continue;
      }

      const translate = translateOf(item);
      const x = before.left + translate.x - box.left;
      const y = before.top + translate.y - box.top;

      if (Math.abs(x) >= 1 || Math.abs(y) >= 1) shifts.push({ item, x, y });
    }

    for (const [item, box] of previous) {
      if (!next.has(item) && !item.isConnected) fadeOutCopy(host, item, box);
    }

    if (prefersReducedMotion() || shifts.length > maxMoves) {
      for (const move of moves.values()) move.cancel();
      moves.clear();

      return;
    }

    for (const { item, x, y } of shifts) {
      moves.get(item)?.cancel();

      const move = item.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], {
        duration: moveDuration,
        easing: moveEasing,
      });

      moves.set(item, move);

      const forget = () => {
        if (moves.get(item) === move) moves.delete(item);
      };

      move.finished.then(forget).catch(forget);
    }
  };

  const touchesOnlyCopies = (record: MutationRecord) =>
    [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].every((node) => copies.has(node));

  effect(() => {
    const host = hostSignal().currentElement;
    const rendered = isRendered();

    untracked(() => {
      observer?.disconnect();
      boxes = new Map();

      if (!host || !rendered || typeof MutationObserver === 'undefined') return;

      boxes = measure(host);
      observer ??= new MutationObserver((records) => {
        const current = hostSignal().currentElement;

        if (current && !records.every(touchesOnlyCopies)) run(current);
      });
      observer.observe(host, { childList: true, subtree: true });
    });
  });

  destroyRef.onDestroy(() => {
    observer?.disconnect();

    for (const move of moves.values()) move.cancel();
  });
};
