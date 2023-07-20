import { AsyncPipe, JsonPipe, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { createDestroy } from '@ethlete/core';
import { BehaviorSubject, Subject, map, startWith, takeUntil, tap } from 'rxjs';
import { AnyQuery } from '../../../query';
import { QUERY_CLIENT_DEVTOOLS_TOKEN, QueryClientDevtoolsOptions } from '../../utils';

type QueryDevtoolsSnapLayout = 'full' | 'left' | 'right' | 'bottom' | 'top';

@Component({
  selector: 'et-query-devtools',
  templateUrl: './query-devtools.component.html',
  styleUrls: ['./query-devtools.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  // eslint-disable-next-line @angular-eslint/no-host-metadata-property
  host: {
    class: 'et-query-devtools',
  },
  imports: [NgIf, NgFor, AsyncPipe, JsonPipe],
  hostDirectives: [],
})
export class QueryDevtoolsComponent {
  protected readonly _destroy$ = createDestroy();

  protected readonly queryClientConfigs = inject(QUERY_CLIENT_DEVTOOLS_TOKEN);

  protected readonly isOpen = signal(false);
  protected readonly isTranslucent = signal(false);
  protected readonly snapLayout = signal<QueryDevtoolsSnapLayout>('full');

  protected showResponse = signal(false);
  protected showRawResponse = signal(false);

  protected readonly selectedClientId = signal(0);
  protected readonly selectedQueryPath = signal<string | null>(null);

  protected readonly selectedClientConfig = computed(() => {
    if (this.queryClientConfigs.length === 1) {
      return this.queryClientConfigs[0];
    }

    const index = this.selectedClientId();

    return this.queryClientConfigs[index];
  });

  protected readonly queryStore = computed(() => {
    const config = this.selectedClientConfig();

    return config.client._store;
  });

  private readonly _queries$ = new BehaviorSubject<AnyQuery[]>([]);
  protected readonly queries = toSignal(this._queries$);

  protected readonly selectedQuery = computed(() => {
    const path = this.selectedQueryPath();

    if (!path) {
      return null;
    }

    return this.queries()?.find((q) => q._routeWithParams === path) ?? null;
  });

  constructor() {
    const change$ = new Subject<boolean>();

    effect(
      () => {
        change$.next(true);

        const store = this.queryStore();

        store.storeChange$
          .pipe(
            startWith(''),
            map(() => store._store),
            tap((s) => this._queries$.next(Array.from(s.values()))),
            takeUntil(change$),
            takeUntil(this._destroy$),
          )
          .subscribe();
      },
      { allowSignalWrites: true },
    );

    effect(() => {
      const devtoolConfig = {
        isOpen: this.isOpen(),
        isTranslucent: this.isTranslucent(),
        snapLayout: this.snapLayout(),
        showResponse: this.showResponse(),
        showRawResponse: this.showRawResponse(),
        selectedClientId: this.selectedClientId(),
        selectedQueryPath: this.selectedQueryPath(),
      };

      window.localStorage.setItem('ethlete:query:devtools', JSON.stringify(devtoolConfig));
    });

    const initialConfig = window.localStorage.getItem('ethlete:query:devtools');

    if (initialConfig) {
      const parsed = JSON.parse(initialConfig);

      this.isOpen.set(parsed.isOpen ?? false);
      this.isTranslucent.set(parsed.isTranslucent ?? false);
      this.snapLayout.set(parsed.snapLayout ?? 'full');
      this.showResponse.set(parsed.showResponse ?? false);
      this.showRawResponse.set(parsed.showRawResponse ?? false);
      this.selectedClientId.set(parsed.selectedClientId ?? 0);
      this.selectedQueryPath.set(parsed.selectedQueryPath ?? null);
    }
  }

  protected trackByClient: TrackByFunction<QueryClientDevtoolsOptions> = (_, { client }) => client.config.baseRoute;
  protected trackByQuery: TrackByFunction<AnyQuery> = (_, { _routeWithParams }) => _routeWithParams;

  protected toggleOpen() {
    this.isOpen.set(!this.isOpen());
  }

  protected toggleTranslucent() {
    this.isTranslucent.set(!this.isTranslucent());
  }

  protected toggleShowResponse() {
    this.showResponse.set(!this.showResponse());
  }

  protected toggleShowRawResponse() {
    this.showRawResponse.set(!this.showRawResponse());
  }

  protected selectSnapLayout(layout: QueryDevtoolsSnapLayout) {
    this.snapLayout.set(layout);
  }

  protected selectClient(clientId: number) {
    this.selectedClientId.set(clientId);
  }

  protected selectQuery(query: AnyQuery) {
    this.selectedQueryPath.set(query._routeWithParams);
  }
}
