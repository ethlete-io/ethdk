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
import { TOGGLETIP_ANIMATION_CLASSES, TOGGLETIP_TRANSITION_DURATION_PROPERTY } from '../../constants';
import { ToggletipConfig } from '../../utils';

export interface LegacyToggletipAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
  totalTime: number;
}

@Component({
  selector: 'et-toggletip',
  templateUrl: './toggletip.component.html',
  styleUrls: ['./toggletip.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgIf, NgTemplateOutlet],
  host: {
    class: 'et-toggletip',
  },
})
export class ToggletipComponent {
  toggletipText: string | null = null;
  toggletipTemplate: TemplateRef<unknown> | null = null;

  _config!: ToggletipConfig;

  _animationStateChanged = new EventEmitter<LegacyToggletipAnimationEvent>();

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

    this._animationStateChanged.emit({ state: 'opening', totalTime: this._config.enterAnimationDuration });

    nativeElement.style.setProperty(TOGGLETIP_TRANSITION_DURATION_PROPERTY, `${this._config.enterAnimationDuration}ms`);
    nativeElement.classList.add(TOGGLETIP_ANIMATION_CLASSES.opening);
    nativeElement.classList.add(TOGGLETIP_ANIMATION_CLASSES.open);

    this._waitForAnimationToComplete(this._config.enterAnimationDuration, () => {
      this._clearAnimationClasses();
      this._animationStateChanged.next({ state: 'opened', totalTime: this._config.enterAnimationDuration });
    });
  }

  _hide() {
    const { nativeElement } = this._elementRef;

    this._animationStateChanged.emit({ state: 'closing', totalTime: this._config.exitAnimationDuration });

    nativeElement.classList.remove(TOGGLETIP_ANIMATION_CLASSES.open);
    nativeElement.style.setProperty(TOGGLETIP_TRANSITION_DURATION_PROPERTY, `${this._config.exitAnimationDuration}ms`);
    nativeElement.classList.add(TOGGLETIP_ANIMATION_CLASSES.closing);

    this._waitForAnimationToComplete(this._config.exitAnimationDuration, () => {
      this._clearAnimationClasses();
      this._animationStateChanged.next({ state: 'closed', totalTime: this._config.exitAnimationDuration });
    });
  }

  private _clearAnimationClasses() {
    const { nativeElement } = this._elementRef;

    nativeElement.classList.remove(TOGGLETIP_ANIMATION_CLASSES.opening);
    nativeElement.classList.remove(TOGGLETIP_ANIMATION_CLASSES.closing);
  }

  private _waitForAnimationToComplete(duration: number, callback: () => void) {
    if (this._animationTimer !== null) {
      clearTimeout(this._animationTimer);
    }

    this._animationTimer = window.setTimeout(callback, duration);
  }
}
