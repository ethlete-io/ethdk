import { InjectionToken } from '@angular/core';
import { CarouselAutoplayDirective } from './carousel-autoplay.directive';
import { CarouselDirective } from './carousel.directive';

export const CAROUSEL_TOKEN = new InjectionToken<CarouselDirective>('CAROUSEL_TOKEN');

export const CAROUSEL_AUTOPLAY_TOKEN = new InjectionToken<CarouselAutoplayDirective>('CAROUSEL_AUTOPLAY_TOKEN');
