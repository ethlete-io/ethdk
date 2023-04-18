import { InjectionToken } from '@angular/core';

export interface TabConfig {
  disablePagination?: boolean;
  fitInkBarToContent?: boolean;
  contentTabIndex?: number;
  preserveContent?: boolean;
}

export const TABS_CONFIG = new InjectionToken<TabConfig>('TABS_CONFIG');
