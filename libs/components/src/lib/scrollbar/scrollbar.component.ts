import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ScrollbarThumbDirective } from './headless/scrollbar-thumb.directive';
import { ScrollbarDirective } from './headless/scrollbar.directive';

/**
 * A scrollbar for a container whose native one is in the way - a panel with its own chrome, a track
 * that has to look the same on every platform, a surface a light-grey system bar clashes with.
 *
 * The container keeps the scrolling. This only mirrors it, so wheel, touch, keyboard and programmatic
 * scrolling behave exactly as they did. Point it at the container with `for` and it hides that
 * container's native scrollbar for you.
 *
 * It positions itself over the end edge of its containing block, so give the element that wraps the
 * scroll container `position: relative`. One element covers one axis - add a second with
 * `orientation="horizontal"` for a container that scrolls both ways.
 *
 * @example
 * <div class="relative">
 *   <div #list class="list">…</div>
 *   <et-scrollbar [for]="list" autoHide />
 * </div>
 */
@Component({
  selector: 'et-scrollbar',
  template: `<div etScrollbarThumb></div>`,
  styleUrl: './scrollbar.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollbarThumbDirective],
  hostDirectives: [
    {
      directive: ScrollbarDirective,
      inputs: ['for', 'orientation', 'autoHide', 'minThumbSize', 'disabled'],
    },
  ],
  host: {
    class: 'et-scrollbar',
  },
})
export class ScrollbarComponent {
  public scrollbarDir = inject(ScrollbarDirective);
}
