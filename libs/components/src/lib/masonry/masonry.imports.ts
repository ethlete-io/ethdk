import { MasonryItemDirective } from './headless/masonry-item.directive';
import { MasonryDirective } from './headless/masonry.directive';

export const MASONRY_IMPORTS = [MasonryDirective, MasonryItemDirective] as const;
