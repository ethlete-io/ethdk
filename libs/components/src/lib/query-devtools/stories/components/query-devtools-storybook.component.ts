import { Component, signal, ViewEncapsulation } from '@angular/core';
import {
  createPagedQueryStack,
  createQueryStack,
  ethletePaginationAdapter,
  querySequence,
  withArgs,
} from '@ethlete/query';
import { QUERY_DEVTOOLS_IMPORTS } from '../../query-devtools.imports';
import {
  confirmOrder,
  createOrder,
  createPayment,
  devtoolsDemoAuthProvider,
  getPost,
  getPosts,
  getServerTime,
} from '../query-devtools-demo.utils';

const [, injectDemoAuthProvider] = devtoolsDemoAuthProvider;

@Component({
  selector: 'et-sb-query-devtools',
  template: `
    <div class="et-sb-devtools-demo">
      <h3>Query devtools playground</h3>
      <p>
        Every fixture below is registered with the devtools. Open the panel with the floating
        <strong>Query</strong> button (bottom-right) and explore each tab.
      </p>

      <div class="et-sb-devtools-demo-toolbar">
        <button (click)="serverTime.execute()" type="button">Refetch server time</button>
        <button (click)="loadNextPage()" type="button">Paged: next page</button>
        <button (click)="login()" type="button">Auth: login</button>
        <button (click)="runCheckout()" type="button">Sequence: run checkout</button>
        <button (click)="failPost()" type="button">Detail query: fail</button>
      </div>

      <p class="et-sb-devtools-demo-hint">
        Server time #{{ serverTime.response()?.requestNumber ?? '—' }} · post detail:
        {{ postDetail.executionState()?.type ?? '—' }} · stack: {{ postsStack.queries().length }} · paged items:
        {{ pagedPosts.items().length }} · checkout: {{ checkout.status() }}
      </p>
    </div>

    <et-query-devtools />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QUERY_DEVTOOLS_IMPORTS],
  styles: `
    .et-sb-devtools-demo {
      max-width: 720px;
      font-family: system-ui, sans-serif;
    }

    .et-sb-devtools-demo-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
    }

    .et-sb-devtools-demo-toolbar button {
      padding: 6px 12px;
      cursor: pointer;
    }

    .et-sb-devtools-demo-hint {
      color: #71717a;
      font-size: 13px;
    }
  `,
})
export class QueryDevtoolsStorybookComponent {
  private readonly auth = injectDemoAuthProvider();

  private postId = signal(1);
  private failNextPost = signal(false);

  // A simple auto-executing GET query.
  protected readonly serverTime = getServerTime();

  // A GET query with a dynamic route + args (exercises route stringification + the args view).
  protected readonly postDetail = getPost(
    withArgs(() => ({ pathParams: { postId: this.postId() }, queryParams: this.failNextPost() ? { fail: true } : {} })),
  );

  // A multi-query stack.
  protected readonly postsStack = createQueryStack({
    queryCreator: getPosts,
    args: () => [{ queryParams: { page: 1, limit: 5 } }, { queryParams: { page: 2, limit: 5 } }],
  });

  // A paged query stack (infinite-scroll style).
  protected readonly pagedPosts = createPagedQueryStack({
    queryCreator: getPosts,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
  });

  // A dependent-query sequence (waterfall).
  private readonly createOrderQuery = createOrder();
  private readonly createPaymentQuery = createPayment();
  private readonly confirmOrderQuery = confirmOrder();

  protected readonly checkout = querySequence(this.createOrderQuery, () => ({ args: { body: { item: 'demo' } } }))
    .then(this.createPaymentQuery, (order) => ({ args: { body: { orderId: order.id } } }))
    .then(this.confirmOrderQuery, (payment, [order]) => ({
      args: { body: { orderId: order.id, paymentId: payment.id } },
    }));

  protected loadNextPage() {
    if (this.pagedPosts.canFetchNextPage()) this.pagedPosts.fetchNextPage();
  }

  protected login() {
    this.auth.queries.login.execute({ body: { username: 'demo', password: 'demo' } });
  }

  protected runCheckout() {
    void this.checkout.run();
  }

  protected failPost() {
    this.failNextPost.set(true);
    this.postId.update((id) => id + 1);
  }
}
