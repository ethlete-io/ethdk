import { combineLatest, Subject } from 'rxjs';

interface FlipAnimationGroupConfig {
  /**
   * The elements to animate
   */
  elements: Array<HTMLElement | { element: HTMLElement; originElement?: HTMLElement }>;

  /**
   * The duration of the animation in milliseconds
   * @default 250
   */
  duration?: number;

  /**
   * The easing function to use for the animation
   * @default 'cubic-bezier(0.4, 0, 0.2, 1)'
   */
  easing?: string;
}

export const createFlipAnimationGroup = (config: FlipAnimationGroupConfig) => {
  const { elements, duration = 250, easing = 'cubic-bezier(0.4, 0, 0.2, 1)' } = config;

  const flips = elements.map((el) => {
    const element = 'element' in el ? el.element : el;
    const originElement = 'originElement' in el ? el.originElement : undefined;

    return createFlipAnimation({ element, originElement, duration, easing });
  });

  const onStart$ = combineLatest(flips.map((animation) => animation.onStart$));
  const onFinish$ = combineLatest(flips.map((animation) => animation.onFinish$));
  const onCancel$ = combineLatest(flips.map((animation) => animation.onCancel$));

  const updateInit = () => {
    flips.forEach((animation) => animation.updateInit());
  };

  const play = () => {
    flips.forEach((animation) => animation.play());
  };

  const cancel = () => {
    flips.forEach((animation) => animation.cancel());
  };

  return {
    updateInit,
    play,
    cancel,
    onStart$,
    onFinish$,
    onCancel$,
  };
};

export interface FlipAnimationConfig {
  /**
   * The element to animate
   */
  element: HTMLElement;

  /**
   * The element to use as the origin for the animation
   * @default element
   */
  originElement?: HTMLElement;

  /**
   * The duration of the animation in milliseconds
   * @default 250
   */
  duration?: number;

  /**
   * The easing function to use for the animation
   * @default 'cubic-bezier(0.4, 0, 0.2, 1)'
   */
  easing?: string;
}

export const createFlipAnimation = (config: FlipAnimationConfig) => {
  const { element: el, originElement = el, duration = 250, easing = 'cubic-bezier(0.4, 0, 0.2, 1)' } = config;

  let initialRect = originElement.getBoundingClientRect();
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
    initialRect = originElement.getBoundingClientRect();
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
