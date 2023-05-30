import { AriaDescriber } from '@angular/cdk/a11y';
import { Directive, ElementRef, InjectionToken, Input, OnDestroy, TemplateRef, inject } from '@angular/core';
import { AnimatedOverlayDirective, FocusVisibleService } from '@ethlete/core';
import { Subscription, debounceTime, filter, fromEvent, tap } from 'rxjs';
import { TooltipComponent } from '../../components';
import { TOOLTIP_CONFIG, TOOLTIP_TEMPLATE, TOOLTIP_TEXT } from '../../constants';
import { TooltipConfig } from '../../types';
import { createTooltipConfig } from '../../utils';

type TooltipTemplate = string | TemplateRef<unknown>;

export const TOOLTIP_DIRECTIVE = new InjectionToken<TooltipDirective>('TOOLTIP_DIRECTIVE');

@Directive({
  selector: '[etTooltip]',
  standalone: true,
  providers: [
    {
      provide: TOOLTIP_DIRECTIVE,
      useExisting: TooltipDirective,
    },
  ],
  hostDirectives: [{ directive: AnimatedOverlayDirective, inputs: ['placement'] }],
})
export class TooltipDirective implements OnDestroy {
  private readonly _defaultConfig = inject<TooltipConfig>(TOOLTIP_CONFIG, { optional: true }) ?? createTooltipConfig();
  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<TooltipComponent>>(AnimatedOverlayDirective);

  @Input('etTooltip')
  get tooltip() {
    return this._tooltip;
  }
  set tooltip(v: TooltipTemplate | null) {
    this._tooltip = v;

    this._updateAriaDescription();

    if (v) {
      this._addListeners();
    } else {
      this._removeListeners();
    }
  }
  private _tooltip: TooltipTemplate | null = null;

  @Input()
  get tooltipAriaDescription() {
    return this._tooltipAriaDescription;
  }
  set tooltipAriaDescription(v: string | null) {
    this._tooltipAriaDescription = v;
    this._updateAriaDescription();
  }
  private _tooltipAriaDescription: string | null = null;
  private _lastTooltipText: string | null = null;

  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _ariaDescriberService = inject(AriaDescriber);
  private _focusVisibleService = inject(FocusVisibleService);

  private _willMount = true;
  private _hasFocus = false;
  private _hasHover = false;

  private readonly _listenerSubscriptions: Subscription[] = [];

  constructor() {
    this._animatedOverlay.placement = this._defaultConfig.placement;
    this._animatedOverlay.offset = this._defaultConfig.offset;
    this._animatedOverlay.arrowPadding = this._defaultConfig.arrowPadding;
  }

  ngOnDestroy(): void {
    this._animatedOverlay._destroy();
    this._removeListeners();
  }

  private _updateAriaDescription() {
    const tooltipText = this._getTooltipText();

    if (tooltipText) {
      this._ariaDescriberService.describe(this._elementRef.nativeElement, tooltipText);
    } else if (this._lastTooltipText) {
      this._ariaDescriberService.removeDescription(this._elementRef.nativeElement, this._lastTooltipText);
    }

    this._lastTooltipText = tooltipText;
  }

  private _addListeners() {
    const mouseEnterSub = fromEvent(this._elementRef.nativeElement, 'mouseenter')
      .pipe(
        tap(() => {
          this._willMount = true;
          this._hasHover = true;
        }),
        debounceTime(200),
      )
      .subscribe(() => {
        if (!this._willMount || this._animatedOverlay.isMounted) {
          return;
        }

        this._mountTooltip();
      });

    const focusSub = fromEvent(this._elementRef.nativeElement, 'focus').subscribe(() => {
      if (!this._focusVisibleService.isFocusVisible) {
        return;
      }

      this._hasFocus = true;

      if (this._animatedOverlay.isMounted) {
        return;
      }

      this._mountTooltip();
    });

    const mouseLeaveSub = fromEvent(this._elementRef.nativeElement, 'mouseleave').subscribe(() => {
      this._hasHover = false;
      this._willMount = false;

      if (this._animatedOverlay.isMounted && !this._hasFocus) {
        this._animatedOverlay.unmount();
      }
    });

    const blurSub = fromEvent(this._elementRef.nativeElement, 'blur').subscribe(() => {
      this._hasFocus = false;
      this._willMount = false;

      if (this._animatedOverlay.isMounted && !this._hasHover) {
        this._animatedOverlay.unmount();
      }
    });

    const keyupEscSub = fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(
        filter((e) => e.key === 'Escape'),
        filter(() => this._animatedOverlay.isMounted),
        tap(() => this._animatedOverlay.unmount()),
      )
      .subscribe();

    this._listenerSubscriptions.push(mouseEnterSub, mouseLeaveSub, focusSub, blurSub, keyupEscSub);
  }

  private _removeListeners() {
    this._listenerSubscriptions.forEach((s) => s.unsubscribe());
    this._listenerSubscriptions.length = 0;
  }

  private _mountTooltip() {
    this._animatedOverlay.mount({
      component: TooltipComponent,
      providers: [
        {
          provide: TOOLTIP_CONFIG,
          useValue: this._defaultConfig,
        },
        ...[
          typeof this.tooltip === 'string'
            ? {
                provide: TOOLTIP_TEXT,
                useValue: this.tooltip,
              }
            : {
                provide: TOOLTIP_TEMPLATE,
                useValue: this.tooltip,
              },
        ],
      ],
    });
  }

  private _getTooltipText() {
    return this._tooltipAriaDescription
      ? this._tooltipAriaDescription
      : typeof this.tooltip === 'string'
      ? this.tooltip
      : null;
  }
}
