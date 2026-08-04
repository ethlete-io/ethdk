import { Directive, InjectionToken, OnDestroy, inject } from '@angular/core';
import { MENU_GROUP_TOKEN } from './menu-group.directive';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const MENU_GROUP_TITLE_TOKEN = new InjectionToken<MenuGroupTitleDirective>('MENU_GROUP_TITLE_TOKEN');

let uniqueId = 0;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Directive({
  selector: 'et-menu-group-title, [et-menu-group-title], [etMenuGroupTitle]',
  providers: [
    {
      provide: MENU_GROUP_TITLE_TOKEN,
      useExisting: MenuGroupTitleDirective,
    },
  ],
  host: {
    class: 'et-menu-group-title et-legacy',
    role: 'presentation',
    '[id]': 'id',
  },
})
export class MenuGroupTitleDirective implements OnDestroy {
  private readonly _menuGroup = inject(MENU_GROUP_TOKEN);

  readonly id = `et-menu-group-title-${uniqueId++}`;

  constructor() {
    this._menuGroup._connectWithTitle(this);
  }

  ngOnDestroy(): void {
    this._menuGroup._clearTitleConnection();
  }
}
