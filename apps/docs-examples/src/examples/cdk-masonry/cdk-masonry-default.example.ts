import { Component, ViewEncapsulation } from '@angular/core';
import { MasonryImports } from '@ethlete/cdk';

const HEIGHTS = [120, 200, 160, 260, 100, 220, 180, 140];

@Component({
  selector: 'app-cdk-masonry-default-example',
  template: `
    <et-masonry [gap]="16" [columWidth]="200">
      @for (card of CARDS; track card.id) {
        <et-masonry-item [key]="card.id">
          <div [style.block-size.px]="card.height" class="example-masonry-card">#{{ card.id + 1 }}</div>
        </et-masonry-item>
      }
    </et-masonry>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MasonryImports],
  styles: `
    .example-masonry-card {
      padding: 12px;
      border-radius: 8px;
      background: var(--et-theme-color-primary-solid);
    }
  `,
})
export class CdkMasonryDefaultExampleComponent {
  protected readonly CARDS = Array.from({ length: 24 }, (_, id) => ({ id, height: HEIGHTS[id % HEIGHTS.length] }));
}
