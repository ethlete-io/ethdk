import { Observable } from 'rxjs';

export const nextFrame = (cb: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
};

export const fromNextFrame = () => {
  return new Observable<void>((observer) => {
    nextFrame(() => {
      observer.next();
      observer.complete();
    });
  });
};

export const forceReflow = (element?: HTMLElement) => {
  // The `document.body` fallback is resolved lazily and guarded: there is nothing to reflow on the
  // server, so this becomes a no-op instead of throwing on a missing `document`.
  const el = element ?? (typeof document === 'undefined' ? null : document.body);

  return el?.offsetHeight ?? 0;
};

/**
 * Whether the user asked for reduced motion, read straight from `matchMedia`.
 *
 * Inside a component, prefer the reactive `injectPrefersReducedMotion()`. This is for the animation
 * helpers that run from effects, event handlers and imperative APIs, where there is no injection
 * context. Pass the element being animated so the query resolves against its own window - otherwise
 * an animation inside an iframe would read the top-level document's preference.
 */
export const matchesReducedMotion = (element?: Element) => {
  const view = element?.ownerDocument.defaultView ?? (typeof window === 'undefined' ? null : window);

  return view?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;
};
