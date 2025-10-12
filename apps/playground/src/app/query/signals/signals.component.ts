import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, Injector, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ExperimentalQuery as E, queryComputed, QueryDirective, queryStateResponseSignal } from '@ethlete/query';
import { startWith } from 'rxjs';

type GetPostQueryArgs = {
  response: Post;
  pathParams: {
    postId: number;
  };
};

type GetPostsQueryArgs = {
  response: Post[];
};

type Post = {
  id: number;
  userId: number;
  title: string;
  body: string;
};

const placeholderClientConfig = E.createQueryClientConfig({
  name: 'jsonplaceholder',
  baseUrl: 'https://jsonplaceholder.typicode.com',
});

const createGetQuery = E.createGetQuery(placeholderClientConfig);

const getPosts = createGetQuery<GetPostsQueryArgs>(`/posts`, {
  reportProgress: true,
  responseType: 'blob',
  transferCache: null,
  withCredentials: true,
});
const getPost = createGetQuery<GetPostQueryArgs>((p) => `/posts/${p.postId}`);

const legacyGetPost = E.createLegacyQueryCreator({ creator: getPost });
const legacyGetPosts = E.createLegacyQueryCreator({ creator: getPosts });

@Component({
  selector: 'ethlete-query-signals',
  templateUrl: './signals.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, QueryDirective, JsonPipe],
  providers: [E.provideQueryClient(placeholderClientConfig)],
})
export class QuerySignalsComponent {
  private injector = inject(Injector);
  ctrl = new FormControl('1');

  postId = toSignal(this.ctrl.valueChanges.pipe(startWith(this.ctrl.value)));

  postsQuery = legacyGetPosts.createSignal();
  onePostQuery = legacyGetPosts.createSignal();
  postsQuery2 = legacyGetPosts.createSignal();
  posts = queryStateResponseSignal(this.postsQuery, { cacheResponse: true });

  postQuery = queryComputed(() => {
    const postId = this.postId();

    if (postId === undefined || postId === null || postId === '') {
      return null;
    }

    return legacyGetPost.prepare({ pathParams: { postId: +postId } }).execute();
  });

  lastPostQuery = queryComputed(() => {
    const posts = this.posts();

    if (!posts) return null;

    const lastPost = posts[posts.length - 1];

    if (!lastPost) return null;

    return legacyGetPost.prepare({ pathParams: { postId: lastPost.id } }).execute({ skipCache: true });
  });

  constructor() {
    this.postsQuery.set(legacyGetPosts.prepare({ injector: this.injector }).execute({ skipCache: true }));
  }

  loadPostsAgain() {
    this.postsQuery2.set(legacyGetPosts.prepare({ injector: this.injector }).execute({ skipCache: true }));
  }

  reExec() {
    this.postsQuery2()?.execute({ skipCache: true });
  }
}
