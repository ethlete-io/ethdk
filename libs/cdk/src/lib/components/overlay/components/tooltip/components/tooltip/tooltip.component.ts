import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, InjectionToken, Injector, ViewEncapsulation, inject, viewChild } from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
} from '@ethlete/core';
import { TOOLTIP_CONFIG, TOOLTIP_TEMPLATE, TOOLTIP_TEXT } from '../../constants';
import { TOOLTIP_DIRECTIVE } from '../../directives/tooltip';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOOLTIP = new InjectionToken<TooltipComponent>('Tooltip');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-tooltip',
  templateUrl: './tooltip.component.html',
  styleUrls: ['./tooltip.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, AnimatedLifecycleDirective],
  hostDirectives: [ProvideColorDirective],
  host: {
    class: 'et-tooltip et-legacy',
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
  private readonly colorProvider = inject(COLOR_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(TOOLTIP_DIRECTIVE);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  setColorFromProvider(provider: ProvideColorDirective) {
    this.colorProvider.syncWithProvider(provider);
  }
}
