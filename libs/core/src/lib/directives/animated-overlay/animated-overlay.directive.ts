import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, ComponentType } from '@angular/cdk/portal';
import {
  ComponentRef,
  Directive,
  ElementRef,
  Injector,
  Input,
  NgZone,
  StaticProvider,
  ViewContainerRef,
  inject,
  isDevMode,
} from '@angular/core';
import { Instance as PopperInstance, Placement as PopperPlacement, createPopper } from '@popperjs/core';
import { Options as ArrowOptions } from '@popperjs/core/lib/modifiers/arrow';
import { Options as OffsetOptions } from '@popperjs/core/lib/modifiers/offset';
import { BehaviorSubject, Subject, filter, take, takeUntil, tap } from 'rxjs';
import { createDestroy, nextFrame } from '../../utils';
import { AnimatedLifecycleDirective } from '../animated-lifecycle';
import { ObserveResizeDirective } from '../observe-resize';

export interface AnimatedOverlayComponentBase {
  _animatedLifecycle?: AnimatedLifecycleDirective;
  _markForCheck?: () => void;
}

@Directive({
  standalone: true,
  hostDirectives: [ObserveResizeDirective],
})
export class AnimatedOverlayDirective<T extends AnimatedOverlayComponentBase> {
  private readonly _destroy$ = createDestroy();
  private readonly _overlayService = inject(Overlay);
  private readonly _injector = inject(Injector);
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _zone = inject(NgZone);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _observeResize = inject(ObserveResizeDirective);

  private _portal: ComponentPortal<T> | null = null;
  private _overlayRef: OverlayRef | null = null;
  private _componentRef: ComponentRef<T> | null = null;
  private _popper: PopperInstance | null = null;

  private _beforeOpened: Subject<void> | null = null;
  private _afterOpened: Subject<void> | null = null;
  private _beforeClosed: Subject<void> | null = null;
  private _afterClosed: Subject<void> | null = null;

  private readonly _isMounted$ = new BehaviorSubject<boolean>(false);

  /**
   * The placement of the animated overlay.
   * @default 'auto'
   */
  @Input()
  placement: PopperPlacement = 'auto';

  /**
   * The allowed auto placements of the animated overlay.
   * @see https://popper.js.org/docs/v2/modifiers/flip/#allowedautoplacements
   */
  @Input()
  allowedAutoPlacements?: PopperPlacement[];

  /**
   * The offset of the animated overlay.
   * @see https://popper.js.org/docs/v2/modifiers/offset/#offset-1
   */
  @Input()
  offset: OffsetOptions['offset'] | Readonly<OffsetOptions['offset']> | null = null;

  /**
   * The arrow padding.
   * @see https://popper.js.org/docs/v2/modifiers/arrow/#padding
   * @default 4
   */
  @Input()
  arrowPadding: ArrowOptions['padding'] | null = null;

  get isMounted() {
    return this._isMounted$.value;
  }

  get isMounted$() {
    return this._isMounted$.asObservable();
  }

  get portal() {
    return this._portal;
  }

  get overlayRef() {
    return this._overlayRef;
  }

  get componentRef() {
    return this._componentRef;
  }

  get popper() {
    return this._popper;
  }

  mount(config: {
    component: ComponentType<T>;
    providers?: StaticProvider[];
    data?: Partial<T>;
    mirrorWidth?: boolean;
  }) {
    if (this.isMounted) {
      if (isDevMode()) {
        console.warn(
          'AnimatedOverlayDirective: There is already a component mounted. Please call `unmount` before calling `mount` again.',
        );
      }

      return;
    }

    const { component, providers, data, mirrorWidth } = config;

    this._beforeOpened?.next();

    const injector = Injector.create({
      parent: this._injector,
      providers: providers ?? [],
    });

    this._overlayRef = this._overlayService.create();

    this._portal = this._portal ?? new ComponentPortal(component, this._viewContainerRef, injector);
    this._componentRef = this._overlayRef.attach(this._portal);

    if (data) {
      Object.assign(this._componentRef.instance, data);
    }

    this._componentRef.instance._markForCheck?.();

    if (mirrorWidth) {
      this._overlayRef.updateSize({
        width: this._elementRef.nativeElement.offsetWidth,
      });

      this._observeResize.valueChange
        .pipe(
          tap(() => {
            this._overlayRef?.updateSize({
              width: this._elementRef.nativeElement.offsetWidth,
            });

            this._popper?.update();
          }),
          takeUntil(this._destroy$),
          takeUntil(this.afterClosed()),
        )
        .subscribe();
    }

    this._zone.runOutsideAngular(() => {
      if (!this._componentRef) {
        return;
      }
      this._popper = createPopper(this._elementRef.nativeElement, this._componentRef.location.nativeElement, {
        placement: this.placement,
        modifiers: [
          ...(this.offset
            ? [
                {
                  name: 'offset',
                  options: {
                    offset: this.offset,
                  },
                },
              ]
            : []),
          ...(this.arrowPadding
            ? [
                {
                  name: 'arrow',
                  options: {
                    padding: this.arrowPadding,
                  },
                },
              ]
            : []),
          ...(this.allowedAutoPlacements
            ? [
                {
                  name: 'flip',
                  options: {
                    allowedAutoPlacements: this.allowedAutoPlacements,
                  },
                },
              ]
            : []),
        ],
      });

      // We need to wait for the  content to be rendered
      nextFrame(() => {
        if (!this._componentRef) {
          return;
        }

        this._popper?.update();
        this._componentRef.instance._animatedLifecycle?.enter();

        this._componentRef.instance._animatedLifecycle?.state$
          .pipe(
            tap((s) => {
              if (s === 'entered') {
                this._afterOpened?.next();
              }
            }),
            take(1),
            takeUntil(this._destroy$),
          )
          .subscribe();

        this._isMounted$.next(true);
      });
    });

    return this._componentRef.instance;
  }

  unmount() {
    if (!this._componentRef) {
      return;
    }

    this._beforeClosed?.next();

    this._componentRef.instance._animatedLifecycle?.leave();

    this._componentRef.instance._animatedLifecycle?.state$
      .pipe(
        filter((s) => s === 'left'),
        take(1),
      )
      .subscribe(() => this._destroy());
  }

  beforeOpened() {
    if (!this._beforeOpened) {
      this._beforeOpened = new Subject();
    }

    return this._beforeOpened;
  }

  afterOpened() {
    if (!this._afterOpened) {
      this._afterOpened = new Subject();
    }

    return this._afterOpened;
  }

  beforeClosed() {
    if (!this._beforeClosed) {
      this._beforeClosed = new Subject();
    }

    return this._beforeClosed;
  }

  afterClosed() {
    if (!this._afterClosed) {
      this._afterClosed = new Subject();
    }

    return this._afterClosed;
  }

  _destroy() {
    this._zone.runOutsideAngular(() => {
      this._popper?.destroy();
      this._popper = null;
    });

    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }

    if (this._componentRef) {
      this._componentRef.destroy();
      this._componentRef = null;
    }

    this._isMounted$.next(false);

    this._afterClosed?.next();
  }

  _reposition() {
    this._popper?.update();
  }
}
