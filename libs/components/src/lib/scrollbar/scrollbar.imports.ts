import { ScrollbarThumbDirective } from './headless/scrollbar-thumb.directive';
import { ScrollbarDirective } from './headless/scrollbar.directive';
import { ScrollbarComponent } from './scrollbar.component';

/**
 * The scrollbar element. `etScrollbar` and `etScrollbarThumb` come with it for a consumer that
 * builds its own track instead of using `<et-scrollbar>`.
 */
export const SCROLLBAR_IMPORTS = [ScrollbarComponent, ScrollbarDirective, ScrollbarThumbDirective] as const;
