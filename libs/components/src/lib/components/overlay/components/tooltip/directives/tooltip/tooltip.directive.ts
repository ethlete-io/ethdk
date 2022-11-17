import { AriaDescriber } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ComponentRef,
  Directive,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { FocusVisibleService } from '@ethlete/core';
import { createPopper, Instance as PopperInstance, Placement as PopperPlacement } from '@popperjs/core';
import { debounceTime, filter, fromEvent, Subscription, takeWhile, tap } from 'rxjs';
import { TooltipComponent } from '../../components';
import { TOOLTIP_CONFIG } from '../../constants';
import { TooltipConfig } from '../../utils';

type TooltipTemplate = string | TemplateRef<unknown>;

@Directive({
  selector: '[etTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  private _defaultConfig = inject<TooltipConfig>(TOOLTIP_CONFIG, { optional: true }) ?? new TooltipConfig();

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
  placement: PopperPlacement = this._defaultConfig.placement;

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

  private _hostElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _viewContainerRef = inject(ViewContainerRef);
  private _overlayService = inject(Overlay);
  private _ariaDescriberService = inject(AriaDescriber);
  private _focusVisibleService = inject(FocusVisibleService);

  private _overlayRef: OverlayRef | null = null;
  private _portal: ComponentPortal<TooltipComponent> | null = null;
  private _tooltipRef: ComponentRef<TooltipComponent> | null = null;
  private _popper: PopperInstance | null = null;

  private _willMount = true;
  private _hasFocus = false;
  private _hasHover = false;

  private get _isMounted() {
    return this._overlayRef !== null;
  }

  private readonly _listenerSubscriptions: Subscription[] = [];

  ngOnDestroy(): void {
    this._unmountTooltip();
    this._removeListeners();
  }

  private _updateAriaDescription() {
    const tooltipText = this._getTooltipText();

    if (tooltipText) {
      this._ariaDescriberService.describe(this._hostElementRef.nativeElement, tooltipText);
    } else if (this._lastTooltipText) {
      this._ariaDescriberService.removeDescription(this._hostElementRef.nativeElement, this._lastTooltipText);
    }

    this._lastTooltipText = tooltipText;
  }

  private _addListeners() {
    const mouseEnterSub = fromEvent(this._hostElementRef.nativeElement, 'mouseenter')
      .pipe(
        tap(() => {
          this._willMount = true;
          this._hasHover = true;
        }),
        debounceTime(200),
      )
      .subscribe(() => {
        if (!this._willMount || this._isMounted) {
          return;
        }

        this._mountTooltip();
      });

    const focusSub = fromEvent(this._hostElementRef.nativeElement, 'focus').subscribe(() => {
      if (!this._focusVisibleService.isFocusVisible) {
        return;
      }

      this._hasFocus = true;

      if (this._isMounted) {
        return;
      }

      this._mountTooltip();
    });

    const mouseLeaveSub = fromEvent(this._hostElementRef.nativeElement, 'mouseleave').subscribe(() => {
      this._hasHover = false;
      this._willMount = false;

      if (this._isMounted && !this._hasFocus) {
        this._animateUnmount();
      }
    });

    const blurSub = fromEvent(this._hostElementRef.nativeElement, 'blur').subscribe(() => {
      this._hasFocus = false;
      this._willMount = false;

      if (this._isMounted && !this._hasHover) {
        this._animateUnmount();
      }
    });

    const keyupEscSub = fromEvent<KeyboardEvent>(document, 'keyup')
      .pipe(
        filter((e) => e.key === 'Escape'),
        filter(() => this._isMounted),
        tap(() => this._animateUnmount()),
      )
      .subscribe();

    this._listenerSubscriptions.push(mouseEnterSub, mouseLeaveSub, focusSub, blurSub, keyupEscSub);
  }

  private _removeListeners() {
    this._listenerSubscriptions.forEach((s) => s.unsubscribe());
    this._listenerSubscriptions.length = 0;
  }

  private _mountTooltip() {
    this._overlayRef = this._createOverlay();
    this._portal = this._portal ?? new ComponentPortal(TooltipComponent, this._viewContainerRef);
    this._tooltipRef = this._overlayRef.attach(this._portal);

    // TODO(TRB): Options should get injected via DI (injection token)
    this._tooltipRef.instance._config = this._defaultConfig;

    if (typeof this.tooltip === 'string') {
      this._tooltipRef.instance.tooltipText = this.tooltip;
    } else {
      this._tooltipRef.instance.tooltipTemplate = this.tooltip;
    }

    this._tooltipRef.instance._markForCheck();

    this._popper = createPopper(this._hostElementRef.nativeElement, this._tooltipRef.location.nativeElement, {
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

    // We need to wait for the tooltip content to be rendered
    setTimeout(() => {
      if (!this._tooltipRef) {
        return;
      }

      this._popper?.update();
      this._tooltipRef.instance._show();
    });
  }

  private _animateUnmount() {
    if (!this._tooltipRef) {
      return;
    }

    this._tooltipRef.instance._hide();

    this._tooltipRef.instance._animationStateChanged
      .pipe(
        takeWhile((s) => s.state !== 'closed', true),
        filter((s) => s.state === 'closed'),
      )
      .subscribe(() => this._unmountTooltip());
  }

  private _unmountTooltip() {
    this._tooltipRef?.instance._hide();

    if (this._popper) {
      this._popper.destroy();
      this._popper = null;
    }

    if (this._overlayRef) {
      this._overlayRef.dispose();
      this._overlayRef = null;
    }
  }

  private _createOverlay() {
    const overlay = this._overlayService.create();

    return overlay;
  }

  private _getTooltipText() {
    return this._tooltipAriaDescription
      ? this._tooltipAriaDescription
      : typeof this.tooltip === 'string'
      ? this.tooltip
      : null;
  }
}
