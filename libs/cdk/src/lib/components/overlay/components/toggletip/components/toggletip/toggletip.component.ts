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
import { TOGGLETIP_CONFIG, TOGGLETIP_TEMPLATE, TOGGLETIP_TEXT } from '../../constants';
import { TOGGLETIP_DIRECTIVE } from '../../directives/toggletip';

export const TOGGLETIP = new InjectionToken<ToggletipComponent>('Toggletip');

// TODO(TRB): The focus should get trapped inside the toggletip.
// The toggletip trigger should get a aria-haspopup="true" and aria-expanded="true" attribute.
@Component({
  selector: 'et-toggletip',
  templateUrl: './toggletip.component.html',
  styleUrls: ['./toggletip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, AnimatedLifecycleDirective],
  hostDirectives: [ProvideThemeDirective],
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
  readonly animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);

  private readonly _config = inject(TOGGLETIP_CONFIG);
  protected readonly toggletipText = inject(TOGGLETIP_TEXT, { optional: true });
  protected readonly toggletipTemplate = inject(TOGGLETIP_TEMPLATE, { optional: true });
  private readonly themeProvider = inject(THEME_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(TOGGLETIP_DIRECTIVE);
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
    this.themeProvider.syncWithProvider(provider);
  }
}
