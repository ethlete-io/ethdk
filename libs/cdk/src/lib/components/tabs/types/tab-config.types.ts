import { InjectionToken } from '@angular/core';

export type TabConfig = {
  disablePagination?: boolean;
  fitInkBarToContent?: boolean;
  contentTabIndex?: number;
  preserveContent?: boolean;
};

export const TABS_CONFIG = new InjectionToken<TabConfig>('TABS_CONFIG');
