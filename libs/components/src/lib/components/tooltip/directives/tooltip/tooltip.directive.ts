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
import { createPopper, Instance as PopperInstance } from '@popperjs/core';
import { filter, fromEvent, Subscription, takeWhile } from 'rxjs';
import { TooltipComponent } from '../../components';

type TooltipTemplate = string | TemplateRef<unknown>;

@Directive({
  selector: '[etTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
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

  private _hostElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private _viewContainerRef = inject(ViewContainerRef);
  private _overlayService = inject(Overlay);
  private _ariaDescriberService = inject(AriaDescriber);

  private _overlayRef: OverlayRef | null = null;
  private _portal: ComponentPortal<TooltipComponent> | null = null;
  private _tooltipRef: ComponentRef<TooltipComponent> | null = null;
  private _popper: PopperInstance | null = null;

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
    const me = fromEvent(this._hostElementRef.nativeElement, 'mouseenter').subscribe(() => {
      this._mountTooltip();
    });

    const ml = fromEvent(this._hostElementRef.nativeElement, 'mouseleave').subscribe(() => {
      this._animateUnmount();
    });

    this._listenerSubscriptions.push(me, ml);
  }

  private _removeListeners() {
    this._listenerSubscriptions.forEach((s) => s.unsubscribe());
    this._listenerSubscriptions.length = 0;
  }

  private _mountTooltip() {
    this._overlayRef = this._createOverlay();
    this._portal = this._portal ?? new ComponentPortal(TooltipComponent, this._viewContainerRef);
    this._tooltipRef = this._overlayRef.attach(this._portal);

    if (typeof this.tooltip === 'string') {
      this._tooltipRef.instance.tooltipText = this.tooltip;
    } else {
      this._tooltipRef.instance.tooltipTemplate = this.tooltip;
    }

    this._tooltipRef.instance._markForCheck();

    // We need to wait for the tooltip content to be rendered before we can create the popper instance.
    setTimeout(() => {
      if (!this._tooltipRef) {
        return;
      }

      this._popper = createPopper(this._hostElementRef.nativeElement, this._tooltipRef.location.nativeElement);
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
