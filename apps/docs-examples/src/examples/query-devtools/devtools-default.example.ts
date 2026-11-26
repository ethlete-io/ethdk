import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import {
  createGetQuery,
  createPagedQueryStack,
  createQueryClient,
  ethletePaginationAdapter,
  withArgs,
  withPolling,
} from '@ethlete/query';
import { QueryDevtoolsLazyComponent } from '@ethlete/query-devtools/lazy';
import { Paginated } from '@ethlete/types';

type Post = { id: number; title: string };

@Component({
  selector: 'app-query-devtools-example',
  template: `
    <div class="app-devtools">
      <p>
        Open the panel with the floating <strong>Query</strong> button or <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> +
        <kbd>Alt</kbd> + <kbd>Q</kbd>.
      </p>

      <section>
        <h4>Server time (polls every 10s)</h4>
        <p>#{{ serverTime.response()?.requestNumber ?? '-' }} · {{ serverTime.response()?.serverTime ?? '-' }}</p>
        <button [loading]="!!serverTime.loading()" (click)="serverTime.execute()" et-button size="sm" variant="tonal">
          Refetch
        </button>
      </section>

      <section>
        <h4>Post detail</h4>
        <p>{{ postTitle() }}</p>
        <div class="app-devtools-actions">
          <button [loading]="!!post.loading()" (click)="nextPost()" et-button size="sm" variant="tonal">
            Next post
          </button>
          <button (click)="fail()" et-button size="sm" variant="tonal">Fail</button>
        </div>
      </section>

      <section>
        <h4>Paged posts</h4>
        <p>{{ paged.items().length }} items · {{ paged.queries().length }} page(s) loaded</p>
        <button [loading]="!!paged.loading()" (click)="paged.fetchNextPage()" et-button size="sm" variant="tonal">
          Next page
        </button>
      </section>
    </div>

    <et-query-devtools-lazy />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsLazyComponent, ...BUTTON_IMPORTS],
  styles: `
    .app-devtools {
      display: grid;
      gap: 12px;
      max-inline-size: 480px;
      font-size: 14px;
    }

    .app-devtools section {
      display: grid;
      gap: 6px;
      padding: 12px;
      border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
      border-radius: 8px;
    }

    .app-devtools h4,
    .app-devtools p {
      margin: 0;
    }

    .app-devtools-actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class QueryDevtoolsExampleComponent {
  private postId = signal(1);
  private shouldFail = signal(false);

  protected serverTime = getServerTime(withPolling({ interval: 10_000 }));

  protected post = getPost(
    withArgs(() => ({ pathParams: { postId: this.postId() }, queryParams: this.shouldFail() ? { fail: true } : {} })),
  );

  protected paged = createPagedQueryStack({
    queryCreator: getPosts,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
  });

  protected postTitle = computed(() => (this.post.error() ? 'request failed' : (this.post.response()?.title ?? '-')));

  protected nextPost() {
    this.shouldFail.set(false);
    this.postId.update((id) => id + 1);
  }

  protected fail() {
    this.shouldFail.set(true);
    this.postId.update((id) => id + 1);
  }
}

const client = createQueryClient({ name: 'queryDevtoolsExample', baseUrl: 'https://query-demo.ethlete.local' });

const getServerTime = createGetQuery(client)<{ response: { requestNumber: number; serverTime: string } }>(
  '/server-time',
);

const getPost = createGetQuery(client)<{
  response: Post;
  pathParams: { postId: number };
  queryParams?: { fail?: boolean };
}>((p) => `/posts/${p.postId}`);

const getPosts = createGetQuery(client)<{
  response: Paginated<Post>;
  queryParams: { page: number; limit: number };
}>('/posts');
