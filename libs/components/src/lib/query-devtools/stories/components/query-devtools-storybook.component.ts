import { Component, computed, input, signal, ViewEncapsulation } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { AutoSurfaceDirective, ProvideColorDirective, toInjectFn } from '@ethlete/core';
import {
  createPagedQueryStack,
  defineQueryForm,
  createQueryStack,
  ethletePaginationAdapter,
  queryField,
  QueryErrorResponse,
  querySequence,
  searchQueryField,
  withArgs,
  withErrorHandling,
  withPolling,
  withSuccessHandling,
} from '@ethlete/query';
import { BUTTON_IMPORTS } from '../../../button';
import { CHECKBOX_IMPORTS } from '../../../forms/checkbox';
import { CHOICE_FIELD_IMPORTS } from '../../../forms/choice-field';
import { FORM_FIELD_IMPORTS } from '../../../forms/form-field';
import { INPUT_IMPORTS } from '../../../forms/input';
import {
  ARROW_RIGHT_ICON,
  FILE_ICON,
  ICON_IMPORTS,
  LOCK_ICON,
  PLAY_ICON,
  PLUS_ICON,
  provideIcons,
  ROTATE_RIGHT_ICON,
  TIMES_ICON,
  TRIANGLE_EXCLAMATION_ICON,
} from '../../../icon';
import { QUERY_DEVTOOLS_IMPORTS } from '../../query-devtools.imports';
import {
  armFlakyEndpoint,
  confirmOrder,
  createOrder,
  createPayment,
  createPost,
  devtoolsDemoAuthProvider,
  devtoolsDemoClient,
  devtoolsDemoSocket,
  getDownload,
  getFlaky,
  getGqlPosts,
  getPost,
  getPosts,
  getProfile,
  getServerTime,
} from '../query-devtools-demo.utils';

const injectDemoAuthProvider = toInjectFn(devtoolsDemoAuthProvider);
const injectDemoClient = toInjectFn(devtoolsDemoClient);
const injectDemoSocket = toInjectFn(devtoolsDemoSocket);

type QdState = 'idle' | 'loading' | 'ok' | 'error';

/** Color themes the playground registers - a story may name them, library code may not. */
const STATE_THEMES: Record<QdState, string> = {
  idle: 'neutral',
  loading: 'warning',
  ok: 'success',
  error: 'danger',
};

const stateOf = (query: { loading: () => unknown; error: () => unknown; response: () => unknown }): QdState =>
  query.loading() ? 'loading' : query.error() ? 'error' : query.response() ? 'ok' : 'idle';

/** A themed dot plus a line of text - the state of one card at a glance. */
@Component({
  selector: 'et-sb-qd-status',
  template: `
    <span [etProvideColor]="theme()" class="et-sb-qd-status-dot" aria-hidden="true"></span>
    <span><ng-content /></span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ProvideColorDirective],
  host: {
    class: 'et-sb-qd-status text-small',
    '[attr.data-state]': 'state()',
  },
})
export class QdStatusComponent {
  public state = input<QdState>('idle');

  protected theme = computed(() => STATE_THEMES[this.state()]);
}

/** The chrome every card shares: heading, status slot, optional body slot, action row. */
@Component({
  selector: 'et-sb-qd-card',
  template: `
    <h4 class="et-sb-qd-card-heading text-medium">{{ heading() }}</h4>
    <ng-content select="[qdStatus]" />
    <div class="et-sb-qd-card-body"><ng-content select="[qdBody]" /></div>
    <div class="et-sb-qd-card-actions"><ng-content /></div>
  `,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [AutoSurfaceDirective],
  host: {
    class: 'et-sb-qd-card',
  },
})
export class QdCardComponent {
  public heading = input.required<string>();
}

const CARD_IMPORTS = [QdCardComponent, QdStatusComponent, BUTTON_IMPORTS, ICON_IMPORTS] as const;

/** A GET query living in its own component - one inspect target. */
@Component({
  selector: 'et-sb-qd-server-time',
  template: `
    <et-sb-qd-card heading="Server time">
      <et-sb-qd-status [state]="state()" qdStatus>
        @if (serverTime.error(); as error) {
          request failed with {{ error.raw.status }}
        } @else {
          #{{ serverTime.response()?.requestNumber ?? '-' }} · {{ serverTime.response()?.serverTime ?? '-' }}
        }
      </et-sb-qd-status>

      <button [loading]="!!serverTime.loading()" (click)="serverTime.execute()" et-button size="sm" variant="tonal">
        <i etIcon="et-rotate-right"></i>
        Refetch
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdServerTimeCardComponent {
  protected readonly serverTime = getServerTime(withPolling({ interval: 10_000 }));

  protected state = computed(() => stateOf(this.serverTime));
}

/** Declared rather than inline so the devtools can show the handler's name. */
const reportPostError = (error: QueryErrorResponse) => console.warn('post failed', error.raw.status);

/** A GET query with a dynamic route + args. */
@Component({
  selector: 'et-sb-qd-post',
  template: `
    <et-sb-qd-card heading="Post detail">
      <et-sb-qd-status [state]="state()" qdStatus>
        @if (post.error(); as error) {
          request failed with {{ error.raw.status }}
        } @else {
          {{ post.response()?.title ?? '-' }}
        }
      </et-sb-qd-status>

      <button [loading]="!!post.loading()" (click)="nextPost()" et-button size="sm" variant="tonal">
        <i etIcon="et-arrow-right"></i>
        Next post
      </button>
      <button (click)="fail()" et-button size="sm" variant="tonal" color="danger">
        <i etIcon="et-triangle-exclamation"></i>
        Fail
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdPostCardComponent {
  private postId = signal(1);
  private shouldFail = signal(false);

  protected readonly post = getPost(
    withArgs(() => ({ pathParams: { postId: this.postId() }, queryParams: this.shouldFail() ? { fail: true } : {} })),
    withErrorHandling({ handler: reportPostError }),
  );

  protected state = computed(() => stateOf(this.post));

  protected nextPost() {
    this.shouldFail.set(false);
    this.postId.update((id) => id + 1);
  }

  protected fail() {
    this.shouldFail.set(true);
    this.postId.update((id) => id + 1);
  }
}

/** A query the API fails a few times before answering - the retry policy is what makes it succeed. */
@Component({
  selector: 'et-sb-qd-flaky',
  template: `
    <et-sb-qd-card heading="Flaky endpoint">
      <et-sb-qd-status [state]="state()" qdStatus>
        @if (flaky.error(); as error) {
          gave up with {{ error.raw.status }}
        } @else {
          {{ flaky.response() ? 'answered' : 'idle' }}
        }
      </et-sb-qd-status>

      <button [loading]="!!flaky.loading()" (click)="retryTwice()" et-button size="sm" variant="tonal">
        <i etIcon="et-rotate-right"></i>
        Fail twice, then succeed
      </button>
      <button (click)="failHard()" et-button size="sm" variant="tonal" color="danger">
        <i etIcon="et-triangle-exclamation"></i>
        Fail past the retry limit
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdFlakyCardComponent {
  protected readonly flaky = getFlaky({ onlyManualExecution: true });

  protected state = computed(() => stateOf(this.flaky));

  protected retryTwice() {
    armFlakyEndpoint(2);
    this.flaky.execute();
  }

  /** The default policy gives up after three retries, so this one ends as a failure with four attempts. */
  protected failHard() {
    armFlakyEndpoint(10);
    this.flaky.execute();
  }
}

/** A query asking for progress events, so the panel has a transfer to draw a bar for. */
@Component({
  selector: 'et-sb-qd-download',
  template: `
    <et-sb-qd-card heading="Download (progress)">
      <et-sb-qd-status [state]="state()" qdStatus>
        @if (download.loading()?.progress; as progress) {
          {{ progress.percentage.toFixed(0) }}%
        } @else {
          {{ download.response()?.bytes ?? 0 }} bytes
        }
      </et-sb-qd-status>

      <button [loading]="!!download.loading()" (click)="download.execute()" et-button size="sm" variant="tonal">
        <i etIcon="et-file"></i>
        Download
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdDownloadCardComponent {
  protected readonly download = getDownload({ onlyManualExecution: true });

  protected state = computed(() => stateOf(this.download));
}

/** A multi-query stack. */
@Component({
  selector: 'et-sb-qd-posts-stack',
  template: `
    <et-sb-qd-card heading="Posts stack">
      <et-sb-qd-status [state]="state()" qdStatus>
        {{ stack.queries().length }} queries ·
        @if (stack.anyLoading()) {
          loading…
        } @else if (stack.anyError()) {
          one failed
        } @else {
          {{ stack.response().length }} posts
        }
      </et-sb-qd-status>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdPostsStackCardComponent {
  protected readonly stack = createQueryStack({
    queryCreator: getPosts,
    args: () => [{ queryParams: { page: 1, limit: 5 } }, { queryParams: { page: 2, limit: 5 } }],
  });

  protected state = computed<QdState>(() =>
    this.stack.anyLoading() ? 'loading' : this.stack.anyError() ? 'error' : 'ok',
  );
}

/** A paged query stack. */
@Component({
  selector: 'et-sb-qd-paged',
  template: `
    <et-sb-qd-card heading="Paged posts">
      <et-sb-qd-status [state]="state()" qdStatus>
        {{ paged.items().length }} items ·
        @if (paged.error()) {
          page failed
        } @else {
          {{ paged.queries().length }} page(s) loaded
        }
      </et-sb-qd-status>

      <button [loading]="!!paged.loading()" (click)="next()" et-button size="sm" variant="tonal">
        <i etIcon="et-arrow-right"></i>
        Next page
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdPagedCardComponent {
  protected readonly paged = createPagedQueryStack({
    queryCreator: getPosts,
    responseNormalizer: ethletePaginationAdapter,
    args: (page) => ({ queryParams: { page, limit: 5 } }),
  });

  protected state = computed<QdState>(() => (this.paged.loading() ? 'loading' : this.paged.error() ? 'error' : 'ok'));

  protected next() {
    if (this.paged.canFetchNextPage()) this.paged.fetchNextPage();
  }
}

/**
 * A query form driving a list query. The Forms tab shows its fields and the query it drives; the query's
 * own detail names the form back under "Args from".
 */
@Component({
  selector: 'et-sb-qd-filters',
  template: `
    <et-sb-qd-card heading="Filtered posts (query form)">
      <et-sb-qd-status [state]="state()" qdStatus>
        page {{ qf.value().page ?? 1 }} · {{ qf.activeFilterCount() }} active filter(s) ·
        {{ posts.response()?.items?.length ?? 0 }} posts
      </et-sb-qd-status>

      <div class="flex flex-col gap-3" qdBody>
        <et-form-field [busy]="!!posts.loading()" size="sm" fill="filled" labelMode="floating-inside">
          <et-label>Search (300ms debounce)</et-label>
          <et-input [formField]="qf.fields.search" type="search" />
        </et-form-field>

        <et-choice-field>
          <et-checkbox [formField]="qf.fields.draftsOnly" />
          <et-label>Drafts only</et-label>
        </et-choice-field>
      </div>

      <button (click)="qf.patchValue({ page: (qf.value().page ?? 1) + 1 })" et-button size="sm" variant="tonal">
        <i etIcon="et-arrow-right"></i>
        Next page
      </button>
      <button (click)="qf.resetAllFieldsToDefault()" et-button size="sm" variant="transparent">
        <i etIcon="et-times"></i>
        Reset
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, CHOICE_FIELD_IMPORTS, CHECKBOX_IMPORTS, FormField],
})
export class QdFilterFormCardComponent {
  protected readonly qf = defineQueryForm({
    name: 'posts',
    queryParamPrefix: 'posts',
    fields: {
      search: searchQueryField(),
      draftsOnly: queryField<boolean>({ defaultValue: false }),
      page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'draftsOnly'] }),
    },
  }).observe();

  protected readonly posts = getPosts(
    withArgs(() => {
      const { search, page } = this.qf.value();

      return { queryParams: { page: page ?? 1, limit: 5, ...(search ? { query: search } : {}) } };
    }),
  );

  protected state = computed(() => stateOf(this.posts));
}

/** A mutation plus the invalidation it triggers - one Events row listing every query that refetched. */
@Component({
  selector: 'et-sb-qd-invalidate',
  template: `
    <et-sb-qd-card heading="Create post + invalidate">
      <et-sb-qd-status [state]="state()" qdStatus>
        {{ create.response()?.title ?? 'nothing created yet' }}
      </et-sb-qd-status>

      <button [loading]="!!create.loading()" (click)="run()" et-button size="sm" variant="tonal">
        <i etIcon="et-plus"></i>
        Create, then invalidate /posts
      </button>
      <button (click)="client.invalidateQueries()" et-button size="sm" variant="transparent">
        <i etIcon="et-rotate-right"></i>
        Invalidate everything
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdInvalidateCardComponent {
  protected readonly client = injectDemoClient();

  protected readonly create = createPost(
    withSuccessHandling({ handler: () => this.client.invalidateQueries({ url: '/posts' }) }),
  );

  protected state = computed(() => stateOf(this.create));

  protected run() {
    this.create.execute({ args: { body: { title: 'Freshly created post' } } });
  }
}

/** A deliberately huge response - the value explorer folds it into collapsed slices. */
@Component({
  selector: 'et-sb-qd-large',
  template: `
    <et-sb-qd-card heading="Large response">
      <et-sb-qd-status [state]="state()" qdStatus>{{ large.response()?.items?.length ?? 0 }} items</et-sb-qd-status>

      <button [loading]="!!large.loading()" (click)="large.execute()" et-button size="sm" variant="tonal">
        <i etIcon="et-rotate-right"></i>
        Refetch
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdLargeResponseCardComponent {
  protected readonly large = getPosts(withArgs(() => ({ queryParams: { page: 1, limit: 1200 } })));

  protected state = computed(() => stateOf(this.large));
}

/** A dependent-query sequence (waterfall). */
@Component({
  selector: 'et-sb-qd-checkout',
  template: `
    <et-sb-qd-card heading="Checkout sequence">
      <et-sb-qd-status [state]="state()" qdStatus>
        {{ checkout.status() }} · step {{ checkout.currentStep() }} / {{ checkout.total }}
      </et-sb-qd-status>

      <button [loading]="checkout.status() === 'running'" (click)="run()" et-button size="sm" variant="tonal">
        <i etIcon="et-play"></i>
        Run checkout
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
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

  protected state = computed<QdState>(() => {
    const status = this.checkout.status();

    if (status === 'running') return 'loading';
    if (status === 'error') return 'error';

    return status === 'success' ? 'ok' : 'idle';
  });

  protected run() {
    void this.checkout.run();
  }
}

/** A GraphQL query. */
@Component({
  selector: 'et-sb-qd-gql',
  template: `
    <et-sb-qd-card heading="GraphQL posts">
      <et-sb-qd-status [state]="state()" qdStatus>
        @if (gqlPosts.error()) {
          request failed
        } @else {
          {{ gqlPosts.response()?.posts?.length ?? 0 }} posts
        }
      </et-sb-qd-status>

      <button [loading]="!!gqlPosts.loading()" (click)="gqlPosts.execute()" et-button size="sm" variant="tonal">
        <i etIcon="et-rotate-right"></i>
        Refetch
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdGqlCardComponent {
  protected readonly gqlPosts = getGqlPosts();

  protected state = computed(() => stateOf(this.gqlPosts));
}

/** A web socket client + room (no server in Storybook, so it stays disconnected). */
@Component({
  selector: 'et-sb-qd-ws',
  template: `
    <et-sb-qd-card heading="Web socket">
      <et-sb-qd-status [state]="socket.isConnected() ? 'ok' : 'idle'" qdStatus>
        {{ socket.isConnected() ? 'connected' : 'disconnected (no server)' }} · room:
        {{ room() ? 'match-events' : '-' }}
      </et-sb-qd-status>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdWsCardComponent {
  protected readonly socket = injectDemoSocket();
  protected readonly room = this.socket.joinRoom('match-events');
}

/** The bearer auth provider. */
@Component({
  selector: 'et-sb-qd-auth',
  template: `
    <et-sb-qd-card heading="Auth">
      <et-sb-qd-status [state]="state()" qdStatus>
        {{ auth.isAuthenticated() ? 'authenticated' : 'anonymous' }} · {{ auth.executionState()?.state ?? 'idle' }}
      </et-sb-qd-status>

      <button (click)="login()" et-button size="sm" variant="tonal">
        <i etIcon="et-lock"></i>
        Login
      </button>
      <button (click)="auth.logout()" et-button size="sm" variant="transparent">
        <i etIcon="et-times"></i>
        Logout
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdAuthCardComponent {
  protected readonly auth = injectDemoAuthProvider();

  protected state = computed<QdState>(() => (this.auth.isAuthenticated() ? 'ok' : 'idle'));

  protected login() {
    this.auth.queries.login.execute({ body: { username: 'demo', password: 'demo' } });
  }
}

/** A secure query - it only runs once the auth card has logged in. */
@Component({
  selector: 'et-sb-qd-profile',
  template: `
    <et-sb-qd-card heading="Profile (secure)">
      <et-sb-qd-status [state]="state()" qdStatus>
        @if (profile.error(); as error) {
          request failed with {{ error.raw.status }}
        } @else {
          {{ profile.response()?.name ?? 'login first' }}
        }
      </et-sb-qd-status>

      <button [loading]="!!profile.loading()" (click)="profile.execute()" et-button size="sm" variant="tonal">
        <i etIcon="et-lock"></i>
        Load
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdProfileCardComponent {
  protected readonly profile = getProfile({ onlyManualExecution: true });

  protected state = computed(() => stateOf(this.profile));
}

/** The query a {@link QdUnmountCardComponent} destroys along with this component. */
@Component({
  selector: 'et-sb-qd-doomed',
  template: `
    <et-sb-qd-status [state]="state()" qdStatus>
      @if (post.error(); as error) {
        request failed with {{ error.raw.status }}
      } @else {
        {{ post.response()?.title ?? 'loading' }}
      }
    </et-sb-qd-status>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS],
})
export class QdDoomedCardComponent {
  protected readonly post = getPost(withArgs(() => ({ pathParams: { postId: 7 }, queryParams: { fail: true } })));

  protected state = computed(() => stateOf(this.post));
}

/** A query whose component goes away while its request is failing - the case tombstones exist for. */
@Component({
  selector: 'et-sb-qd-unmount',
  template: `
    <et-sb-qd-card heading="Unmount a failing query">
      @if (mounted()) {
        <et-sb-qd-doomed />
      } @else {
        <et-sb-qd-status state="idle" qdStatus>unmounted - find it under the panel's Gone chip</et-sb-qd-status>
      }

      <button (click)="mounted.set(true)" et-button size="sm" variant="tonal">
        <i etIcon="et-plus"></i>
        Mount
      </button>
      <button (click)="mounted.set(false)" et-button size="sm" variant="tonal" color="danger">
        <i etIcon="et-times"></i>
        Unmount
      </button>
    </et-sb-qd-card>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CARD_IMPORTS, QdDoomedCardComponent],
})
export class QdUnmountCardComponent {
  protected mounted = signal(false);
}

@Component({
  selector: 'et-sb-query-devtools',
  template: `
    <div class="et-sb-devtools-demo flex flex-col gap-8 p-8 font-sans">
      <header class="flex flex-col gap-2">
        <h3 class="text-h5">Query devtools playground</h3>
        <p class="text-medium max-w-[70ch] opacity-70">
          Each card below is a separate component that creates its own queries. Toggle the panel with the floating
          <strong>Query</strong> button (or <kbd>Ctrl/Cmd</kbd> + <kbd>Alt</kbd> + <kbd>Q</kbd>), then try
          <strong>Inspect</strong> and hover the cards - each highlights its own queries.
        </p>
      </header>

      <div class="et-sb-devtools-grid">
        <et-sb-qd-server-time />
        <et-sb-qd-post />
        <et-sb-qd-flaky />
        <et-sb-qd-download />
        <et-sb-qd-posts-stack />
        <et-sb-qd-paged />
        <et-sb-qd-filters />
        <et-sb-qd-invalidate />
        <et-sb-qd-large />
        <et-sb-qd-checkout />
        <et-sb-qd-auth />
        <et-sb-qd-profile />
        <et-sb-qd-gql />
        <et-sb-qd-ws />
        <et-sb-qd-unmount />
      </div>
    </div>

    <et-query-devtools />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    QUERY_DEVTOOLS_IMPORTS,
    QdServerTimeCardComponent,
    QdPostCardComponent,
    QdFlakyCardComponent,
    QdDownloadCardComponent,
    QdPostsStackCardComponent,
    QdPagedCardComponent,
    QdFilterFormCardComponent,
    QdUnmountCardComponent,
    QdInvalidateCardComponent,
    QdLargeResponseCardComponent,
    QdCheckoutCardComponent,
    QdAuthCardComponent,
    QdProfileCardComponent,
    QdGqlCardComponent,
    QdWsCardComponent,
  ],
  providers: [
    provideIcons(
      ARROW_RIGHT_ICON,
      FILE_ICON,
      LOCK_ICON,
      PLAY_ICON,
      PLUS_ICON,
      ROTATE_RIGHT_ICON,
      TIMES_ICON,
      TRIANGLE_EXCLAMATION_ICON,
    ),
  ],
  styles: `
    @layer components {
      .et-sb-devtools-demo kbd {
        display: inline-block;
        padding: 1px 5px;
        border: 1px solid var(--et-surface-border-solid);
        border-radius: 4px;
        background: color-mix(in srgb, var(--et-surface-interaction-solid) 10%, transparent);
        font-family: ui-monospace, monospace;
        font-size: 0.9em;
      }

      .et-sb-devtools-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 12px;
        max-inline-size: 1160px;

        /* The grid item is the wrapper component, not the card inside it. It stays a real box -
           inspect measures its bounding rect - and passes the stretched row height down. */
        > * {
          display: flex;
          flex-direction: column;
        }
      }

      .et-sb-qd-card {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 8px;
        padding: 14px 16px 16px;
        border: 1px solid var(--et-surface-border-solid);
        border-radius: 12px;
        background: var(--et-surface-background-solid);
        color: var(--et-surface-color-solid);
      }

      .et-sb-qd-card-heading {
        margin: 0;
        font-weight: 600;
      }

      .et-sb-qd-card-body:empty {
        display: none;
      }

      .et-sb-qd-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-block-start: auto;
        padding-block-start: 4px;

        &:empty {
          display: none;
        }
      }

      .et-sb-qd-status {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: var(--et-surface-color-muted-solid);
      }

      .et-sb-qd-status-dot {
        flex: none;
        inline-size: 8px;
        block-size: 8px;
        /* centred on the first line rather than on the whole (possibly wrapped) block */
        margin-block-start: calc((1lh - 8px) / 2);
        border-radius: 999px;
        background: var(--et-theme-color-primary-solid);
      }

      .et-sb-qd-status[data-state='loading'] .et-sb-qd-status-dot {
        animation: et-sb-qd-pulse 1s ease-in-out infinite;
      }

      @keyframes et-sb-qd-pulse {
        50% {
          opacity: 0.25;
        }
      }
    }
  `,
})
export class QueryDevtoolsStorybookComponent {}
