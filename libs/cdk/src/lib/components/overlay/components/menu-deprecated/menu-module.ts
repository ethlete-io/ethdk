import { OverlayModule } from '@angular/cdk/overlay';
import { NgModule } from '@angular/core';
import { CdkContextMenuTrigger } from './context-menu-trigger';
import { CdkMenu } from './menu';
import { CdkTargetMenuAim } from './menu-aim';
import { CdkMenuBar } from './menu-bar';
import { CdkMenuGroup } from './menu-group';
import { CdkMenuItem } from './menu-item';
import { CdkMenuItemCheckbox } from './menu-item-checkbox';
import { CdkMenuItemRadio } from './menu-item-radio';
import { CdkMenuTrigger } from './menu-trigger';

/**
 * @deprecated Use the new menu instead
 */
const MENU_DIRECTIVES = [
  CdkMenuBar,
  CdkMenu,
  CdkMenuItem,
  CdkMenuItemRadio,
  CdkMenuItemCheckbox,
  CdkMenuTrigger,
  CdkMenuGroup,
  CdkContextMenuTrigger,
  CdkTargetMenuAim,
];

/**
 * @deprecated Use the new menu instead
 */
@NgModule({
  imports: [OverlayModule, ...MENU_DIRECTIVES],
  exports: MENU_DIRECTIVES,
})
export class CdkMenuModule {}
