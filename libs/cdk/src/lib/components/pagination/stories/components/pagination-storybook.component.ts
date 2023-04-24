import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PaginationComponent } from '../../components';

@Component({
  selector: 'et-sb-pagination',
  template: `
    <et-pagination
      [pageControl]="pageControl"
      [totalPages]="totalPages"
      [headTitleTemplate]="headTitleTemplate"
      [headFirstPageTitle]="headFirstPageTitle"
      [headAddCanonicalTag]="headAddCanonicalTag"
    ></et-pagination>
  `,
  styles: [
    `
      .et-pagination .et-pagination-list {
        display: flex;
        justify-content: center;
        gap: 8px;
        list-style: none;

        .et-pagination-previous a,
        .et-pagination-next a,
        .et-pagination-first a,
        .et-pagination-last a {
          position: relative;
          width: 10px;
          display: inline-block;
          height: 100%;

          &::before {
            position: absolute;
            inset: 0;
          }
        }

        .et-pagination-previous a::before {
          content: '<';
        }

        .et-pagination-next a::before {
          content: '>';
        }

        .et-pagination-first {
          margin-right: 8px;

          a::before {
            content: '<<';
          }
        }

        .et-pagination-last a::before {
          content: '>>';
        }

        .et-pagination-current a {
          font-weight: bold;
          text-decoration: none;
          cursor: default;
        }
      }
    `,
  ],
  standalone: true,
  imports: [PaginationComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationStorybookComponent {
  pageControl = new FormControl<number | null>(1);
  pageChangeScrollAnchor: HTMLElement | null = null;

  @Input()
  totalPages = 2;

  @Input()
  headTitleTemplate = null;

  @Input()
  headFirstPageTitle = null;

  @Input()
  headAddCanonicalTag = false;

  @Input()
  ariaLabel = 'Pagination';
}
