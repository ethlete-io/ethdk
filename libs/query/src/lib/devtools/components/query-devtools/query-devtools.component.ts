import { AsyncPipe, JsonPipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  TrackByFunction,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { createDestroy, nextFrame } from '@ethlete/core';
import { BehaviorSubject, map, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { AnyQuery } from '../../../query';
import { QUERY_CLIENT_DEVTOOLS_TOKEN, QueryClientDevtoolsOptions } from '../../utils';

type QueryDevtoolsSnapLayout = 'full' | 'left' | 'right' | 'bottom' | 'top';
type QueryListMode = 'live' | 'history';

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
  imports: [NgIf, NgFor, AsyncPipe, JsonPipe, ReactiveFormsModule, NgClass],
  hostDirectives: [],
})
export class QueryDevtoolsComponent {
  private readonly _cdr = inject(ChangeDetectorRef);
  protected readonly _destroy$ = createDestroy();

  protected readonly queryClientConfigs = inject(QUERY_CLIENT_DEVTOOLS_TOKEN);

  protected readonly isOpen = signal(false);
  protected readonly isTranslucent = signal(false);
  protected readonly snapLayout = signal<QueryDevtoolsSnapLayout>('full');
  protected readonly queryListMode = signal<QueryListMode>('live');

  protected showResponse = signal(false);
  protected showRawResponse = signal(false);

  protected selectedClientIdCtrl = new FormControl(0);

  protected readonly selectedClientId = toSignal(
    this.selectedClientIdCtrl.valueChanges.pipe(startWith(this.selectedClientIdCtrl.value)),
  );
  protected readonly selectedQueryId = signal<number | null>(null);

  protected readonly selectedClientConfig = computed(() => {
    if (this.queryClientConfigs.length === 1) {
      return this.queryClientConfigs[0];
    }

    const index = this.selectedClientId() ?? 0;

    return this.queryClientConfigs[index];
  });

  protected readonly queryStore = computed(() => {
    const config = this.selectedClientConfig();

    return config.client._store;
  });

  protected readonly queryStore$ = toObservable(this.queryStore);

  private readonly _queries$ = new BehaviorSubject<AnyQuery[]>([]);
  protected readonly queries = toSignal(this._queries$);

  protected readonly selectedQuery = computed(() => {
    const id = this.selectedQueryId();
    const mode = this.queryListMode();

    if (id === null || !mode) {
      return null;
    }

    if (mode === 'live') {
      return this.queries()?.find((q) => q._id === id) ?? null;
    }

    return this.queryHistory()?.find((q) => q._id === id) ?? null;
  });

  protected readonly queryHistory = signal<AnyQuery[]>([]);

  constructor() {
    this.selectedClientIdCtrl.valueChanges
      .pipe(
        tap(() => this.clearQueryHistory()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this.queryStore$
      .pipe(
        switchMap((s) =>
          s.storeChange$.pipe(
            startWith(''),
            map(() => s._store),
            tap((s) => this._queries$.next(Array.from(s.values()))),
            takeUntil(this._destroy$),
          ),
        ),
      )
      .subscribe();

    this._queries$
      .pipe(
        tap((queries) => {
          const currentHistory = this.queryHistory();

          if (!queries || !currentHistory) return;

          const currentHistoryClone = [...currentHistory];

          for (const query of queries) {
            if (!currentHistoryClone.includes(query)) {
              currentHistoryClone.unshift(query);
            }
          }

          currentHistoryClone.splice(50);

          this.queryHistory.set(currentHistoryClone);
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    effect(() => {
      const devtoolConfig = {
        isOpen: this.isOpen(),
        isTranslucent: this.isTranslucent(),
        snapLayout: this.snapLayout(),
        showResponse: this.showResponse(),
        showRawResponse: this.showRawResponse(),
        selectedClientId: this.selectedClientId(),
        selectedQueryPath: this.selectedQueryId(),
        queryListMode: this.queryListMode(),
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
      this.selectedClientIdCtrl.setValue(parsed.selectedClientId ?? 0);
      this.selectedQueryId.set(parsed.selectedQueryPath ?? null);
      this.queryListMode.set(parsed.queryListMode ?? 'live');
    }
  }

  protected trackByClient: TrackByFunction<QueryClientDevtoolsOptions> = (_, { client }) => client.config.baseRoute;
  protected trackByQuery: TrackByFunction<AnyQuery> = (_, { _id }) => _id;

  protected toggleOpen() {
    this.isOpen.set(!this.isOpen());
  }

  protected toggleTranslucent() {
    this.isTranslucent.set(!this.isTranslucent());
  }

  protected toggleShowResponse() {
    this.showResponse.set(!this.showResponse());

    nextFrame(() => {
      this._cdr.markForCheck();
    });
  }

  protected toggleShowRawResponse() {
    this.showRawResponse.set(!this.showRawResponse());
  }

  protected selectSnapLayout(layout: QueryDevtoolsSnapLayout) {
    this.snapLayout.set(layout);
  }

  protected selectQueryListMode(mode: QueryListMode) {
    this.queryListMode.set(mode);
  }

  protected selectQuery(query: AnyQuery) {
    this.selectedQueryId.set(query._id);
  }

  protected clearQueryHistory() {
    this.queryHistory.set([]);
  }
}
