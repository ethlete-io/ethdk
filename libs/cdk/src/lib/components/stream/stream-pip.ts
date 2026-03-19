import { DOCUMENT, Signal, computed, inject, signal } from '@angular/core';
import { createRootProvider } from '@ethlete/core';

type StreamPipEntry = {
  element: HTMLElement;
  originalParent: HTMLElement;
  originalNextSibling: Node | null;
};

type NodeWithMoveBefore = HTMLElement & { moveBefore: (child: Node, before: Node | null) => void };

export const pipMoveBefore = (newParent: HTMLElement, child: HTMLElement, before: Node | null = null): void => {
  if ('moveBefore' in newParent) {
    try {
      (newParent as NodeWithMoveBefore).moveBefore(child, before);
    } catch {
      newParent.insertBefore(child, before);
    }
  } else {
    (newParent as HTMLElement).insertBefore(child, before);
  }
};

export const animateWithFixedWrapper = (config: {
  playerEl: HTMLElement;
  fromRect: DOMRect;
  toRect: DOMRect;
  document: Document;
  onFinish: () => void;
  duration?: number;
  easing?: string;
}): void => {
  const {
    playerEl,
    fromRect,
    toRect,
    document,
    onFinish,
    duration = 250,
    easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  } = config;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: fixed;
    left: ${fromRect.left}px;
    top: ${fromRect.top}px;
    width: ${fromRect.width}px;
    height: ${fromRect.height}px;
    overflow: visible;
    pointer-events: none;
    z-index: 2147483647;
  `;
  document.body.appendChild(wrapper);
  pipMoveBefore(wrapper, playerEl);

  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;
  const sx = fromRect.width > 0 ? toRect.width / fromRect.width : 1;
  const sy = fromRect.height > 0 ? toRect.height / fromRect.height : 1;

  const anim = wrapper.animate(
    [
      { transformOrigin: 'top left', transform: 'none' },
      { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
    ],
    { duration, easing, fill: 'both' },
  );

  const cleanup = () => {
    onFinish();
    wrapper.remove();
  };

  anim.addEventListener('finish', cleanup, { once: true });
  anim.addEventListener('cancel', cleanup, { once: true });
};

export type StreamPipManager = {
  /** Whether a PIP session is currently active. */
  isActive: Signal<boolean>;

  /**
   * Moves `element` into the body-level PIP container using `moveBefore`.
   * Records its original position so it can be restored by `deactivate()`.
   * No-op if a PIP session is already active.
   */
  activate: (element: HTMLElement) => void;

  /**
   * Moves the active PIP element back to its recorded original position.
   * If the original parent is no longer in the DOM (e.g. the route was destroyed),
   * the element is removed from the PIP container instead.
   * No-op if no PIP session is active.
   */
  deactivate: () => void;

  /** The body-level container element. Useful for custom positioning / styling. */
  container: HTMLElement;
};

export const [provideStreamPipManager, injectStreamPipManager] = createRootProvider(
  (): StreamPipManager => {
    const document = inject(DOCUMENT);

    const container = document.createElement('div');
    container.className = 'et-stream-pip';
    document.body.appendChild(container);

    const _entry = signal<StreamPipEntry | null>(null);
    const isActive = computed(() => _entry() !== null);

    const activate = (element: HTMLElement): void => {
      if (_entry()) return;

      const originalParent = element.parentElement;

      if (!originalParent) {
        console.warn('[StreamPipManager] activate() called on a detached element.');
        return;
      }

      const originalNextSibling = element.nextSibling;

      pipMoveBefore(container, element);
      _entry.set({ element, originalParent, originalNextSibling });
    };

    const deactivate = (): void => {
      const entry = _entry();
      if (!entry) return;

      const { element, originalParent, originalNextSibling } = entry;

      if (originalParent.isConnected) {
        pipMoveBefore(originalParent, element, originalNextSibling);
      } else {
        element.remove();
      }

      _entry.set(null);
    };

    return { activate, deactivate, isActive, container };
  },
  { name: 'Stream PIP Manager' },
);
