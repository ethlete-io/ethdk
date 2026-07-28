import { JsonPipe } from '@angular/common';
import {
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  inject,
  Injector,
  input,
  signal,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import {
  applyDescriptionBinding,
  applyHeadTitleBinding,
  applyMetaBinding,
  createDestroy,
  injectRenderer,
  signalAnimatedNumber,
} from '@ethlete/core';
import {
  QueryDevtoolsComponent,
  QueryDirective,
  withArgs,
  withLogging,
  withPolling,
  withSuccessHandling,
} from '@ethlete/query';
import { getPost, injectAuthProvider, legacyGetPost } from './app.queries';

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
    <pre>{{ myPost.response() | json }}</pre>

    <p>Loading</p>
    <pre>{{ myPost.loading() | json }}</pre>

    <p>Error</p>
    <pre>{{ myPost.error() | json }}</pre>

    <button (click)="updateResponse()">Update response</button>
    <button (click)="refreshToOriginal()">Refresh to original</button>

    <br />
    <br />
    <br /> -->

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

    <!-- <button (click)="addPostQuery()">Add post query</button>
    <button (click)="myPostList.execute()">Refresh</button>
    <button (click)="myPostList.clear()">Clear</button>

    @for (post of myPostList.response(); track post.id) {
      <p>{{ post.id }}: {{ post.title }}</p>
    }

    <button [disabled]="!paged.canFetchPreviousPage()" (click)="paged.fetchPreviousPage()">Prev Page</button>

    @for (post of paged.items(); track post?.id) {
      <p>{{ post.id }}: {{ post.title }}</p>
    }

    <button [disabled]="!paged.canFetchNextPage()" (click)="paged.fetchNextPage()">Next Page</button>
    <button (click)="paged.reset({ initialPage: 3 })">Reset to page 3</button>
    <button (click)="addPlusOnePage()">Add one page</button>
    <button (click)="execWherePostIdIs4()">Exec where post id is 4</button>
    <button (click)="execAll()">Exec all</button> -->
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [],
})
export class DynCompComponent {
  data = input.required<string>();
  destroy$ = createDestroy();

  myPostQuery1 = getPost(
    withArgs(() => ({ pathParams: { postId: 1 } })),
    withLogging({ logFn: (event) => console.log('EVENT on myPostQuery1', event) }),
  );
  myPostQuery2 = getPost(
    { key: 'myPostQuery2' },
    withArgs(() => ({ pathParams: { postId: 1 } })),
  );
  myPostQuery3 = getPost(
    withArgs(() => ({ pathParams: { postId: 2 } })),
    withPolling({ interval: 5000 }),
    withSuccessHandling({ handler: (data) => console.log('from 3', data) }),
  );

  // myUsers = getUsers();

  // plusOnePage = signal(1);
  // currentPostId = signal(5);
  // updateResponseData = signal(0);

  // myPost = getPost(
  //   withArgs(() => ({ pathParams: { postId: this.plusOnePage() } })),
  //   withResponseUpdate({
  //     updater: () => {
  //       const data = this.updateResponseData();

  //       if (data % 2 === 0) {
  //         return { title: 'Even', body: 'Even', id: data, userId: 1 };
  //       }

  //       return { title: 'Odd', body: 'Odd', id: data, userId: 1 };
  //     },
  //   }),
  //   // withPolling({ interval: 5000 }),
  // );

  // posts = getPosts(withAutoRefresh({ onSignalChanges: [this.plusOnePage] }));

  // gqlPosts = queryGqlPosts();
  // gqlPost = queryGqlPost(withArgs(() => ({ variables: { userId: 1 } })));

  // myPostList = createQueryStack({
  //   queryCreator: getPost,
  //   dependencies: () => ({ myDep: this.plusOnePage() }),
  //   args: ({ myDep }) => [
  //     { pathParams: { postId: this.currentPostId() * myDep } },
  //     { pathParams: { postId: this.currentPostId() * myDep + 1 } },
  //     { pathParams: { postId: this.currentPostId() * myDep + 2 } },
  //   ],
  //   transform: transformArrayResponse,
  //   append: true,
  //   // features: [
  //   //   withPolling({ interval: 5000 }),
  //   //   withSuccessHandling<GetPostQueryArgs>({ handler: (post) => console.log(post.title) }),
  //   // ],
  // });

  // paged = createPagedQueryStack({
  //   queryCreator: getPost,
  //   args: (page) => ({ pathParams: { postId: page + this.plusOnePage() } }),
  //   responseNormalizer: fakePaginationAdapter(),
  //   initialPage: 1,
  //   // features: [
  //   //   withPolling({ interval: 5000 }),
  //   //   withSuccessHandling<GetPostQueryArgs>({ handler: (post) => console.log(post.title) }),
  //   // ],
  // });

  // pagedRounds = createPagedQueryStack({
  //   queryCreator: getPublicTournamentRounds,
  //   args: (page) => ({ pathParams: { id: 'this.selectedTournamentId()' }, queryParams: { page } }),
  //   responseNormalizer: dynLikePaginationAdapter,
  //   features: [withPolling({ interval: 10000 })],
  // });

  // id = computed(() => this.myPostQuery1.response()?.id);

  // bearer = inject(authProviderConfig.token);

  constructor() {
    // effect(() => console.log(this.myPostList.response()));
    // effect(() => console.log(this.paged.items()));
    // this.gqlPosts.execute();
  }

  // execWherePostIdIs4() {
  //   this.paged.execute({ where: (item) => item.id === 4 });
  //   this.pagedRounds.execute({ where: (item) => item.id === '4' });
  // }

  // execAll() {
  //   this.paged.execute({ allowCache: true });
  // }

  // // login() {
  // //   this.bearer.login({ body: { password: 'TestTest20-', username: 'admin@dyncdx.dev' } });
  // // }

  // addPlusOnePage() {
  //   this.plusOnePage.update((page) => page + 1);
  // }

  // addPostQuery() {
  //   this.currentPostId.update((id) => id + 1);
  // }

  // updateResponse() {
  //   this.updateResponseData.update((data) => data + 1);
  // }

  // refreshToOriginal() {
  //   this.myPost.execute();
  // }
}

@Component({
  imports: [RouterOutlet, RouterLink, QueryDevtoolsComponent, QueryDirective, JsonPipe],
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  viewContainerRef = inject(ViewContainerRef);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  injector = inject(Injector);
  bearer = injectAuthProvider();
  renderer = injectRenderer();

  compRef: ComponentRef<DynCompComponent> | null = null;

  legacyGetPost = legacyGetPost.createSignal(legacyGetPost.prepare({ pathParams: { postId: 1 } }).execute());

  num = signal(50);

  animatedNumber = signalAnimatedNumber(this.num).play();

  constructor() {
    setTimeout(() => {
      this.renderer.setCssProperty(this.elementRef.nativeElement, '--space', '100px');
    }, 3000);

    applyHeadTitleBinding('Home');
    applyDescriptionBinding('This is the home page of the Ethlete Playground.');

    applyMetaBinding({ allowMultiple: true, name: 'keywords', content: 'app component' });

    const injector = inject(Injector);

    setTimeout(() => {
      this.legacyGetPost.set(
        legacyGetPost.prepare({ config: { destroyOnResponse: true }, pathParams: { postId: 2 }, injector }).execute(),
      );
    }, 1000);
  }

  doubleNum() {
    this.num.set(this.num() * 2);
    this.animatedNumber.play();
  }

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
