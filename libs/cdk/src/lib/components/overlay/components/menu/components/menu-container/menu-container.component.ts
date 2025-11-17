import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  TemplateRef,
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
import { MENU_TRIGGER_TOKEN } from '../../directives/menu-trigger';

export const MENU_CONTAINER = new InjectionToken<MenuContainerComponent>('ET_MENU_CONTAINER');
export const MENU_TEMPLATE = new InjectionToken<TemplateRef<unknown>>('MENU_TEMPLATE');

@Component({
  selector: 'et-menu-container',
  templateUrl: './menu-container.component.html',
  styleUrl: './menu-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu-container',
  },
  imports: [AnimatedLifecycleDirective, NgTemplateOutlet],
  hostDirectives: [ProvideThemeDirective],
  providers: [
    {
      provide: MENU_CONTAINER,
      useExisting: MenuContainerComponent,
    },
  ],
})
export class MenuContainerComponent {
  readonly animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);

  private readonly themeProvider = inject(THEME_PROVIDER);
  protected readonly injector = inject(Injector);
  readonly _trigger = inject(MENU_TRIGGER_TOKEN);
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly _menuTemplate = inject(MENU_TEMPLATE);

  setThemeFromProvider(provider: ProvideThemeDirective) {
    this.themeProvider.syncWithProvider(provider);
  }
}
