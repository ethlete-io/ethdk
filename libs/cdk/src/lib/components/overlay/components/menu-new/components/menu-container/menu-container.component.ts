import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  ElementRef,
  InjectionToken,
  Injector,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { ANIMATED_LIFECYCLE_TOKEN, AnimatedLifecycleDirective } from '@ethlete/core';
import { ProvideThemeDirective, THEME_PROVIDER } from '@ethlete/theming';
import { MENU_TRIGGER_TOKEN } from '../../directives';
import { MenuComponent } from '../menu/menu.component';

export const MENU_CONTAINER = new InjectionToken<MenuContainerComponent>('ET_MENU_CONTAINER');
export const MENU_TEMPLATE = new InjectionToken<TemplateRef<unknown>>('MENU_TEMPLATE');

@Component({
  selector: 'et-menu-container',
  templateUrl: './menu-container.component.html',
  styleUrl: './menu-container.component.scss',
  standalone: true,
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
  @ViewChild(ANIMATED_LIFECYCLE_TOKEN, { static: true })
  readonly _animatedLifecycle?: AnimatedLifecycleDirective;

  private readonly _themeProvider = inject(THEME_PROVIDER);
  protected readonly injector = inject(Injector);
  private readonly _cdr = inject(ChangeDetectorRef);
  readonly _trigger = inject(MENU_TRIGGER_TOKEN);
  readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly _menuTemplate = inject(MENU_TEMPLATE);

  @ContentChild(MenuComponent)
  private set __menu(value: MenuComponent | undefined) {
    this._menu.set(value ?? null);

    console.log(value);
  }
  private readonly _menu = signal<MenuComponent | null>(null);

  _markForCheck() {
    this._cdr.markForCheck();
  }

  _setThemeFromProvider(provider: ProvideThemeDirective) {
    this._themeProvider.syncWithProvider(provider);
  }
}
