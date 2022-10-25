import { InjectionToken } from '@angular/core';
import { ContentfulConfig } from '../utils';

export const CONTENTFUL_CONFIG = new InjectionToken<ContentfulConfig>('TooltipConfig');
