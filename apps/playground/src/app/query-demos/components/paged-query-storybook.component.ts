import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { createPagedQueryStack, ethletePaginationAdapter } from '@ethlete/query';
import { Paginated } from '@ethlete/types';
import { demoGetQuery, PostView } from '../query-demo.utils';

type GetPostsQueryArgs = {
  response: Paginated<PostView>;
  queryParams: { page: number; limit: number };
};

const getPosts = demoGetQuery<GetPostsQueryArgs>('/posts');

@Component({
  selector: 'ethlete-sb-paged-query',
  template: `
    <div class="et-sb-paged-demo">
      <div class="et-sb-paged-demo-toolbar">
        <button
          [disabled]="!postPages.canFetchPreviousPage()"
          (click)="postPages.fetchPreviousPage()"
          et-button
          type="button"
        >
          fetchPreviousPage()
        </button>
        <button
          [disabled]="!postPages.canFetchNextPage()"
          (click)="postPages.fetchNextPage()"
          et-button
          type="button"
          color="brand"
        >
          fetchNextPage()
        </button>
        <button (click)="postPages.reset()" et-button type="button">reset()</button>
      </div>

      <p class="et-sb-paged-demo-hint">
        The stack starts at page 4 of 8, so pages can be fetched in both directions.
        <code>items()</code> currently holds {{ postPages.items().length }} items — loading:
        <code>{{ postPages.loading() ? 'true' : 'false' }}</code>
      </p>

      <ul class="et-sb-paged-demo-list">
        @for (post of postPages.items(); track post.id) {
          <li>{{ post.title }}</li>
        }
      </ul>
    </div>
  `,
  styles: `
    .et-sb-paged-demo {
      display: grid;
      gap: 12px;
      max-width: 640px;
      font-size: 14px;
    }

    .et-sb-paged-demo-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .et-sb-paged-demo-hint {
      margin: 0;
      opacity: 0.75;
    }

    .et-sb-paged-demo-list {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .et-sb-paged-demo-list li {
      padding: 4px 10px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      border-radius: 6px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS],
})
export class PagedQueryStorybookComponent {
  postPages = createPagedQueryStack({
    queryCreator: getPosts,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
    initialPage: 4,
  });
}
