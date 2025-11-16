import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { PaginationComponent } from '../../components/pagination';

@Component({
  selector: 'et-sb-pagination',
  template: `
    <et-pagination
      [pageControl]="pageControl"
      [totalPages]="totalPages()"
      [headTitleTemplate]="headTitleTemplate()"
      [headFirstPageTitle]="headFirstPageTitle()"
      [headAddCanonicalTag]="headAddCanonicalTag()"
    />
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
  imports: [PaginationComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationStorybookComponent {
  pageControl = new FormControl<number | null>(1);
  pageChangeScrollAnchor: HTMLElement | null = null;

  readonly totalPages = input(2);

  readonly headTitleTemplate = input(null);

  readonly headFirstPageTitle = input(null);

  readonly headAddCanonicalTag = input(false);

  readonly ariaLabel = input('Pagination');
}
