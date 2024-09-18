import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  Injector,
  ViewContainerRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ExperimentalQuery as E, QueryDevtoolsComponent } from '@ethlete/query';
import { ProvideThemeDirective } from '@ethlete/theming';

const placeholderClientConfig = E.createQueryClientConfig({
  name: 'jsonplaceholder',
  baseUrl: 'https://jsonplaceholder.typicode.com',
});

const placeholderGetQuery = E.createGetQuery(placeholderClientConfig);

const getPost = placeholderGetQuery<GetPostQueryArgs>({ route: (p) => `/posts/${p.postId}` });

/**
 * DEMO BELOW
 */

// const clientConfig = E.createQueryClientConfig({
//   name: 'localhost',
//   baseUrl: 'http://localhost:8000',
// });

// const getQuery = E.createGetQuery(clientConfig);
// const postQuery = E.createPostQuery(clientConfig);

// const login = postQuery<{
//   body: { username: string; password: string };
//   response: { token: string; refresh_token: string };
// }>({ route: '/auth/login' });

// const tokenRefresh = postQuery<{
//   body: { refresh_token: string };
//   response: { token: string; refresh_token: string };
// }>({ route: '/auth/refresh-token' });

// const authProviderConfig = E.createBearerAuthProviderConfig({
//   name: 'localhost',
//   queryClientRef: clientConfig.token,
//   login: {
//     queryCreator: login,
//     responseTransformer: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
//   },
//   tokenRefresh: {
//     queryCreator: tokenRefresh,
//     responseTransformer: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
//   },
//   cookie: {
//     refreshArgsTransformer: (token) => ({ body: { refresh_token: token } }),
//   },
//   refreshBuffer: 60 * 60 * 1000,
// });

// const secureGetQuery = E.createSecureGetQuery(clientConfig, authProviderConfig);

type Post = {
  id: string;
  title: string;
  body: string;
};

type GetPostQueryArgs = {
  response: Post;
  pathParams: {
    postId: string;
  };
};

// type GetPostsQueryArgs = {
//   response: Post[];
// };

// const getUsers = secureGetQuery<GetPostsQueryArgs>({ route: '/users' });

@Component({
  selector: 'ethlete-dyn-comp',
  template: `
    <!-- <p>Data is: {{ data() }} ID is {{ id() }}</p>

    <p>Response</p>
    <pre>{{ myPostQuery1.response() | json }}</pre>

    <p>Loading</p>
    <pre>{{ myPostQuery1.loading() | json }}</pre>

    <p>Error</p>
    <pre>{{ myPostQuery1.error() | json }}</pre>

-->
    <!-- <p>Response</p>
    <pre>{{ myUsers.response() | json }}</pre>

    <p>Loading</p>
    <pre>{{ myUsers.loading() | json }}</pre>

    <p>Error</p>
    <pre>{{ myUsers.error() | json }}</pre>

    <button (click)="login()">Login</button>

    <p>Response</p>
    <pre>{{ bearer.latestExecutedQuery()?.response() | json }}</pre>

    <p>Loading</p>
    <pre>{{ bearer.latestExecutedQuery()?.loading() | json }}</pre>

    <p>Error</p>
    <pre>{{ bearer.latestExecutedQuery()?.error() | json }}</pre>

    <p>isAlive</p>
    <pre>{{ bearer.latestExecutedQuery()?.isAlive() | json }}</pre> -->

    <button (click)="addPostQuery()">Add post query</button>
    <button (click)="myPostList.execute()">Refresh</button>
    <button (click)="myPostList.clear()">Clear</button>

    @for (post of allPosts(); track post.id) {
      <p>{{ post.id }}: {{ post.title }}</p>
    }
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
})
export class DynCompComponent {
  data = input.required<string>();

  // myPostQuery1 = getPost(
  //   E.withArgs(() => ({ pathParams: { postId: '1' } })),
  //   E.withLogging({ logFn: (event) => console.log('EVENT on myPostQuery1', event) }),
  // );
  // myPostQuery2 = getPost(
  //   { key: 'myPostQuery2' },
  //   withArgs(() => ({ pathParams: { postId: '1' } })),
  // );
  // myPostQuery3 = getPost(
  //   withArgs(() => ({ pathParams: { postId: '1' } })),
  //   withPolling({ interval: 5000 }),
  //   withSuccessHandling({ handler: (data) => console.log('from 3', data) }),
  // );

  // myUsers = getUsers();

  // myPost = getPost(E.withArgs(() => ({ pathParams: { postId: '1' } })));

  currentPostId = signal(5);

  myPostList = E.createQueryStack(
    () => getPost(E.withArgs(() => ({ pathParams: { postId: `${this.currentPostId()}` } }))),
    { append: true },
  );

  allPosts = computed(() =>
    this.myPostList
      .response()
      .filter((p) => !!p)
      .flatMap((p) => p),
  );

  // id = computed(() => this.myPostQuery1.response()?.id);

  // bearer = inject(authProviderConfig.token);

  // login() {
  //   this.bearer.login({ body: { password: 'TestTest20-', username: 'admin@dyncdx.dev' } });
  // }

  constructor() {
    effect(() => console.log(this.myPostList.response()));
  }

  addPostQuery() {
    this.currentPostId.update((id) => id + 1);
  }
}

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, QueryDevtoolsComponent, ProvideThemeDirective],
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [
    // E.provideQueryClient(clientConfig),
    E.provideQueryClient(placeholderClientConfig),
    // E.provideBearerAuthProvider(authProviderConfig),
  ],
})
export class AppComponent {
  viewContainerRef = inject(ViewContainerRef);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  injector = inject(Injector);
  // bearer = inject(authProviderConfig.token);

  compRef: ComponentRef<DynCompComponent> | null = null;

  renderComp() {
    if (this.compRef) {
      this.compRef.destroy();
      this.compRef = null;
      return;
    }

    const ref = this.viewContainerRef.createComponent(DynCompComponent, { injector: this.injector });

    ref.setInput('data', 'Hello World');

    const hostNode = (ref.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement;

    this.elementRef.nativeElement.appendChild(hostNode);

    this.compRef = ref;
  }

  updateComp() {
    if (this.compRef) {
      this.compRef.setInput('data', 'Hello Angular');
    }
  }
}
