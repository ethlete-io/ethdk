import { Directive, InjectionToken, computed, signal } from '@angular/core';
import { signalHostAttributes } from '@ethlete/core';
import { MenuGroupTitleDirective } from '../menu-group-title';

export const MENU_GROUP_TOKEN = new InjectionToken<MenuGroupDirective>('MENU_GROUP_TOKEN');

@Directive({
  selector: 'et-menu-group, [et-menu-group], [etMenuGroup]',
  standalone: true,
  providers: [
    {
      provide: MENU_GROUP_TOKEN,
      useExisting: MenuGroupDirective,
    },
  ],
  host: {
    role: 'group',
    class: 'et-menu-group',
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
