import { FocusOrigin } from '@angular/cdk/a11y';
import { InjectionToken } from '@angular/core';
import { MenuStackItem } from './menu-stack';

export const CDK_MENU = new InjectionToken<Menu>('cdk-menu');

export interface Menu extends MenuStackItem {
  id: string;

  nativeElement: HTMLElement;

  readonly orientation: 'horizontal' | 'vertical';

  focusFirstItem(focusOrigin: FocusOrigin): void;

  focusLastItem(focusOrigin: FocusOrigin): void;

  focusItem(item: unknown, focusOrigin?: FocusOrigin): void;
}
