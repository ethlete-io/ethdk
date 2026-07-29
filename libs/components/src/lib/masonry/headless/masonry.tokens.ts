import { InjectionToken } from '@angular/core';
import { MasonryDirective } from './masonry.directive';

export const MASONRY_TOKEN = new InjectionToken<MasonryDirective>('MASONRY_TOKEN');
