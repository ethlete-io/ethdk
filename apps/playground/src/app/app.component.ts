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
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ExperimentalQuery, QueryDevtoolsComponent } from '@ethlete/query';
import { ProvideThemeDirective } from '@ethlete/theming';

const placeholderClientConfig = ExperimentalQuery.createQueryClientConfig({
  name: 'jsonplaceholder',
  baseUrl: 'https://jsonplaceholder.typicode.com',
});

const placeholderGetQuery = ExperimentalQuery.createGetQuery(placeholderClientConfig);

const getPost = placeholderGetQuery<GetPostQueryArgs>({ route: (p) => `/posts/${p.postId}` });

/**
 * DEMO BELOW
 */

// const clientConfig = ExperimentalQuery.createQueryClientConfig({
//   name: 'localhost',
//   baseUrl: 'http://localhost:8000',
// });

// const getQuery = ExperimentalQuery.createGetQuery(clientConfig);
// const postQuery = ExperimentalQuery.createPostQuery(clientConfig);

// const login = postQuery<{
//   body: { username: string; password: string };
//   response: { token: string; refresh_token: string };
// }>({ route: '/auth/login' });

// const tokenRefresh = postQuery<{
//   body: { refresh_token: string };
//   response: { token: string; refresh_token: string };
// }>({ route: '/auth/refresh-token' });

// const authProviderConfig = ExperimentalQuery.createBearerAuthProviderConfig({
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

// const secureGetQuery = ExperimentalQuery.createSecureGetQuery(clientConfig, authProviderConfig);

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
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
})
export class DynCompComponent {
  data = input.required<string>();

  // myPostQuery1 = getPost(
  //   ExperimentalQuery.withArgs(() => ({ pathParams: { postId: '1' } })),
  //   ExperimentalQuery.withLogging({ logFn: (event) => console.log('EVENT on myPostQuery1', event) }),
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

  // myPost = getPost(ExperimentalQuery.withArgs(() => ({ pathParams: { postId: '1' } })));

  currentPostId = signal(5);

  myPostList = ExperimentalQuery.createQueryStack(() => {
    const id = this.currentPostId();

    const post1 = getPost(ExperimentalQuery.withArgs(() => ({ pathParams: { postId: `${id - 2}` } })));
    const post2 = getPost(ExperimentalQuery.withArgs(() => ({ pathParams: { postId: `${id - 1}` } })));
    const post3 = getPost(ExperimentalQuery.withArgs(() => ({ pathParams: { postId: `${id}` } })));

    return [post1, post2, post3];
  });

  // id = computed(() => this.myPostQuery1.response()?.id);

  // bearer = inject(authProviderConfig.token);

  // login() {
  //   this.bearer.login({ body: { password: 'TestTest20-', username: 'admin@dyncdx.dev' } });
  // }

  constructor() {
    effect(() => console.log(this.myPostList()));
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
    // ExperimentalQuery.provideQueryClient(clientConfig),
    ExperimentalQuery.provideQueryClient(placeholderClientConfig),
    // ExperimentalQuery.provideBearerAuthProvider(authProviderConfig),
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
