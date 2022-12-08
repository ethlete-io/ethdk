import { InjectionToken } from '@angular/core';

import { ContentfulConfig } from '../types';

export const CONTENTFUL_CONFIG = new InjectionToken<ContentfulConfig>('ContentfulConfig');
