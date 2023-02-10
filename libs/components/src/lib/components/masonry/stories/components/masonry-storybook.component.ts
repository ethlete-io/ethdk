import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RepeatDirective } from '@ethlete/core';
import { MasonryComponent } from '../../components';
import { MasonryItemDirective } from '../../directives';

@Component({
  selector: 'et-sb-masonry',
  template: `
    <et-masonry [gap]="gap" [columWidth]="columWidth">
      <div *etRepeat="20" etMasonryItem>Item</div>
    </et-masonry>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [MasonryComponent, MasonryItemDirective, RepeatDirective],
  styles: [
    `
      .et-masonry-item:nth-child(even) {
        background-color: #ff0;
        min-height: 250px;
      }

      .et-masonry-item:nth-child(odd) {
        background-color: #0ff;
        min-height: 350px;
      }

      .et-masonry-item:nth-child(1) {
        background-color: #f0f;
        min-height: 200px;
      }

      .et-masonry-item:nth-child(2) {
        background-color: #0f0;
        min-height: 400px;
      }

      .et-masonry-item:nth-child(3) {
        background-color: #00f;
        min-height: 300px;
      }
    `,
  ],
})
export class StorybookMasonryComponent {
  gap = 16;
  columWidth = 200;
}
