import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
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
    'aria-hidden': 'true',
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
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

  protected readonly _config = inject(TOOLTIP_CONFIG);
  protected tooltipText = inject(TOOLTIP_TEXT, { optional: true });
  protected tooltipTemplate = inject(TOOLTIP_TEMPLATE, { optional: true });
  private readonly _themeProvider = inject(THEME_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(TOOLTIP_DIRECTIVE);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  setThemeFromProvider(provider: ProvideThemeDirective) {
    this._themeProvider.syncWithProvider(provider);
  }
}
