import {
  Component,
  computed,
  effect,
  inject,
  InjectionToken,
  input,
  OnDestroy,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, race, Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { queryComputed, queryStateResponseSignal } from '../index';
import {
  createLegacyClient,
  LEGACY_CLIENT_KINDS,
  LegacyClientCreator,
  LegacyClientKind,
  Scenario,
  useScenario,
} from './harness';

type GetMatchesArgs = {
  queryParams: { round: string; sortBy: string; sortOrder: string; resultsPerPage: number };
};

const GET_MATCHES = new InjectionToken<LegacyClientCreator<GetMatchesArgs>>('GET_MATCHES');
const SELECTED_ROUND = new InjectionToken<WritableSignal<string | null>>('SELECTED_ROUND');

@Component({ selector: 'vbl-match-list', template: '' })
class MatchListComponent implements OnDestroy {
  private readonly getMatchesResults = inject(GET_MATCHES);
  private readonly selectedRound = inject(SELECTED_ROUND);
  private readonly destroy$ = new Subject<void>();

  readonly roundId = input.required<string | null>();

  readonly getMatchesQuery = queryComputed(() => {
    const roundId = this.roundId();
    if (!roundId) return null;

    return this.getMatchesResults
      .prepare({
        queryParams: { round: roundId, sortBy: 'number', sortOrder: 'asc', resultsPerPage: 100 },
      })
      .execute();
  });
  readonly matchesResponse = queryStateResponseSignal(this.getMatchesQuery, { cacheResponse: true });

  readonly isActiveRound = computed(() => this.selectedRound() === this.roundId());
  readonly isActiveRound$ = toObservable(this.isActiveRound);

  constructor() {
    effect(() => {
      const isActive = this.isActiveRound();

      untracked(() => {
        if (isActive) {
          this.getMatchesQuery()?.poll({
            interval: 10000,
            takeUntil: race([this.isActiveRound$.pipe(filter((a) => a === false)), this.destroy$]),
          });
        }
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
  }
}

const VBL_CLIENT_REQUEST_OPTIONS = {
  autoRefreshQueriesOnWindowFocus: false,
  enableSmartPolling: false,
  cacheAdapter: () => 0,
};

const createVblClient = (s: Scenario, kind: LegacyClientKind) =>
  createLegacyClient(s, kind, { config: { request: VBL_CLIENT_REQUEST_OPTIONS } });

const rounds = (s: Scenario) => s.api.requests.map((request) => request.query['round']);

describe.each(LEGACY_CLIENT_KINDS)(
  'legacy client with smart polling, focus refresh and caching switched off on the %s client',
  (kind) => {
    const scenario = useScenario({ clientOptions: { cacheAdapter: () => 0 } });

    const setup = (roundId: string, selected: string | null) => {
      const s = scenario();
      const legacy = createVblClient(s, kind);
      s.api.on('GET', '/matches', ({ query }) => ({
        body: { items: [`match of ${query['round']}`] },
        headers: { 'cache-control': 'max-age=600' },
        delay: 50,
      }));

      const selectedRound = signal(selected);
      const c = s.consumer([
        { provide: GET_MATCHES, useValue: legacy.get<GetMatchesArgs>('/matches') },
        { provide: SELECTED_ROUND, useValue: selectedRound },
      ]);
      const ref = s.mount(MatchListComponent, c.injector, { inputs: { roundId } });

      return { s, legacy, c, ref, list: () => ref.instance, selectedRound };
    };

    it('keeps polling in a blurred window and refreshes nothing on focus', () => {
      const { s, legacy, c, ref, list, selectedRound } = setup('r1', 'r1');

      s.tick(1000);
      expect(rounds(s)).toEqual(['r1']);

      s.tick(10_000);
      expect(rounds(s)).toHaveLength(2);

      window.dispatchEvent(new Event('blur'));
      s.tick(60_000);

      expect(rounds(s)).toHaveLength(8);
      expect(list().getMatchesQuery()?.isPolling).toBe(true);

      window.dispatchEvent(new Event('focus'));
      s.tick(1);
      expect(rounds(s)).toHaveLength(8);

      s.tick(10_000);
      expect(rounds(s)).toHaveLength(9);

      selectedRound.set('r2');
      s.tick(60_000);

      expect(rounds(s)).toHaveLength(9);
      expect(list().getMatchesQuery()?.isPolling).toBe(false);
      expect(list().matchesResponse()).toEqual({ items: ['match of r1'] });

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('requests a round again on every revisit and keeps the last response while it loads', () => {
      const { s, legacy, c, ref, list } = setup('r1', null);

      s.tick(1000);

      for (const next of ['r2', 'r3', 'r1']) {
        ref.setInput('roundId', next);
        s.tick(10);

        expect(list().matchesResponse()).not.toBeNull();

        s.tick(1000);
        expect(list().matchesResponse()).toEqual({ items: [`match of ${next}`] });
      }

      expect(rounds(s)).toEqual(['r1', 'r2', 'r3', 'r1']);
      expect(legacy.liveQueries()).toEqual([list().getMatchesQuery()]);

      ref.destroy();
      c.destroy();
      legacy.destroy();
    });

    it('fetches again after a remount', () => {
      const { s, legacy, c, ref } = setup('r1', null);

      s.tick(1000);
      ref.destroy();
      s.tick(1000);

      const again = s.mount(MatchListComponent, c.injector, { inputs: { roundId: 'r1' } });
      s.tick(1000);
      expect(again.instance.matchesResponse()).toEqual({ items: ['match of r1'] });
      expect(rounds(s)).toEqual(['r1', 'r1']);

      again.destroy();
      c.destroy();
      legacy.destroy();
    });
  },
);
