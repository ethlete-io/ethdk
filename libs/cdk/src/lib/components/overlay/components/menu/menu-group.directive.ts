import { Directive, InjectionToken, computed, signal } from '@angular/core';
import { signalHostAttributes } from '@ethlete/core';
import { MenuGroupTitleDirective } from './menu-group-title.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const MENU_GROUP_TOKEN = new InjectionToken<MenuGroupDirective>('MENU_GROUP_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'et-menu-group, [et-menu-group], [etMenuGroup]',

  providers: [
    {
      provide: MENU_GROUP_TOKEN,
      useExisting: MenuGroupDirective,
    },
  ],
  host: {
    role: 'group',
    class: 'et-menu-group et-legacy',
  },
})
export class MenuGroupDirective {
  private readonly _currentTitle = signal<MenuGroupTitleDirective | null>(null);

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-labelledby': computed(() => this._currentTitle()?.id),
  });

  _connectWithTitle(title: MenuGroupTitleDirective) {
    this._currentTitle.set(title);
  }

  _clearTitleConnection() {
    this._currentTitle.set(null);
  }
}
