import { NgFor } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RichFilterImports } from '../../rich-filter.imports';

@Component({
  selector: 'et-sb-rich-filter',
  template: `
    <div #richFilterHost et-rich-filter-host>
      <!-- eslint-disable-next-line @angular-eslint/template/use-track-by-function -->
      @for (item of arrayOf5; track item) {
        <p>
          {{ item }} Lorem ipsum dolor, sit amet consectetur adipisicing elit. Error dicta excepturi perferendis,
          ratione expedita ea iste odit nihil necessitatibus debitis nobis nostrum, at quaerat eveniet velit, sit
          eligendi explicabo sint accusamus. Tempore tempora, soluta expedita optio quae praesentium dolorum suscipit
          earum nulla beatae repellat sit sequi, magnam nesciunt, voluptates nam.
        </p>
      }

      <et-rich-filter-button-slot etRichFilterTop>
        <button (click)="richFilterHost.scrollToTop()" etRichFilterButton>Filter</button>
      </et-rich-filter-button-slot>

      <ul etRichFilterContent>
        <!-- eslint-disable-next-line @angular-eslint/template/use-track-by-function -->
        @for (item of arrayOf100; track item) {
          <li>{{ item }}</li>
        }
      </ul>

      <!-- eslint-disable-next-line @angular-eslint/template/use-track-by-function -->
      @for (item of arrayOf5; track item) {
        <p>
          {{ item }} Lorem ipsum dolor, sit amet consectetur adipisicing elit. Error dicta excepturi perferendis,
          ratione expedita ea iste odit nihil necessitatibus debitis nobis nostrum, at quaerat eveniet velit, sit
          eligendi explicabo sint accusamus. Tempore tempora, soluta expedita optio quae praesentium dolorum suscipit
          earum nulla beatae repellat sit sequi, magnam nesciunt, voluptates nam.
        </p>
      }
    </div>
  `,
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RichFilterImports, NgFor],
})
export class RichFilterStorybookComponent {
  arrayOf100 = Array.from({ length: 100 }, (_, i) => i);
  arrayOf5 = Array.from({ length: 5 }, (_, i) => i);
}
