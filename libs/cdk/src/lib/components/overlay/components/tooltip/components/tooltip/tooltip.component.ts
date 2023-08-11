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
import { TOOLTIP_CONFIG, TOOLTIP_TEMPLATE, TOOLTIP_TEXT } from '../../constants';
import { TOOLTIP_DIRECTIVE } from '../../directives';

export const TOOLTIP = new InjectionToken<TooltipComponent>('Tooltip');

@Component({
  selector: 'et-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrls: ['./tooltip.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgIf, NgTemplateOutlet, AnimatedLifecycleDirective],
  host: {
    class: 'et-tooltip',
  },
  providers: [
    {
      provide: TOOLTIP,
      useExisting: TooltipComponent,
    },
  ],
})
export class TooltipComponent {
  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;

  private readonly _config = inject(TOOLTIP_CONFIG);
  protected tooltipText = inject(TOOLTIP_TEXT, { optional: true });
  protected tooltipTemplate = inject(TOOLTIP_TEMPLATE, { optional: true });
  protected readonly injector = inject(Injector);
  private readonly _cdr = inject(ChangeDetectorRef);
  readonly _trigger = inject(TOOLTIP_DIRECTIVE);
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
