import { InjectionToken } from '@angular/core';
import { TabBarTriggerDirective } from './tab-bar-trigger.directive';
import { TabBarDirective } from './tab-bar.directive';

export const TAB_BAR_TOKEN = new InjectionToken<TabBarDirective>('TAB_BAR_TOKEN');

export const TAB_BAR_TRIGGER_TOKEN = new InjectionToken<TabBarTriggerDirective>('TAB_BAR_TRIGGER_TOKEN');
