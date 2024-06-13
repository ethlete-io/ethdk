import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
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
import {
  createGetQuery,
  createQueryClientConfig,
  provideQueryClient,
  withArgs,
  withPolling,
  withSuccessHandling,
} from './query/testing';

/**
 * DEMO BELOW
 */

const client = createQueryClientConfig({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  name: 'jsonplaceholder',
});

const getQuery = createGetQuery(client);

type GetPostQueryArgs = {
  response: {
    id: string;
    title: string;
    body: string;
  };
  pathParams: {
    postId: string;
  };
};

const getPost = getQuery<GetPostQueryArgs>({ route: (p) => `/posts/${p.postId}` });

@Component({
  selector: 'ethlete-dyn-comp',
  template: `<p>Data is: {{ data() }}</p> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DynCompComponent {
  data = input.required<string>();

  constructor() {
    effect(() => console.log(this.data()));
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
  providers: [provideQueryClient(client)],
})
export class AppComponent {
  viewContainerRef = inject(ViewContainerRef);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  compRef: ComponentRef<DynCompComponent> | null = null;

  myPostQuery1 = getPost(
    withArgs(() => ({ pathParams: { postId: '1' } })),
    withSuccessHandling({ handler: (data) => console.log('from 1', data) }),
  );
  myPostQuery3 = getPost(
    withArgs(() => ({ pathParams: { postId: '1' } })),
    withPolling({ interval: 10000 }),
    withSuccessHandling({ handler: (data) => console.log('from 3', data) }),
  );
  myPostQuery2 = getPost(
    { key: 'ddd' },
    withArgs(() => ({ pathParams: { postId: '1' } })),
  );

  id = computed(() => this.myPostQuery1.response()?.body);
  id2 = computed(() => this.myPostQuery2.response()?.body);

  renderComp() {
    const ref = this.viewContainerRef.createComponent(DynCompComponent);

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
