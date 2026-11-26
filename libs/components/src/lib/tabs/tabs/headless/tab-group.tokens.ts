import { InjectionToken } from '@angular/core';
import { TabGroupDirective } from './tab-group.directive';
import { TabPanelDirective } from './tab-panel.directive';

export const TAB_GROUP_TOKEN = new InjectionToken<TabGroupDirective>('TAB_GROUP_TOKEN');

export const TAB_PANEL_TOKEN = new InjectionToken<TabPanelDirective>('TAB_PANEL_TOKEN');
