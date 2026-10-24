import { DestroyRef, ElementRef, effect, inject, untracked } from '@angular/core';
import { buildElementSignal, firstElementSignal, SignalElementBindingType } from './element';
import { injectPrefersReducedMotion } from './media-queries';
import { signalIsRendered } from './render-utils';

export type AnimatedListItemsConfig = {
  /** The element that holds the items. Removed items fade out as copies appended to it. Defaults to the host `ElementRef`. */
  host?: SignalElementBindingType;
  /** Selector for the items that move. Match the leaf rows only, never an item and its container. */
  items: string;
  /**
   * Attributes that hide an item without removing it, e.g. a filter flag. Changes to them count as list
   * changes, and the fade-out copy of a hidden item drops them.
   */
  attributes?: string[];
  /** Duration in ms of a move. @default 300 */
  moveDuration?: number;
  /** Easing of a move. @default 'ease' */
  moveEasing?: string;
  /** Duration in ms of the fade-in of a new item. @default 150 */
  enterDuration?: number;
  /** Duration in ms of the fade-out of a removed item. @default 100 */
  leaveDuration?: number;
  /** Class on the host while items move or fade out - use it to clip the overflow of moved items. */
  movingClass?: string;
  /** Above this number of moved items, items do not move and only fade. @default 30 */
  maxMoves?: number;
};

type ItemBox = { top: number; left: number; width: number; height: number };

const translateOf = (element: Element) => {
  const match = /matrix\(([^)]+)\)/.exec(getComputedStyle(element).transform);
  const values = match?.[1]?.split(',').map(Number);

  return { x: values?.[4] ?? 0, y: values?.[5] ?? 0 };
};

const layoutBoxOf = (element: HTMLElement, origin: { top: number; left: number }, scale: number): ItemBox => {
  const rect = element.getBoundingClientRect();
  const translate = translateOf(element);

  return {
    top: (rect.top - origin.top) / scale - translate.y,
    left: (rect.left - origin.left) / scale - translate.x,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
};

const scaleOf = (host: HTMLElement, hostRect: DOMRect) =>
  host.offsetWidth && hostRect.width ? hostRect.width / host.offsetWidth : 1;

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
  let resizeObserver: ResizeObserver | null = null;
  let hostWidth = 0;
  let running = 0;

  const track = (animation: Animation) => {
    const host = hostSignal().currentElement;
    const movingClass = config.movingClass;

    if (!movingClass || !host) return;

    running++;
    host.classList.add(movingClass);

    const settle = () => {
      running--;

      if (running === 0) host.classList.remove(movingClass);
    };

    animation.finished.then(settle).catch(settle);
  };

  const measure = (host: HTMLElement) => {
    const next = new Map<HTMLElement, ItemBox>();

    const hostRect = host.getBoundingClientRect();
    const scale = scaleOf(host, hostRect);

    for (const item of Array.from(host.querySelectorAll<HTMLElement>(config.items))) {
      if (!copies.has(item) && (item.checkVisibility?.() ?? true)) next.set(item, layoutBoxOf(item, hostRect, scale));
    }

    return next;
  };

  const fadeOutCopy = (host: HTMLElement, item: HTMLElement, box: ItemBox) => {
    const copy = item.cloneNode(true) as HTMLElement;

    copy.removeAttribute('id');

    for (const attribute of config.attributes ?? []) copy.removeAttribute(attribute);

    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    Object.assign(copy.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${box.width}px`,
      height: `${box.height}px`,
      margin: '0',
      pointerEvents: 'none',
    });

    copies.add(copy);
    host.append(copy);

    const hostRect = host.getBoundingClientRect();
    const scale = scaleOf(host, hostRect);
    const containingBlock = layoutBoxOf(copy, hostRect, scale);

    copy.style.top = `${box.top - containingBlock.top}px`;
    copy.style.left = `${box.left - containingBlock.left}px`;

    const fade = copy.animate([{ opacity: 0 }], { duration: leaveDuration, easing: 'ease-out' });
    const remove = () => copy.remove();

    track(fade);

    fade.finished.then(remove).catch(remove);
  };

  const run = (host: HTMLElement) => {
    const previous = boxes;
    const next = measure(host);
    const shifts: { item: HTMLElement; x: number; y: number }[] = [];
    const entering: HTMLElement[] = [];

    boxes = next;

    for (const [item, box] of next) {
      const before = previous.get(item);

      if (!before) {
        entering.push(item);
        continue;
      }

      const translate = translateOf(item);
      const x = before.left + translate.x - box.left;
      const y = before.top + translate.y - box.top;

      if (Math.abs(x) >= 1 || Math.abs(y) >= 1) shifts.push({ item, x, y });
    }

    for (const [item, box] of previous) {
      if (!next.has(item)) fadeOutCopy(host, item, box);
    }

    const movesItems = shifts.length > 0 && !prefersReducedMotion() && shifts.length <= maxMoves;
    // A new item waits until the moving items have mostly passed its spot, or their text overlaps.
    const enterDelay = movesItems ? moveDuration * 0.4 : 0;

    for (const item of entering) {
      item.animate([{ opacity: 0, offset: 0 }], {
        duration: enterDuration,
        delay: enterDelay,
        easing: 'ease-out',
        fill: 'backwards',
      });
    }

    if (!movesItems) {
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
      track(move);

      const forget = () => {
        if (moves.get(item) === move) moves.delete(item);
      };

      move.finished.then(forget).catch(forget);
    }
  };

  const touchesOnlyCopies = (record: MutationRecord) =>
    record.type === 'childList' &&
    [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].every((node) => copies.has(node));

  effect(() => {
    const host = hostSignal().currentElement;
    const rendered = isRendered();

    untracked(() => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      boxes = new Map();

      if (!host || !rendered || typeof MutationObserver === 'undefined') return;

      boxes = measure(host);
      observer ??= new MutationObserver((records) => {
        const current = hostSignal().currentElement;

        if (current && !records.every(touchesOnlyCopies)) run(current);
      });
      observer.observe(host, {
        childList: true,
        subtree: true,
        ...(config.attributes?.length ? { attributes: true, attributeFilter: config.attributes } : {}),
      });

      if (typeof ResizeObserver === 'undefined') return;

      hostWidth = host.offsetWidth;
      // Boxes taken while the host was still narrow give fading copies the wrong width.
      resizeObserver ??= new ResizeObserver(() => {
        const current = hostSignal().currentElement;

        if (!current || current.offsetWidth === hostWidth) return;

        hostWidth = current.offsetWidth;
        boxes = measure(current);
      });
      resizeObserver.observe(host);
    });
  });

  destroyRef.onDestroy(() => {
    observer?.disconnect();
    resizeObserver?.disconnect();

    for (const move of moves.values()) move.cancel();
  });
};
