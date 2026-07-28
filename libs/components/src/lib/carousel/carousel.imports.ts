import { CarouselComponent } from './carousel.component';
import {
  CarouselAutoplayDirective,
  CarouselDirective,
  CarouselItemDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
  CarouselPreviousDirective,
} from './headless';

/** The carousel, its slides, and the headless directives to build your own out of a scrollable. */
export const CAROUSEL_IMPORTS = [
  CarouselComponent,
  CarouselItemDirective,
  CarouselDirective,
  CarouselAutoplayDirective,
  CarouselPreviousDirective,
  CarouselNextDirective,
  CarouselPlayToggleDirective,
] as const;
