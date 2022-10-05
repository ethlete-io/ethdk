import { NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  inject,
  Input,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import { TOOLTIP_ANIMATION_CLASSES, TOOLTIP_TRANSITION_DURATION_PROPERTY } from '../../constants';

export interface LegacyTooltipAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
  totalTime: number;
}

@Component({
  selector: 'et-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrls: ['./tooltip.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgIf, NgTemplateOutlet],
  host: {
    class: 'et-tooltip',
  },
})
export class TooltipComponent {
  @Input()
  tooltipText: string | null = null;

  @Input()
  tooltipTemplate: TemplateRef<unknown> | null = null;

  _animationStateChanged = new EventEmitter<LegacyTooltipAnimationEvent>();

  @HostBinding('attr.aria-hidden')
  get attrAriaHidden() {
    return true;
  }

  private _cdr = inject(ChangeDetectorRef);
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private _animationTimer: number | null = null;

  _markForCheck() {
    this._cdr.markForCheck();
  }

  _show() {
    const { nativeElement } = this._elementRef;

    this._animationStateChanged.emit({ state: 'opening', totalTime: 300 });

    nativeElement.style.setProperty(TOOLTIP_TRANSITION_DURATION_PROPERTY, `300ms`);
    nativeElement.classList.add(TOOLTIP_ANIMATION_CLASSES.opening);
    nativeElement.classList.add(TOOLTIP_ANIMATION_CLASSES.open);

    this._waitForAnimationToComplete(300, () => {
      this._clearAnimationClasses();
      this._animationStateChanged.next({ state: 'opened', totalTime: 300 });
    });
  }

  _hide() {
    const { nativeElement } = this._elementRef;

    this._animationStateChanged.emit({ state: 'closing', totalTime: 100 });

    nativeElement.classList.remove(TOOLTIP_ANIMATION_CLASSES.open);
    nativeElement.style.setProperty(TOOLTIP_TRANSITION_DURATION_PROPERTY, `100ms`);
    nativeElement.classList.add(TOOLTIP_ANIMATION_CLASSES.closing);

    this._waitForAnimationToComplete(100, () => {
      this._clearAnimationClasses();
      this._animationStateChanged.next({ state: 'closed', totalTime: 100 });
    });
  }

  private _clearAnimationClasses() {
    const { nativeElement } = this._elementRef;

    nativeElement.classList.remove(TOOLTIP_ANIMATION_CLASSES.opening);
    nativeElement.classList.remove(TOOLTIP_ANIMATION_CLASSES.closing);
  }

  private _waitForAnimationToComplete(duration: number, callback: () => void) {
    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
    }

    this._animationTimer = window.setTimeout(callback, duration);
  }
}
