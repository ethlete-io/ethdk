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
    <button
      [etQuery]="getPosts$ | async"
      [disabled]="disabled"
      [type]="type"
      [pressed]="pressed"
      (click)="load()"
      et-query-button
    >
      Query Button
    </button>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonImports, AsyncPipe],
})
export class StorybookQueryButtonComponent {
  getPosts$ = getPosts.behaviorSubject();
  disabled = false;
  pressed = false;
  type: 'button' | 'submit' | 'reset' | 'menu' = 'button';

  load() {
    this.getPosts$.next(getPosts.prepare().execute({ skipCache: true }));
  }
}
