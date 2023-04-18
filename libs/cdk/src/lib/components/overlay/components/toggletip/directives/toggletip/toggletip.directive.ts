import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ComponentRef,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  InjectionToken,
  Injector,
  Input,
  NgZone,
  OnDestroy,
  Output,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { ClickObserverService, nextFrame } from '@ethlete/core';
import { createPopper, Instance as PopperInstance, Placement as PopperPlacement } from '@popperjs/core';
import { filter, fromEvent, Subscription, take, tap } from 'rxjs';
import { ToggletipComponent } from '../../components';
import { TOGGLETIP_CONFIG, TOGGLETIP_TEMPLATE, TOGGLETIP_TEXT } from '../../constants';
import { ToggletipConfig } from '../../types';
import { createToggletipConfig } from '../../utils';

type ToggletipTemplate = string | TemplateRef<unknown>;

export const TOGGLETIP_DIRECTIVE = new InjectionToken<ToggletipDirective>('TOGGLETIP_DIRECTIVE');

@Directive({
  selector: '[etToggletip]',
  standalone: true,
  providers: [
    {
      provide: TOGGLETIP_DIRECTIVE,
      useExisting: ToggletipDirective,
    },
  ],
})
export class ToggletipDirective implements OnDestroy {
  private _defaultConfig = inject<ToggletipConfig>(TOGGLETIP_CONFIG, { optional: true }) ?? createToggletipConfig();

  @Input('etToggletip')
  get toggletip() {
    return this._toggletip;
  }
  set toggletip(v: ToggletipTemplate | null) {
    this._toggletip = v;
  }
  private _toggletip: ToggletipTemplate | null = null;

  @Input()
  get showToggletip(): boolean {
    return this._showToggletip;
  }
  set showToggletip(value: BooleanInput) {
    this._showToggletip = coerceBooleanProperty(value);

    if (this._showToggletip && !this._overlayRef) {
      nextFrame(() => {
        this._mountToggletip();
        this._addListeners();
      });
    } else if (!this._showToggletip && this._overlayRef) {
      this._animateUnmount();
      this._removeListeners();
    }
  }
  private _showToggletip = false;

  @Input()
  placement: PopperPlacement = this._defaultConfig.placement;

  @Output()
  toggletipClose = new EventEmitter();

  private _hostElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _viewContainerRef = inject(ViewContainerRef);
  private _overlayService = inject(Overlay);
  private _clickObserverService = inject(ClickObserverService);
  private _injector = inject(Injector);
  private _zone = inject(NgZone);

  private _overlayRef: OverlayRef | null = null;
  private _portal: ComponentPortal<ToggletipComponent> | null = null;
  private _toggletipRef: ComponentRef<ToggletipComponent> | null = null;
  private _popper: PopperInstance | null = null;

  private readonly _listenerSubscriptions: Subscription[] = [];

  ngOnDestroy(): void {
    this._unmountToggletip();
    this._removeListeners();
  }

  private _addListeners() {
    const keyupEscSub = fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(
        filter((e) => e.key === 'Escape'),
        tap(() => this._animateUnmount()),
      )
      .subscribe();

    const clickOutsideSub = this._clickObserverService
      .observe(this._toggletipRef?.location.nativeElement)
      .subscribe((e) => {
        const targetElement = e.target as HTMLElement;
        const isInside = this._toggletipRef?.location.nativeElement.contains(targetElement);

        if (!isInside) {
          this._animateUnmount();
        }
      });

    this._listenerSubscriptions.push(keyupEscSub, clickOutsideSub);
  }

  private _removeListeners() {
    this._listenerSubscriptions.forEach((s) => s.unsubscribe());
    this._listenerSubscriptions.length = 0;
  }

  private _mountToggletip() {
    this._overlayRef = this._createOverlay();

    const injector = Injector.create({
      parent: this._injector,
      providers: [
        {
          provide: TOGGLETIP_CONFIG,
          useValue: this._defaultConfig,
        },
        ...[
          typeof this.toggletip === 'string'
            ? {
                provide: TOGGLETIP_TEXT,
                useValue: this.toggletip,
              }
            : {
                provide: TOGGLETIP_TEMPLATE,
                useValue: this.toggletip,
              },
        ],
      ],
    });

    this._portal = this._portal ?? new ComponentPortal(ToggletipComponent, this._viewContainerRef, injector);
    this._toggletipRef = this._overlayRef.attach(this._portal);

    this._toggletipRef.instance._markForCheck();

    this._zone.runOutsideAngular(() => {
      if (!this._toggletipRef) {
        return;
      }

      this._popper = createPopper(this._hostElementRef.nativeElement, this._toggletipRef.location.nativeElement, {
        placement: this.placement,
        modifiers: [
          ...(this._defaultConfig.offset
            ? [
                {
                  name: 'offset',
                  options: {
                    offset: this._defaultConfig.offset,
                  },
                },
              ]
            : []),
          ...(this._defaultConfig.arrowPadding
            ? [
                {
                  name: 'arrow',
                  options: {
                    padding: this._defaultConfig.arrowPadding,
                  },
                },
              ]
            : []),
        ],
      });

      // We need to wait for the toggletip content to be rendered
      nextFrame(() => {
        if (!this._toggletipRef) {
          return;
        }

        this._popper?.update();
        this._toggletipRef.instance._animatedLifecycle?.enter();
      });
    });
  }

  _animateUnmount() {
    if (!this._toggletipRef || this._toggletipRef.instance._animatedLifecycle?.state === 'leaving') {
      return;
    }

    this._toggletipRef.instance._animatedLifecycle?.leave();

    this._toggletipRef.instance._animatedLifecycle?.state$
      .pipe(
        filter((s) => s === 'left'),
        take(1),
      )
      .subscribe(() => this._unmountToggletip());
  }

  private _unmountToggletip() {
    this._zone.runOutsideAngular(() => {
      this._popper?.destroy();
      this._popper = null;
    });

    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }

    this._removeListeners();

    this.toggletipClose.emit();
  }

  private _createOverlay() {
    const overlay = this._overlayService.create();

    return overlay;
  }
}
