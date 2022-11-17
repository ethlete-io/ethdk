import { NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  inject,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import { TOOLTIP_ANIMATION_CLASSES, TOOLTIP_TRANSITION_DURATION_PROPERTY } from '../../constants';
import { TooltipConfig } from '../../utils';

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
  tooltipText: string | null = null;
  tooltipTemplate: TemplateRef<unknown> | null = null;

  _config!: TooltipConfig;

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
    setTimeout(() => {
      const { nativeElement } = this._elementRef;

      this._animationStateChanged.emit({ state: 'opening', totalTime: this._config.enterAnimationDuration });

      nativeElement.style.setProperty(TOOLTIP_TRANSITION_DURATION_PROPERTY, `${this._config.enterAnimationDuration}ms`);
      nativeElement.classList.add(TOOLTIP_ANIMATION_CLASSES.opening);

      this._waitForAnimationToComplete(this._config.enterAnimationDuration, () => {
        nativeElement.classList.add(TOOLTIP_ANIMATION_CLASSES.open);
        this._clearAnimationClasses();
        this._animationStateChanged.next({ state: 'opened', totalTime: this._config.enterAnimationDuration });
      });
    });
  }

  _hide() {
    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
      this._clearAnimationClasses();
    }

    const { nativeElement } = this._elementRef;

    this._animationStateChanged.emit({ state: 'closing', totalTime: this._config.exitAnimationDuration });

    nativeElement.classList.remove(TOOLTIP_ANIMATION_CLASSES.open);
    nativeElement.style.setProperty(TOOLTIP_TRANSITION_DURATION_PROPERTY, `${this._config.exitAnimationDuration}ms`);
    nativeElement.classList.add(TOOLTIP_ANIMATION_CLASSES.closing);

    this._waitForAnimationToComplete(this._config.exitAnimationDuration, () => {
      this._clearAnimationClasses();
      this._animationStateChanged.next({ state: 'closed', totalTime: this._config.exitAnimationDuration });
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
