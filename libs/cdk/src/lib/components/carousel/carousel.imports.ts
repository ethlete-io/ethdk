import { CarouselComponent } from './carousel.component';
import {
  CarouselItemNavComponent,
  CarouselNextButtonDirective,
  CarouselPreviousButtonDirective,
  CarouselToggleAutoPlayButtonDirective,
} from './controls';
import { CarouselItemComponent } from './et-carousel-item.component';

export const CarouselImports = [
  CarouselComponent,
  CarouselItemComponent,
  CarouselItemNavComponent,
  CarouselNextButtonDirective,
  CarouselPreviousButtonDirective,
  CarouselToggleAutoPlayButtonDirective,
] as const;
