import { Component, ViewEncapsulation } from '@angular/core';
import { RichFilterImports } from '@ethlete/cdk';

@Component({
  selector: 'app-cdk-rich-filter-example',
  template: `
    <div #richFilterHost et-rich-filter-host>
      @for (item of intro; track item) {
        <p>
          {{ item }} Content above the filters. Scroll down to see the filter button float once the inline filters leave
          the viewport.
        </p>
      }

      <et-rich-filter-button-slot class="example-filter-slot" etRichFilterTop>
        <button (click)="richFilterHost.scrollToTop()" class="example-filter-button" etRichFilterButton type="button">
          Filter
        </button>
      </et-rich-filter-button-slot>

      <ul etRichFilterContent>
        @for (item of results; track item) {
          <li>Result {{ item }}</li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RichFilterImports],
  styles: `
    .example-filter-slot {
      display: block;
      block-size: 50px;
    }

    .example-filter-button {
      block-size: 50px;
    }
  `,
})
export class CdkRichFilterExampleComponent {
  public intro = Array.from({ length: 5 }, (_, i) => i + 1);
  public results = Array.from({ length: 100 }, (_, i) => i + 1);
}
