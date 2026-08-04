import { Component, signal, ViewEncapsulation } from '@angular/core';
import { toInjectFn } from '@ethlete/core';
import {
  createPagedQueryStack,
  createQueryStack,
  ethletePaginationAdapter,
  QueryErrorResponse,
  querySequence,
  withArgs,
  withErrorHandling,
  withPolling,
} from '@ethlete/query';
import { QUERY_DEVTOOLS_IMPORTS } from '../../query-devtools.imports';
import {
  confirmOrder,
  createOrder,
  createPayment,
  devtoolsDemoAuthProvider,
  devtoolsDemoSocket,
  getGqlPosts,
  getPost,
  getPosts,
  getProfile,
  getServerTime,
} from '../query-devtools-demo.utils';

const injectDemoAuthProvider = toInjectFn(devtoolsDemoAuthProvider);
const injectDemoSocket = toInjectFn(devtoolsDemoSocket);

/** A GET query living in its own component - one inspect target. */
@Component({
  selector: 'et-sb-qd-server-time',
  template: `
    <h4>Server time</h4>
    @if (serverTime.loading()) {
      <p>loading…</p>
    } @else if (serverTime.error(); as error) {
      <p class="et-sb-devtools-error">error {{ error.raw.status }}</p>
    } @else {
      <p>#{{ serverTime.response()?.requestNumber ?? '-' }} · {{ serverTime.response()?.serverTime ?? '-' }}</p>
    }
    <button (click)="serverTime.execute()" type="button">Refetch</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdServerTimeCardComponent {
  protected readonly serverTime = getServerTime(withPolling({ interval: 10_000 }));
}

/** Declared rather than inline so the devtools can show the handler's name. */
const reportPostError = (error: QueryErrorResponse) => console.warn('post failed', error.raw.status);

/** A GET query with a dynamic route + args. */
@Component({
  selector: 'et-sb-qd-post',
  template: `
    <h4>Post detail</h4>
    @if (post.loading()) {
      <p>loading…</p>
    } @else if (post.error(); as error) {
      <p class="et-sb-devtools-error">error {{ error.raw.status }}</p>
    } @else {
      <p>{{ post.response()?.title ?? '-' }}</p>
    }
    <button (click)="nextPost()" type="button">Next post</button>
    <button (click)="fail()" type="button">Fail</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdPostCardComponent {
  private postId = signal(1);
  private shouldFail = signal(false);

  protected readonly post = getPost(
    withArgs(() => ({ pathParams: { postId: this.postId() }, queryParams: this.shouldFail() ? { fail: true } : {} })),
    withErrorHandling({ handler: reportPostError }),
  );

  protected nextPost() {
    this.shouldFail.set(false);
    this.postId.update((id) => id + 1);
  }

  protected fail() {
    this.shouldFail.set(true);
    this.postId.update((id) => id + 1);
  }
}

/** A multi-query stack. */
@Component({
  selector: 'et-sb-qd-posts-stack',
  template: `
    <h4>Posts stack</h4>
    <p>
      {{ stack.queries().length }} queries ·
      @if (stack.anyLoading()) {
        loading…
      } @else if (stack.anyError()) {
        <span class="et-sb-devtools-error">error</span>
      } @else {
        {{ stack.response().length }} posts
      }
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdPostsStackCardComponent {
  protected readonly stack = createQueryStack({
    queryCreator: getPosts,
    args: () => [{ queryParams: { page: 1, limit: 5 } }, { queryParams: { page: 2, limit: 5 } }],
  });
}

/** A paged query stack. */
@Component({
  selector: 'et-sb-qd-paged',
  template: `
    <h4>Paged posts</h4>
    <p>
      {{ paged.items().length }} items ·
      @if (paged.loading()) {
        loading…
      } @else if (paged.error()) {
        <span class="et-sb-devtools-error">error</span>
      } @else {
        page loaded {{ paged.queries().length }}
      }
    </p>
    <button (click)="next()" type="button">Next page</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdPagedCardComponent {
  protected readonly paged = createPagedQueryStack({
    queryCreator: getPosts,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
  });

  protected next() {
    if (this.paged.canFetchNextPage()) this.paged.fetchNextPage();
  }
}

/** A deliberately huge response - the value explorer folds it into collapsed slices. */
@Component({
  selector: 'et-sb-qd-large',
  template: `
    <h4>Large response</h4>
    @if (large.loading()) {
      <p>loading…</p>
    } @else {
      <p>{{ large.response()?.items?.length ?? 0 }} items</p>
    }
    <button (click)="large.execute()" type="button">Refetch</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdLargeResponseCardComponent {
  protected readonly large = getPosts(withArgs(() => ({ queryParams: { page: 1, limit: 1200 } })));
}

/** A dependent-query sequence (waterfall). */
@Component({
  selector: 'et-sb-qd-checkout',
  template: `
    <h4>Checkout sequence</h4>
    <p>status: {{ checkout.status() }} · step {{ checkout.currentStep() }} / {{ checkout.total }}</p>
    <button (click)="run()" type="button">Run checkout</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdCheckoutCardComponent {
  private readonly createOrderQuery = createOrder();
  private readonly createPaymentQuery = createPayment();
  private readonly confirmOrderQuery = confirmOrder();

  protected readonly checkout = querySequence(this.createOrderQuery, () => ({ args: { body: { item: 'demo' } } }))
    .then(this.createPaymentQuery, (order) => ({ args: { body: { orderId: order.id } } }))
    .then(this.confirmOrderQuery, (payment, [order]) => ({
      args: { body: { orderId: order.id, paymentId: payment.id } },
    }));

  protected run() {
    void this.checkout.run();
  }
}

/** A GraphQL query. */
@Component({
  selector: 'et-sb-qd-gql',
  template: `
    <h4>GraphQL posts</h4>
    @if (gqlPosts.loading()) {
      <p>loading…</p>
    } @else if (gqlPosts.error()) {
      <p class="et-sb-devtools-error">error</p>
    } @else {
      <p>{{ gqlPosts.response()?.posts?.length ?? 0 }} posts</p>
    }
    <button (click)="gqlPosts.execute()" type="button">Refetch</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdGqlCardComponent {
  protected readonly gqlPosts = getGqlPosts();
}

/** A web socket client + room (no server in Storybook, so it stays disconnected). */
@Component({
  selector: 'et-sb-qd-ws',
  template: `
    <h4>Web socket</h4>
    <p>
      {{ socket.isConnected() ? 'connected' : 'disconnected (no server)' }} · room: {{ room() ? 'match-events' : '-' }}
    </p>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdWsCardComponent {
  protected readonly socket = injectDemoSocket();
  protected readonly room = this.socket.joinRoom('match-events');
}

/** The bearer auth provider. */
@Component({
  selector: 'et-sb-qd-auth',
  template: `
    <h4>Auth</h4>
    <p>{{ auth.isAuthenticated() ? 'authenticated' : 'anonymous' }} · {{ auth.executionState()?.state ?? 'idle' }}</p>
    <button (click)="login()" type="button">Login</button>
    <button (click)="auth.logout()" type="button">Logout</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdAuthCardComponent {
  protected readonly auth = injectDemoAuthProvider();

  protected login() {
    this.auth.queries.login.execute({ body: { username: 'demo', password: 'demo' } });
  }
}

/** A secure query - it only runs once the auth card has logged in. */
@Component({
  selector: 'et-sb-qd-profile',
  template: `
    <h4>Profile (secure)</h4>
    @if (profile.loading()) {
      <p>loading…</p>
    } @else if (profile.error(); as error) {
      <p class="et-sb-devtools-error">error {{ error.raw.status }}</p>
    } @else {
      <p>{{ profile.response()?.name ?? 'login first' }}</p>
    }
    <button (click)="profile.execute()" type="button">Load</button>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class QdProfileCardComponent {
  protected readonly profile = getProfile({ onlyManualExecution: true });
}

@Component({
  selector: 'et-sb-query-devtools',
  template: `
    <div class="et-sb-devtools-demo">
      <h3>Query devtools playground</h3>
      <p>
        Each card below is a separate component that creates its own queries. Toggle the panel with the floating
        <strong>Query</strong> button (or <kbd>Ctrl/Cmd</kbd> + <kbd>Alt</kbd> + <kbd>Q</kbd>), then try
        <strong>Inspect</strong> and hover the cards - each highlights its own queries.
      </p>

      <div class="et-sb-devtools-grid">
        <et-sb-qd-server-time class="et-sb-devtools-card"></et-sb-qd-server-time>
        <et-sb-qd-post class="et-sb-devtools-card"></et-sb-qd-post>
        <et-sb-qd-posts-stack class="et-sb-devtools-card"></et-sb-qd-posts-stack>
        <et-sb-qd-paged class="et-sb-devtools-card"></et-sb-qd-paged>
        <et-sb-qd-large class="et-sb-devtools-card"></et-sb-qd-large>
        <et-sb-qd-checkout class="et-sb-devtools-card"></et-sb-qd-checkout>
        <et-sb-qd-auth class="et-sb-devtools-card"></et-sb-qd-auth>
        <et-sb-qd-profile class="et-sb-devtools-card"></et-sb-qd-profile>
        <et-sb-qd-gql class="et-sb-devtools-card"></et-sb-qd-gql>
        <et-sb-qd-ws class="et-sb-devtools-card"></et-sb-qd-ws>
      </div>
    </div>

    <et-query-devtools />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    QUERY_DEVTOOLS_IMPORTS,
    QdServerTimeCardComponent,
    QdPostCardComponent,
    QdPostsStackCardComponent,
    QdPagedCardComponent,
    QdLargeResponseCardComponent,
    QdCheckoutCardComponent,
    QdAuthCardComponent,
    QdProfileCardComponent,
    QdGqlCardComponent,
    QdWsCardComponent,
  ],
  styles: `
    .et-sb-devtools-demo {
      font-family: system-ui, sans-serif;
    }

    .et-sb-devtools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
      margin-top: 16px;
      max-width: 900px;
    }

    .et-sb-devtools-card {
      display: block;
      border: 1px solid #d4d4d8;
      border-radius: 8px;
      padding: 12px;
    }

    .et-sb-devtools-card h4 {
      margin: 0 0 6px;
    }

    .et-sb-devtools-card p {
      margin: 0 0 10px;
      color: #52525b;
      font-size: 13px;
    }

    .et-sb-devtools-card button {
      margin-right: 6px;
      padding: 4px 10px;
      cursor: pointer;
    }

    .et-sb-devtools-error {
      color: #dc2626;
    }
  `,
})
export class QueryDevtoolsStorybookComponent {}
