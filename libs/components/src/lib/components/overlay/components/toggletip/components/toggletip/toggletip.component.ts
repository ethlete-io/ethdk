import { NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostBinding,
  inject,
  InjectionToken,
  Injector,
  ViewEncapsulation,
} from '@angular/core';
import {
  TOGGLETIP_ANIMATION_CLASSES,
  TOGGLETIP_CONFIG,
  TOGGLETIP_TEMPLATE,
  TOGGLETIP_TEXT,
  TOGGLETIP_TRANSITION_DURATION_PROPERTY,
} from '../../constants';
import { TOGGLETIP_DIRECTIVE } from '../../directives';

export interface LegacyToggletipAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
  totalTime: number;
}

export const TOGGLETIP = new InjectionToken<ToggletipComponent>('Toggletip');

// TODO(TRB): The focus should get trapped inside the toggletip.
// The toggletip trigger should get a aria-haspopup="true" and aria-expanded="true" attribute.
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
  providers: [
    {
      provide: TOGGLETIP,
      useExisting: ToggletipComponent,
    },
  ],
})
export class ToggletipComponent {
  protected readonly toggletipText = inject(TOGGLETIP_TEXT, { optional: true });
  protected readonly toggletipTemplate = inject(TOGGLETIP_TEMPLATE, { optional: true });
  protected readonly injector = inject(Injector);
  readonly _host = inject(TOGGLETIP_DIRECTIVE);

  private _config = inject(TOGGLETIP_CONFIG);

  _animationStateChanged = new EventEmitter<LegacyToggletipAnimationEvent>();

  @HostBinding('attr.aria-hidden')
  get attrAriaHidden() {
    return true;
  }

  @HostBinding('class.et-with-default-animation')
  get usesDefaultAnimation() {
    return !this._config.customAnimated;
  }

  @HostBinding('class')
  get containerClass() {
    return this._config.containerClass;
  }

  private _cdr = inject(ChangeDetectorRef);
  private _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private _animationTimer: number | null = null;

  _markForCheck() {
    this._cdr.markForCheck();
  }

  _show() {
    this.toggletipTemplate?.createEmbeddedView;

    setTimeout(() => {
      const { nativeElement } = this._elementRef;

      this._animationStateChanged.emit({ state: 'opening', totalTime: this._config.enterAnimationDuration });

      nativeElement.style.setProperty(
        TOGGLETIP_TRANSITION_DURATION_PROPERTY,
        `${this._config.enterAnimationDuration}ms`,
      );
      nativeElement.classList.add(TOGGLETIP_ANIMATION_CLASSES.opening);

      this._waitForAnimationToComplete(this._config.enterAnimationDuration, () => {
        this._clearAnimationClasses();
        nativeElement.classList.add(TOGGLETIP_ANIMATION_CLASSES.open);
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
