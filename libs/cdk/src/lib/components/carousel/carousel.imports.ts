import { CarouselComponent } from './carousel.component';
import {
  CarouselItemNavComponent,
  CarouselNextButtonDirective,
  CarouselPreviousButtonDirective,
  CarouselToggleAutoPlayButtonDirective,
} from './controls';
import { CarouselItemComponent } from './et-carousel-item.component';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const CarouselImports = [
  CarouselComponent,
  CarouselItemComponent,
  CarouselItemNavComponent,
  CarouselNextButtonDirective,
  CarouselPreviousButtonDirective,
  CarouselToggleAutoPlayButtonDirective,
] as const;
