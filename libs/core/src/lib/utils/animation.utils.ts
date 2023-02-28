import { Observable, Subject } from 'rxjs';

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

export const forceReflow = (element: HTMLElement = document.body) => {
  return element.offsetHeight;
};

export const createFlipAnimation = (config: { element: HTMLElement; duration?: number; easing?: string }) => {
  const { element: el, duration = 250, easing = 'cubic-bezier(0.4, 0, 0.2, 1)' } = config;

  let initialRect = el.getBoundingClientRect();
  let animation: Animation | null = null;

  const onStart$ = new Subject<void>();
  const onFinish$ = new Subject<void>();
  const onCancel$ = new Subject<void>();

  const onAnimationFinish = () => {
    cleanup();
    onFinish$.next();
  };

  const onAnimationCancel = () => {
    cleanup();
    onCancel$.next();
  };

  const cleanup = () => {
    if (!animation) {
      return;
    }

    animation.removeEventListener('finish', onAnimationFinish);
    animation.removeEventListener('cancel', onAnimationCancel);
  };

  const updateInit = () => {
    initialRect = el.getBoundingClientRect();
  };

  const play = () => {
    const lastRect = el.getBoundingClientRect();

    const delta = {
      x: initialRect.left - lastRect.left,
      y: initialRect.top - lastRect.top,
      scaleX: initialRect.width / lastRect.width,
      scaleY: initialRect.height / lastRect.height,
    };

    animation = el.animate(
      [
        {
          transformOrigin: 'top left',
          transform: `
          translate(${delta.x}px, ${delta.y}px)
          scale(${delta.scaleX}, ${delta.scaleY})
        `,
        },
        {
          transformOrigin: 'top left',
          transform: 'none',
        },
      ],
      {
        duration,
        easing,
        fill: 'both',
      },
    );

    animation.addEventListener('finish', onAnimationFinish);
    animation.addEventListener('cancel', onAnimationCancel);

    onStart$.next();
  };

  const cancel = () => {
    animation?.cancel();

    cleanup();
  };

  return {
    updateInit,
    play,
    cancel,
    onStart$: onStart$.asObservable(),
    onFinish$: onFinish$.asObservable(),
    onCancel$: onCancel$.asObservable(),
  };
};
