import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ContentChildren,
  DestroyRef,
  Directive,
  ElementRef,
  InjectionToken,
  Injector,
  Signal,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  AnyTemplateType,
  PropsDirective,
  TypedQueryList,
  createDependencyStash,
  createHostProps,
  createProps,
  createSetup,
  forceReflow,
  fromNextFrame,
  templateComputed,
} from '@ethlete/core';
import {
  Placement,
  arrow,
  autoUpdate,
  computePosition,
  flip,
  hide,
  limitShift,
  offset,
  shift,
  size,
} from '@floating-ui/dom';
import { Subject, filter, fromEvent, merge, pairwise, switchMap, take, takeUntil, tap } from 'rxjs';

export const ACCORDION_TOKEN = new InjectionToken<EtAccordionItemDirective>('ACCORDION_TOKEN');

@Directive({
  standalone: true,
  providers: [{ provide: ACCORDION_TOKEN, useExisting: EtAccordionItemDirective }],
})
export class EtAccordionItemDirective {
  disabled = input(false);

  isExpanded = input(false);
  isExpandedManual = signal(false);

  toggleExpanded() {
    this.isExpandedManual.set(!this.isExpandedManual());
  }

  constructor() {
    effect(
      () => {
        this.isExpandedManual.set(this.isExpanded());
      },
      { allowSignalWrites: true },
    );
  }

  headerProps = createProps({
    name: 'ethleteAccordion -> headerProps',
    bindId: true,
    classes: {
      'et-arch-test-accordion__button--disabled': this.disabled,
      'et-arch-test-accordion__button--expanded': this.isExpandedManual,
    },
    attributes: {
      'aria-expanded': this.isExpandedManual,
      'aria-controls': computed(() => this.bodyProps.attachedElements.firstId()),
      disabled: this.disabled,
    },
    styles: {
      color: computed(() => (this.isExpandedManual() ? 'red' : 'blue')),
    },
    listeners: ({ on }) => {
      on('click', () => {
        this.isExpandedManual.set(!this.isExpandedManual());
      });
    },
  });

  bodyProps = createProps({
    name: 'ethleteAccordion -> bodyProps',
    classes: {
      'et-arch-test-accordion__body--expanded': this.isExpandedManual,
    },
    attributes: {
      'aria-hidden': computed(() => !this.isExpandedManual()),
      'aria-labelledby': this.headerProps.attachedElements.firstId,
    },
    styles: {
      height: computed(() => (this.isExpandedManual() ? 'auto' : '0px')),
      opacity: computed(() => (this.isExpandedManual() ? '1' : '0')),
      'pointer-events': computed(() => (this.isExpandedManual() ? 'auto' : 'none')),
    },
  });
}

@Directive({
  standalone: true,
})
export class EtAccordionDirective {
  injector = inject(Injector);

  mode = input<'single' | 'multiple'>('single');

  _externals = createDependencyStash({
    items: signal<EtAccordionItemDirective[]>([]),
  });

  _expandedStates = computed(() => this._externals.items().map((item) => item.isExpandedManual()));

  constructor() {
    const expandedStates = toObservable(this._expandedStates);

    toObservable(this.mode)
      .pipe(
        takeUntilDestroyed(),
        filter((mode) => mode === 'single'),
        switchMap(() => expandedStates),
        pairwise(),
        tap(([prev, curr]) => {
          const prevIndex = prev.findIndex((state) => state);
          const currIndex = curr.findIndex((state, i) => state && i !== prevIndex);

          if (prevIndex === currIndex || currIndex === -1) {
            return;
          }

          if (prevIndex !== -1) {
            this._externals.items()[prevIndex]?.isExpandedManual.set(false);
          }

          if (currIndex !== -1) {
            this._externals.items()[currIndex]?.isExpandedManual.set(true);
          }
        }),
      )
      .subscribe();
  }

  setup = createSetup<{ items: Signal<EtAccordionItemDirective[]> }>({
    this: this,
    setupFn: ({ items }) => this._externals.provideSignal({ signal: items, for: 'items' }),
  });
}

@Component({
  selector: 'ethlete-arch-test-accordion',
  template: `<ng-content />`,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: EtAccordionDirective, inputs: ['mode'] }],
})
export class ArchTestAccordionComponent {
  accordion = inject(EtAccordionDirective);

  @ContentChildren(EtAccordionItemDirective)
  set __items(value: TypedQueryList<EtAccordionItemDirective>) {
    this.items.set(value.toArray());
  }
  items = signal<EtAccordionItemDirective[]>([]);

  constructor() {
    this.accordion.setup({ items: this.items });
  }
}

@Component({
  selector: 'ethlete-arch-test-accordion-item',
  template: `
    <button [etProps]="item.headerProps">{{ label() }}</button>
    <div [etProps]="item.bodyProps" style="background-color: dimgray;">
      <ng-content />
    </div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [PropsDirective],
  hostDirectives: [{ directive: EtAccordionItemDirective, inputs: ['disabled', 'isExpanded'] }],
})
export class ArchTestAccordionItemComponent {
  item = inject(EtAccordionItemDirective);

  label = input.required<string>();
}

type OverlayComponentProps = { overlay: EtOverlayDirective };
type OverlayComponentType = ComponentType<OverlayComponentProps>;

export interface CreateOverlayPositionerOptions {
  /** The element the overlay should get attached to */
  referenceElement: HTMLElement;

  /** The overlay to position */
  overlayElement: HTMLElement;

  viewportPadding?: number;

  placement?: Placement;

  offset?: number;

  boundary?: HTMLElement;

  fallbackPlacements?: Placement[];

  autoResize?: boolean;

  autoHide?: boolean;

  shift?: boolean;

  arrow?: {
    element: HTMLElement;
    padding?: number;
  };
}

const createOverlayPositioner = () => {
  let cleanupFn: (() => void) | null = null;
  const ACTIVE_CLASS = 'et-uses-overlay-positioner';

  const attach = (options: CreateOverlayPositionerOptions) => {
    const { referenceElement, overlayElement } = options;

    overlayElement.classList.add(ACTIVE_CLASS);

    cleanupFn = autoUpdate(referenceElement, overlayElement, () => {
      computePosition(referenceElement, overlayElement, {
        placement: options.placement,

        middleware: [
          ...(options.offset ? [offset(options.offset)] : []),
          flip({
            fallbackPlacements: options.fallbackPlacements ?? undefined,
            fallbackAxisSideDirection: 'start',
            boundary: options.boundary,
          }),
          ...(options.autoResize
            ? [
                size({
                  padding: options.viewportPadding ?? undefined,
                  apply({ availableHeight, availableWidth }) {
                    overlayElement.style.setProperty('--et-floating-max-width', `${availableWidth}px`);
                    overlayElement.style.setProperty('--et-floating-max-height', `${availableHeight}px`);
                  },
                }),
              ]
            : []),
          ...(options.shift
            ? [
                shift({
                  limiter: limitShift(),
                  padding: options.viewportPadding ?? undefined,
                  boundary: options.boundary,
                }),
              ]
            : []),
          ...(options.arrow?.element
            ? [arrow({ element: options.arrow.element, padding: options.arrow.padding ?? undefined })]
            : []),
          ...(options.autoHide ? [hide({ strategy: 'referenceHidden', boundary: options.boundary })] : []),
        ],
      }).then(({ x, y, placement, middlewareData }) => {
        overlayElement.style.setProperty('--et-floating-translate', `translate3d(${x}px, ${y}px, 0)`);
        overlayElement.setAttribute('et-floating-placement', placement);

        if (middlewareData.arrow && options.arrow?.element) {
          const { x: arrowX, y: arrowY } = middlewareData.arrow;

          overlayElement.style.setProperty(
            '--et-floating-arrow-translate',
            `translate3d(${arrowX ?? 0}px, ${arrowY ?? 0}px, 0)`,
          );
        }

        if (middlewareData.hide?.referenceHidden) {
          overlayElement.classList.add('et-floating-element--hidden');
        } else {
          overlayElement.classList.remove('et-floating-element--hidden');
        }
      });
    });
  };

  const detach = () => {
    cleanupFn?.();
    cleanupFn = null;
  };

  inject(DestroyRef).onDestroy(() => detach());

  return { attach, detach };
};

const createAnimationState = () => {
  const detach$ = new Subject<void>();

  const isAnimating = signal(false);
  const isAnimating$ = toObservable(isAnimating);

  const attach = (options: { element: HTMLElement }) => {
    const element = options.element;

    merge(fromEvent<AnimationEvent>(element, 'animationstart'), fromEvent<TransitionEvent>(element, 'transitionstart'))
      .pipe(
        filter((e) => e.target === element), // skip events from children
        tap(() => {
          isAnimating.set(true);
        }),
        takeUntil(detach$),
      )
      .subscribe();

    merge(
      fromEvent<AnimationEvent>(element, 'animationend'),
      fromEvent<AnimationEvent>(element, 'animationcancel'),
      fromEvent<TransitionEvent>(element, 'transitionend'),
      fromEvent<TransitionEvent>(element, 'transitioncancel'),
    )
      .pipe(
        filter((e) => e.target === element), // skip events from children
        tap(() => {
          isAnimating.set(false);
        }),
        takeUntil(detach$),
      )
      .subscribe();
  };

  const detach = () => {
    detach$.next();
    isAnimating.set(false);
  };

  inject(DestroyRef).onDestroy(() => {
    detach();
  });

  return { isAnimating, isAnimating$, attach, detach };
};

const ANIMATION_CLASSES = {
  enterFrom: 'et-animation-enter-from',
  enterActive: 'et-animation-enter-active',
  enterTo: 'et-animation-enter-to',
  leaveFrom: 'et-animation-leave-from',
  leaveActive: 'et-animation-leave-active',
  leaveTo: 'et-animation-leave-to',
} as const;

const createAnimatedLifecycle = () => {
  const animationState = createAnimationState();
  const lifecycleState = signal<'init' | 'entering' | 'entered' | 'leaving' | 'left'>('init');
  const detach$ = new Subject<void>();

  let didFirstRender = false;

  afterNextRender({ write: () => (didFirstRender = true) });

  const enter = (options: { element: HTMLElement }) => {
    animationState.attach({ element: options.element });
    const classes = options.element.classList;
    const state = lifecycleState();

    if (state === 'entering') return;

    if (state === 'init' && !didFirstRender) {
      // Force the state to entered so that the element is not animated when it is first rendered.
      lifecycleState.set('entered');
      return;
    }

    if (state === 'leaving') {
      classes.remove(ANIMATION_CLASSES.leaveFrom, ANIMATION_CLASSES.leaveActive, ANIMATION_CLASSES.leaveTo);
    }

    lifecycleState.set('entering');

    classes.add(ANIMATION_CLASSES.enterFrom);

    forceReflow();
    classes.add(ANIMATION_CLASSES.enterActive);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (lifecycleState() !== 'entering') return;

          classes.remove(ANIMATION_CLASSES.enterFrom);
          classes.add(ANIMATION_CLASSES.enterTo);
        }),
        switchMap(() => animationState.isAnimating$),
        tap(() => {
          if (lifecycleState() !== 'entering') return;

          lifecycleState.set('entered');
          classes.remove(ANIMATION_CLASSES.enterActive);
          classes.remove(ANIMATION_CLASSES.enterTo);
        }),
        takeUntil(detach$),
        take(1),
      )
      .subscribe();
  };

  const leave = (options: { element: HTMLElement }) => {
    animationState.attach({ element: options.element });
    const classes = options.element.classList;
    const state = lifecycleState();

    if (state === 'left') return;

    if (state === 'init') {
      lifecycleState.set('left');
      return;
    }

    if (state === 'entering') {
      classes.remove(ANIMATION_CLASSES.enterFrom, ANIMATION_CLASSES.enterActive, ANIMATION_CLASSES.enterTo);
    }

    lifecycleState.set('leaving');

    classes.add(ANIMATION_CLASSES.leaveFrom);

    forceReflow();
    classes.add(ANIMATION_CLASSES.leaveActive);

    fromNextFrame()
      .pipe(
        tap(() => {
          if (lifecycleState() !== 'leaving') return;

          classes.remove(ANIMATION_CLASSES.leaveFrom);
          classes.add(ANIMATION_CLASSES.leaveTo);
        }),
        switchMap(() => animationState.isAnimating$),
        tap(() => {
          if (lifecycleState() !== 'leaving') return;

          lifecycleState.set('left');
          classes.remove(ANIMATION_CLASSES.leaveActive);
          classes.remove(ANIMATION_CLASSES.leaveTo);
        }),
        takeUntil(detach$),
        take(1),
      )
      .subscribe();
  };

  const detach = () => {
    detach$.next();
    animationState.detach();
    lifecycleState.set('init');
  };

  inject(DestroyRef).onDestroy(() => {
    detach();
  });

  return { enter, leave, detach };
};

@Directive({
  standalone: true,
})
export class EtOverlayTriggerDirective {
  overlay = inject(Overlay);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  isMounted = signal(false);

  _externals = createDependencyStash({
    container: signal<OverlayComponentType | null>(null),
    overlayContent: signal<AnyTemplateType | null>(null),
  });

  _portal: ComponentPortal<OverlayComponentProps> | null = null;
  _overlayRef: OverlayRef | null = null;
  _componentRef: ComponentRef<OverlayComponentProps> | null = null;
  _overlayPositioner = createOverlayPositioner();
  _overlayAnimation = createAnimatedLifecycle();

  _hostProps = createHostProps({
    name: 'EtOverlayTriggerDirective -> hostProps',
    classes: {
      'et-arch-test-overlay-trigger--open': this.isMounted,
    },
    listeners: ({ on }) => {
      on('click', () => this.toggleMounted());
    },
  });

  constructor() {
    effect(() => {
      const component = this._externals.container();

      if (!component) return;

      this._portal?.detach();
      this._portal = new ComponentPortal(component);
    });
  }

  setup = createSetup<{ container: OverlayComponentType; overlayContent: Signal<AnyTemplateType> }>({
    this: this,
    setupFn: ({ container, overlayContent }) => {
      this._externals.provideValue({ value: container, for: 'container' });
      this._externals.provideSignal({ signal: overlayContent, for: 'overlayContent' });
    },
  });

  // TODO: Animations
  toggleMounted() {
    const component = this._externals.container();

    if (!component || !this._portal) return;

    if (!this._componentRef || !this._overlayRef) {
      this._overlayRef = this.overlay.create();
      this._componentRef = this._overlayRef.attach(this._portal);
      this._componentRef.instance.overlay._content.set(this._externals.overlayContent());

      this._overlayPositioner.attach({
        referenceElement: this.elementRef.nativeElement,
        overlayElement: this._overlayRef.overlayElement,
      });

      this._overlayAnimation.enter({ element: this._overlayRef.overlayElement });

      this.isMounted.set(true);
    } else {
      this._overlayRef.dispose();
      this._componentRef.destroy();

      this._componentRef = null;
      this._overlayRef = null;

      this._overlayPositioner.detach();

      this.isMounted.set(false);
    }
  }
}

@Directive({
  standalone: true,
})
export class EtOverlayDirective {
  _content = signal<AnyTemplateType | null>(null);

  template = templateComputed(this._content);

  arrowProps = createProps({
    name: 'EtOverlayDirective -> arrowProps',
    staticAttributes: {
      'et-floating-arrow': true,
    },
  });
}

@Directive({
  selector: '[ethleteOverlayTrigger]',
  standalone: true,
  hostDirectives: [EtOverlayTriggerDirective],
})
export class ArchTestOverlayTriggerDirective {
  trigger = inject(EtOverlayTriggerDirective);

  overlayContent = input.required<AnyTemplateType>({ alias: 'ethleteOverlayTrigger' });

  constructor() {
    this.trigger.setup({ container: ArchTestOverlayComponent, overlayContent: this.overlayContent });
  }
}

@Component({
  selector: 'ethlete-overlay',
  template: `
    @if (overlay.template(); as template) {
      @switch (template.type) {
        @case ('string') {
          <p>{{ template.value }}</p>
        }
        @case ('template') {
          <ng-container *ngTemplateOutlet="template.value; context: template.context; injector: template.injector" />
        }
        @case ('component') {
          <ng-container *ngComponentOutlet="template.value; inputs: template.inputs" />
        }
      }
    }
    <div [etProps]="overlay.arrowProps"></div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: [
    `
      ethlete-overlay {
        display: block;
        background-color: red;
        padding: 20px;
      }

      .et-uses-overlay-positioner {
        width: max-content;
        position: absolute;
        top: 0;
        left: 0;
        transform: var(--et-floating-translate);
        will-change: transform;
      }

      .et-animation-enter-from,
      .et-animation-leave-to {
        opacity: 0;
        transform: scale(0);
      }

      .et-animation-enter-active {
        transition:
          transform 250ms var(--ease-out-5),
          opacity 250ms var(--ease-out-5);

        @supports (transition-timing-function: linear(0, 1)) {
          transition:
            transform 250ms var(--ease-spring-1),
            opacity 250ms var(--ease-spring-1);
        }
      }

      .et-animation-leave-active {
        transition:
          transform 100ms var(--ease-in-5),
          opacity 100ms var(--ease-in-5);
      }
    `,
  ],
  imports: [NgTemplateOutlet, NgComponentOutlet, PropsDirective],
  hostDirectives: [EtOverlayDirective],
})
export class ArchTestOverlayComponent {
  overlay = inject(EtOverlayDirective);
}
