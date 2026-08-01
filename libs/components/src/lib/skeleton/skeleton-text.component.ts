import { Component, computed, input, numberAttribute, ViewEncapsulation } from '@angular/core';
import { SkeletonItemComponent } from './skeleton-item.component';

/**
 * A paragraph of placeholder lines - the shape almost every skeleton needs, so it isn't worth writing
 * out. The last line is short, which is what makes a block of bars read as text rather than a table.
 *
 * @example
 * <et-skeleton><et-skeleton-text lines="3" /></et-skeleton>
 */
@Component({
  selector: 'et-skeleton-text',
  template: `
    @for (line of lineList(); track line) {
      <et-skeleton-item [style.inline-size.%]="line" shape="text" />
    }
  `,
  styleUrl: './skeleton.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [SkeletonItemComponent],
  host: {
    class: 'et-skeleton-text',
  },
})
export class SkeletonTextComponent {
  /** How many lines to draw. @default 3 */
  public lines = input(3, { transform: numberAttribute });

  /** Width (%) of the last line - a full-width final line reads as a block, not a paragraph. @default 60 */
  public lastLineWidth = input(60, { transform: numberAttribute });

  protected lineList = computed(() => {
    const lines = Math.max(1, this.lines());

    return Array.from({ length: lines }, (_, index) => (index === lines - 1 ? this.lastLineWidth() : 100));
  });
}
