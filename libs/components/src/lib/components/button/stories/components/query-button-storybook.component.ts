import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { QueryClient } from '@ethlete/query';
import { ButtonImports } from '../../..';

const client = new QueryClient({
  baseRoute: 'https://jsonplaceholder.typicode.com',
});

const getPosts = client.get({
  route: '/posts',
});

@Component({
  selector: 'et-sb-query-button',
  template: `
    <button [etQuery]="getPosts$ | async" (click)="load()" type="button" et-query-button>Query Button</button>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonImports, AsyncPipe],
})
export class StorybookQueryButtonComponent {
  getPosts$ = getPosts.behaviorSubject();

  load() {
    this.getPosts$.next(getPosts.prepare().execute({ skipCache: true }));
  }
}
