import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { QueryClient, QueryDirective, def, queryComputed, queryStateResponseSignal } from '@ethlete/query';
import { startWith } from 'rxjs';

const queryClient = new QueryClient({ baseRoute: `https://jsonplaceholder.typicode.com` });

interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

const getPosts = queryClient.get({
  route: `/posts`,
  types: {
    response: def<Post[]>(),
  },
});

const getPost = queryClient.get({
  route: (p) => `/posts/${p.id}`,
  types: {
    args: def<{ pathParams: { id: number } }>(),
    response: def<Post>(),
  },
});

@Component({
  selector: 'ethlete-query-signals',
  template: `
    <div>
      <label for="postCtrl">Post ID</label> <br />
      <input [formControl]="ctrl" id="postCtrl" />
    </div>

    <p>Post</p>
    <pre *etQuery="postQuery() as post">{{ post | json }}</pre>

    <p>Last Post</p>
    <pre *etQuery="lastPostQuery() as post">{{ post | json }}</pre>
    <br /><br />
    <button (click)="loadPostsAgain()">Load posts again</button>
    <button (click)="reExec()">Re exec</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, QueryDirective, JsonPipe],
})
export class QuerySignalsComponent {
  ctrl = new FormControl('1');

  postId = toSignal(this.ctrl.valueChanges.pipe(startWith(this.ctrl.value)));

  postsQuery = getPosts.createSignal();
  postsQuery2 = getPosts.createSignal();
  posts = queryStateResponseSignal(this.postsQuery, { cacheResponse: true });

  postQuery = queryComputed(() => {
    const postId = this.postId();

    if (postId === undefined || postId === null || postId === '') {
      return null;
    }

    return getPost.prepare({ pathParams: { id: +postId } }).execute({ skipCache: true });
  });

  lastPostQuery = queryComputed(() => {
    const posts = this.posts();

    if (!posts) return null;

    const lastPost = posts[posts.length - 1];

    if (!lastPost) return null;

    return getPost.prepare({ pathParams: { id: lastPost.id } }).execute({ skipCache: true });
  });

  constructor() {
    this.postsQuery.set(getPosts.prepare().execute({ skipCache: true }));
  }

  loadPostsAgain() {
    this.postsQuery2.set(getPosts.prepare().execute({ skipCache: true }));
  }

  reExec() {
    this.postsQuery2()?.execute({ skipCache: true });
  }
}
