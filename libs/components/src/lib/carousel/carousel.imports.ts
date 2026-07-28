import { CarouselComponent } from './carousel.component';
import {
  CarouselAutoplayDirective,
  CarouselDirective,
  CarouselItemDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
  CarouselPreviousDirective,
  CarouselSlideDirective,
} from './headless';

/** The carousel, its slide template, and the headless directives to build your own out of a scrollable. */
export const CAROUSEL_IMPORTS = [
  CarouselComponent,
  CarouselSlideDirective,
  CarouselItemDirective,
  CarouselDirective,
  CarouselAutoplayDirective,
  CarouselPreviousDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
] as const;
