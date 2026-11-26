import { RatingDirective, RatingIconDirective } from './headless';
import { RatingComponent } from './rating.component';

export const RATING_IMPORTS = [RatingComponent, RatingDirective, RatingIconDirective] as const;
