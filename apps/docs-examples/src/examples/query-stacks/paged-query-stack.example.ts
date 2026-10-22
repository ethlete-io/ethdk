import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { createGetQuery, createPagedQueryStack, createQueryClient, ethletePaginationAdapter } from '@ethlete/query';
import { Paginated } from '@ethlete/types';

type Post = { id: number; title: string };

type GetPostsArgs = {
  response: Paginated<Post>;
  queryParams: { page: number; limit: number };
};

const client = createQueryClient({ name: 'pagedQueryStackExample', baseUrl: 'https://query-demo.ethlete.local' });

const getPosts = createGetQuery(client)<GetPostsArgs>('/posts');

@Component({
  selector: 'app-paged-query-stack-example',
  template: `
    <div class="app-paged-stack">
      <div class="app-paged-stack-toolbar">
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

      <p>
        <code>items()</code> currently holds {{ postPages.items().length }} items - loading:
        <code>{{ postPages.loading() ? 'true' : 'false' }}</code>
      </p>

      <ul class="app-paged-stack-list">
        @for (post of postPages.items(); track post.id) {
          <li>{{ post.title }}</li>
        }
      </ul>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS],
  styles: `
    .app-paged-stack {
      display: grid;
      gap: 12px;
      max-inline-size: 640px;
      font-size: 14px;
    }

    .app-paged-stack-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .app-paged-stack p {
      margin: 0;
    }

    .app-paged-stack-list {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .app-paged-stack-list li {
      padding: 4px 10px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
      border-radius: 6px;
    }
  `,
})
export class PagedQueryStackExampleComponent {
  public postPages = createPagedQueryStack({
    queryCreator: getPosts,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
    initialPage: 4,
  });
}
