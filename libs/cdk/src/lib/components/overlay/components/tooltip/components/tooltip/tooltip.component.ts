import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  InjectionToken,
  Injector,
  ViewEncapsulation,
  inject,
  viewChild,
} from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  ProvideThemeDirective,
  THEME_PROVIDER,
} from '@ethlete/core';
import { TOOLTIP_CONFIG, TOOLTIP_TEMPLATE, TOOLTIP_TEXT } from '../../constants';
import { TOOLTIP_DIRECTIVE } from '../../directives/tooltip';

export const TOOLTIP = new InjectionToken<TooltipComponent>('Tooltip');

@Component({
  selector: 'et-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrls: ['./tooltip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, AnimatedLifecycleDirective],
  hostDirectives: [ProvideThemeDirective],
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
  readonly animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);

  private readonly _config = inject(TOOLTIP_CONFIG);
  protected tooltipText = inject(TOOLTIP_TEXT, { optional: true });
  protected tooltipTemplate = inject(TOOLTIP_TEMPLATE, { optional: true });
  private readonly _themeProvider = inject(THEME_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(TOOLTIP_DIRECTIVE);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

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

  setThemeFromProvider(provider: ProvideThemeDirective) {
    this._themeProvider.syncWithProvider(provider);
  }
}
