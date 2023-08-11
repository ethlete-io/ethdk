import { NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  InjectionToken,
  Injector,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';
import { TOGGLETIP_CONFIG, TOGGLETIP_TEMPLATE, TOGGLETIP_TEXT } from '../../constants';
import { TOGGLETIP_DIRECTIVE } from '../../directives';

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
  imports: [NgIf, NgTemplateOutlet, AnimatedLifecycleDirective],
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
  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;

  private readonly _config = inject(TOGGLETIP_CONFIG);
  protected readonly toggletipText = inject(TOGGLETIP_TEXT, { optional: true });
  protected readonly toggletipTemplate = inject(TOGGLETIP_TEMPLATE, { optional: true });
  protected readonly injector = inject(Injector);
  private readonly _cdr = inject(ChangeDetectorRef);
  readonly _trigger = inject(TOGGLETIP_DIRECTIVE);
  readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

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

  _markForCheck() {
    this._cdr.markForCheck();
  }
}
