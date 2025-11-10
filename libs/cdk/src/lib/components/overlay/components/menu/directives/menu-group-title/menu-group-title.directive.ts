import { Directive, InjectionToken, OnDestroy, inject } from '@angular/core';
import { MENU_GROUP_TOKEN } from '../menu-group';

export const MENU_GROUP_TITLE_TOKEN = new InjectionToken<MenuGroupTitleDirective>('MENU_GROUP_TITLE_TOKEN');

let uniqueId = 0;

@Directive({
  selector: 'et-menu-group-title, [et-menu-group-title], [etMenuGroupTitle]',

  providers: [
    {
      provide: MENU_GROUP_TITLE_TOKEN,
      useExisting: MenuGroupTitleDirective,
    },
  ],
  host: {
    class: 'et-menu-group-title',
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
