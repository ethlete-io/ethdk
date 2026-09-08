import { Component, inject, InjectionToken, Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { hostElement, query, queryAll, textOf } from '../../testing/driver-core';
import { NormalizedMatch } from '../../match';
import { BracketMatchNormalizer } from '../bracket-card-context';
import { BracketRoundsListComponent } from '../bracket-rounds-list.component';
import { BracketLayout } from '../bracket-layout';
import { BracketComponent } from '../bracket.component';
import { BracketRoundHeaderAlign } from '../bracket.config';
import { BracketMatchComponent } from '@ethlete/bracket';
import { BracketDataSource } from '../integrations';
import { doubleEliminationBracketLayout, singleEliminationBracketLayout } from '../layouts';

/** The default cards' minimum shape - shared so every bracket spec normalizes matches identically. */
export const testBracketMatchNormalizer: BracketMatchNormalizer = (match): NormalizedMatch => ({
  id: match.id,
  status: 'finished',
  startTime: null,
  home: { id: match.home?.id ?? 'h', name: 'Home', code: 'HOM', subtitle: null, emblem: null, seed: null },
  away: { id: match.away?.id ?? 'a', name: 'Away', code: 'AWY', subtitle: null, emblem: null, seed: null },
  homeScore: 2,
  awayScore: 1,
  resultKind: 'score',
  gameScores: null,
  winnerSide: 'home',
  label: null,
});

/** Answers for both single- and double-elimination sources - what the fixtures below draw with. */
export const testBracketLayouts = [singleEliminationBracketLayout(), doubleEliminationBracketLayout()];

export type BracketTestDriverOptions = {
  /** Which host to mount. @default 'bracket' */
  component?: 'bracket' | 'rounds-list';
  source: BracketDataSource<unknown, unknown>;
  layouts?: readonly BracketLayout[];
  /** @default {@link testBracketMatchNormalizer} */
  matchNormalizer?: BracketMatchNormalizer;
  focusedParticipantId?: string | null;
  disableJourneyHighlight?: boolean;
  selectedRoundId?: string | null;
  rowSpanRoundId?: string | null;
  focusRoundId?: string | null;
  focusInset?: number;
  thirdPlaceTopOffset?: number | null;
  finalRoundHeaderGap?: number | null;
  alignRoundHeaders?: BracketRoundHeaderAlign;
  matchComponent?: BracketMatchComponent<unknown, unknown>;
  providers?: Provider[];
};

const BRACKET_TEST_OPTIONS = new InjectionToken<BracketTestDriverOptions>('BRACKET_TEST_OPTIONS');

const TRANSLATE_PATTERN = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/;

const parseTranslate = (element: HTMLElement | null) => {
  const [, x, y] = TRANSLATE_PATTERN.exec(element?.style.transform ?? '') ?? [];

  return { x: Number.parseFloat(x ?? '0'), y: Number.parseFloat(y ?? '0') };
};

@Component({
  template: `
    @if (mode === 'rounds-list') {
      <et-bracket-rounds-list
        [source]="source()"
        [layouts]="layouts()"
        [matchNormalizer]="matchNormalizer"
        [selectedRoundId]="selectedRoundId()"
        [matchComponent]="matchComponent()"
      />
    } @else {
      <et-bracket
        [(focusedParticipantId)]="focusedParticipantId"
        [source]="source()"
        [layouts]="layouts()"
        [matchNormalizer]="matchNormalizer"
        [disableJourneyHighlight]="disableJourneyHighlight"
        [rowSpanRoundId]="rowSpanRoundId()"
        [focusRoundId]="focusRoundId()"
        [focusInset]="focusInset()"
        [thirdPlaceTopOffset]="thirdPlaceTopOffset()"
        [finalRoundHeaderGap]="finalRoundHeaderGap()"
        [alignRoundHeaders]="alignRoundHeaders()"
      />
    }
  `,
  imports: [BracketComponent, BracketRoundsListComponent],
})
class BracketTestHost {
  private readonly options = inject(BRACKET_TEST_OPTIONS);

  public readonly mode = this.options.component ?? 'bracket';
  public readonly source = signal(this.options.source);
  public readonly layouts = signal(this.options.layouts);
  public readonly focusedParticipantId = signal(this.options.focusedParticipantId ?? null);
  public readonly selectedRoundId = signal(this.options.selectedRoundId ?? null);
  public readonly rowSpanRoundId = signal(this.options.rowSpanRoundId ?? null);
  public readonly focusRoundId = signal(this.options.focusRoundId ?? null);
  public readonly focusInset = signal(this.options.focusInset);
  public readonly thirdPlaceTopOffset = signal(this.options.thirdPlaceTopOffset);
  public readonly finalRoundHeaderGap = signal(this.options.finalRoundHeaderGap);
  public readonly alignRoundHeaders = signal(this.options.alignRoundHeaders);
  public readonly matchComponent = signal(this.options.matchComponent);
  public readonly matchNormalizer = this.options.matchNormalizer ?? testBracketMatchNormalizer;
  public readonly disableJourneyHighlight = this.options.disableJourneyHighlight ?? false;
}

/**
 * Mounts `<et-bracket>` - or, with `component: 'rounds-list'`, `<et-bracket-rounds-list>` - behind a
 * shared normalizer, and adds the bracket vocabulary its specs need: the pinned journey
 * (`pin`, `activeMatchIds`, `cellFor`) and the rounds list's grouping (`sections`).
 */
export const bracketTestDriver = (options: BracketTestDriverOptions) => {
  // Lets a spec mount a second, differently-configured instance within the same test (a provider
  // override, a disabled feature) - `TestBed` otherwise refuses to reconfigure past the first mount.
  TestBed.resetTestingModule();

  const fixture = mountControl(BracketTestHost, [
    ...(options.providers ?? []),
    { provide: BRACKET_TEST_OPTIONS, useValue: options },
  ]);

  const host = fixture.componentInstance;

  return {
    fixture,
    host,
    element: () => hostElement(fixture),
    detectChanges: () => fixture.detectChanges(),

    pin: (participantId: string | null) => {
      host.focusedParticipantId.set(participantId);
      fixture.detectChanges();
    },

    cellFor: (matchId: string) => query(fixture, `[data-match-id="${matchId}"]`),

    /** Where a cell sits in the grid: its own translate plus the one of the round container around it. */
    positionOf: (matchId: string) => {
      const cell = query(fixture, `[data-match-id="${matchId}"]`);
      const round = cell?.closest<HTMLElement>('.et-bracket-round') ?? null;
      const cellOffset = parseTranslate(cell);
      const roundOffset = parseTranslate(round);

      return { x: cellOffset.x + roundOffset.x, y: cellOffset.y + roundOffset.y };
    },

    headerCells: () => queryAll(fixture, '.et-bracket-element--header'),

    /** Every connector, by the `d` attribute that draws it and the classes a journey lights it by. */
    edges: () =>
      queryAll(fixture, '.et-bracket-svg path').map((path) => ({
        d: path.getAttribute('d') ?? '',
        classes: path.getAttribute('class') ?? '',
      })),

    activeMatchIds: () =>
      queryAll(fixture, '.et-bracket-element--match.et-bracket-journey-active').map((el) =>
        el.getAttribute('data-match-id'),
      ),

    sections: () =>
      queryAll(fixture, '.et-bracket-rounds-list-section').map((section) => ({
        id: section.dataset['section'],
        name: textOf(section.querySelector<HTMLElement>('.et-bracket-rounds-list-section-name')),
      })),
  };
};

export type BracketTestDriver = ReturnType<typeof bracketTestDriver>;
