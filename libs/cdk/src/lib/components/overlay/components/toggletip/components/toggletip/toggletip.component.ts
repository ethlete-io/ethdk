import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, InjectionToken, Injector, ViewEncapsulation, inject, viewChild } from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
} from '@ethlete/core';
import { TOGGLETIP_CONFIG, TOGGLETIP_TEMPLATE, TOGGLETIP_TEXT } from '../../constants';
import { TOGGLETIP_DIRECTIVE } from '../../directives/toggletip';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const TOGGLETIP = new InjectionToken<ToggletipComponent>('Toggletip');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
// TODO(TRB): The focus should get trapped inside the toggletip.
// The toggletip trigger should get a aria-haspopup="true" and aria-expanded="true" attribute.
@Component({
  selector: 'et-toggletip',
  templateUrl: './toggletip.component.html',
  styleUrls: ['./toggletip.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, AnimatedLifecycleDirective],
  hostDirectives: [ProvideColorDirective],
  host: {
    class: 'et-toggletip et-legacy',
    'aria-hidden': 'true',
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
  },
  providers: [
    {
      provide: TOGGLETIP,
      useExisting: ToggletipComponent,
    },
  ],
})
export class ToggletipComponent {
  readonly animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);

  protected readonly _config = inject(TOGGLETIP_CONFIG);
  protected readonly toggletipText = inject(TOGGLETIP_TEXT, { optional: true });
  protected readonly toggletipTemplate = inject(TOGGLETIP_TEMPLATE, { optional: true });
  private readonly colorProvider = inject(COLOR_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(TOGGLETIP_DIRECTIVE);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  setColorFromProvider(provider: ProvideColorDirective) {
    this.colorProvider.syncWithProvider(provider);
  }
}
