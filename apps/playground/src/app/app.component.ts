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
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { QueryDevtoolsComponent } from '@ethlete/query';
import { ProvideThemeDirective } from '@ethlete/theming';
import { provideBearerAuthProvider } from './query/bearer-auth-provider';
import { createBearerAuthProviderConfig } from './query/bearer-auth-provider-config';
import { provideQueryClient } from './query/query-client';
import { createQueryClientConfig } from './query/query-client-config';
import { createGetQuery, createPostQuery, createSecureGetQuery } from './query/query-creator-templates';
import { withArgs, withLogging, withPolling, withSuccessHandling } from './query/query-features';

/**
 * DEMO BELOW
 */

const clientConfig = createQueryClientConfig({
  name: 'jsonplaceholder',
  baseUrl: 'http://localhost:8000',
});

const getQuery = createGetQuery(clientConfig);
const postQuery = createPostQuery(clientConfig);

const login = postQuery<{
  body: { username: string; password: string };
  response: { token: string; refresh_token: string };
}>({ route: '/auth/login' });

const tokenRefresh = postQuery<{
  body: { refresh_token: string };
  response: { token: string; refresh_token: string };
}>({ route: '/auth/refresh-token' });

const authProviderConfig = createBearerAuthProviderConfig({
  name: 'jsonplaceholder',
  queryClientRef: clientConfig.token,
  login: {
    queryCreator: login,
    responseTransformer: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
  },
  tokenRefresh: {
    queryCreator: tokenRefresh,
    responseTransformer: (response) => ({ accessToken: response.token, refreshToken: response.refresh_token }),
  },
  cookie: {
    refreshArgsTransformer: (token) => ({ body: { refresh_token: token } }),
  },
  refreshBuffer: 60 * 60 * 1000,
});

const secureGetQuery = createSecureGetQuery(clientConfig, authProviderConfig);

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

type GetPostsQueryArgs = {
  response: Post[];
};

const getPost = getQuery<GetPostQueryArgs>({ route: (p) => `/posts/${p.postId}` });
const getPosts = getQuery<GetPostsQueryArgs>({ route: '/posts' });

@Component({
  selector: 'ethlete-dyn-comp',
  template: `
    <p>Data is: {{ data() }} ID is {{ id() }}</p>

    <p>Response</p>
    <pre>{{ myPostQuery1.response() | json }}</pre>

    <p>Loading</p>
    <pre>{{ myPostQuery1.loading() | json }}</pre>

    <p>Error</p>
    <pre>{{ myPostQuery1.error() | json }}</pre>

    <p>Response</p>
    <pre>{{ myPosts.response() | json }}</pre>

    <p>Loading</p>
    <pre>{{ myPosts.loading() | json }}</pre>

    <p>Error</p>
    <pre>{{ myPosts.error() | json }}</pre>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [JsonPipe],
})
export class DynCompComponent {
  data = input.required<string>();

  myPostQuery1 = getPost(
    withArgs(() => ({ pathParams: { postId: '1' } })),
    withLogging({ logFn: (event) => console.log('EVENT on myPostQuery1', event) }),
  );
  myPostQuery2 = getPost(
    { key: 'myPostQuery2' },
    withArgs(() => ({ pathParams: { postId: '1' } })),
  );
  myPostQuery3 = getPost(
    withArgs(() => ({ pathParams: { postId: '1' } })),
    withPolling({ interval: 5000 }),
    withSuccessHandling({ handler: (data) => console.log('from 3', data) }),
  );

  myPosts = getPosts();

  id = computed(() => this.myPostQuery1.response()?.id);

  bearer = inject(authProviderConfig.token);

  constructor() {
    effect(() => console.log(this.data()));

    this.bearer.login({ body: { password: 'TestTest20-', username: 'admin@dyncdx.dev' } });
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
  providers: [provideQueryClient(clientConfig), provideBearerAuthProvider(authProviderConfig)],
})
export class AppComponent {
  viewContainerRef = inject(ViewContainerRef);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  injector = inject(Injector);
  bearer = inject(authProviderConfig.token);

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
