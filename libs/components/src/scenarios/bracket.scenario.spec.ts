import { Component, computed, inject, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BRACKET_CARD_CONTEXT,
  BRACKET_DEFAULTS,
  BRACKET_DENSITY,
  BRACKET_DENSITY_PRESETS,
  BRACKET_ERROR_CODES,
  BRACKET_IMPORTS,
  BRACKET_LABELS,
  BRACKET_ROUND_HEADER_ALIGN,
  BracketComponent,
  BracketDefaultContinueComponent,
  BracketDefaultFinalMatchComponent,
  BracketDefaultMatchComponent,
  BracketDefaultRoundHeaderComponent,
  BracketParticipantsComponent,
  BracketLayout,
  BracketMatch,
  BracketRound,
  BracketRoundSwissGroup,
  createNormalizedBracketMatch,
  DEFAULT_BRACKET_LABELS,
  EthleteBracketMatchInput,
  EthleteMatchInput,
  EthleteRoundWithMatchesInput,
  generateBracketDataForEthlete,
  injectBracketConfig,
  injectBracketLabels,
  normalizeEthleteBracketMatch,
  provideBracketConfig,
  provideBracketLabels,
  singleEliminationBracketLayout,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

type TeamMatch = EthleteBracketMatchInput & EthleteMatchInput;

const team = (id: string) => ({
  id,
  name: `Team ${id.slice(-1).toUpperCase()}`,
  code: id.slice(-1).toUpperCase(),
  emblem: null,
});

const match = (
  id: string,
  home: string | null,
  away: string | null,
  winningSide: 'home' | 'away' | null,
): TeamMatch => ({
  id,
  home: home ? team(home) : null,
  away: away ? team(away) : null,
  winningSide,
  status: winningSide ? 'published' : 'preparing',
  matchType: 'single_elimination',
  startTime: null,
  homeScore: winningSide ? { score: winningSide === 'home' ? 2 : 0 } : null,
  awayScore: winningSide ? { score: winningSide === 'away' ? 2 : 0 } : null,
  games: [],
});

const stage = (
  finalWinner: 'home' | 'away' | null,
): EthleteRoundWithMatchesInput<{ id: string; name: string | null; type: 'normal' | 'final' }, TeamMatch>[] => [
  {
    round: { id: 'semis', name: 'Semi finals', type: 'normal' },
    matches: [match('semi-1', 'team-a', 'team-b', 'home'), match('semi-2', 'team-c', 'team-d', 'away')],
  },
  {
    round: { id: 'final', name: null, type: 'final' },
    matches: [match('final-1', 'team-a', 'team-d', finalWinner)],
  },
];

const LAYOUTS = [singleEliminationBracketLayout()];

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

@Component({
  selector: 'et-scenario-bracket-page',
  imports: [BracketComponent, BracketParticipantsComponent],
  providers: [
    { provide: BRACKET_LABELS, useValue: { participantsLegend: 'Teams' } },
    provideBracketConfig({
      layouts: LAYOUTS,
      matchNormalizer: normalizeEthleteBracketMatch,
      roundHeaderComponent: BracketDefaultRoundHeaderComponent,
      matchComponent: BracketDefaultMatchComponent,
      finalMatchComponent: BracketDefaultFinalMatchComponent,
      continueComponent: BracketDefaultContinueComponent,
    }),
  ],
  template: `
    <et-bracket-participants [(focusedParticipantId)]="focusedTeamId" [participants]="teams" />
    <et-bracket
      [(focusedParticipantId)]="focusedTeamId"
      [source]="source()"
      [roundHeaderLevel]="2"
      [alignRoundHeaders]="align()"
      [density]="density()"
      [columnWidth]="columnWidth()"
    />
  `,
})
class BracketPageComponent {
  finalWinner = signal<'home' | 'away' | null>(null);
  source = computed(() => generateBracketDataForEthlete(stage(this.finalWinner())));
  focusedTeamId = signal<string | null>(null);
  align = signal<'start' | 'center' | undefined>(undefined);
  density = signal<'default' | 'compact' | undefined>(undefined);
  columnWidth = signal<number | undefined>(undefined);
  teams = ['team-a', 'team-b', 'team-c', 'team-d'].map((id) => ({ id, name: team(id).name }));
}

@Component({
  selector: 'et-scenario-bracket-no-normalizer',
  imports: [BracketComponent],
  template: `<et-bracket [source]="source" [layouts]="layouts" />`,
})
class BracketWithoutNormalizerComponent {
  source = generateBracketDataForEthlete(stage('home'));
  layouts = LAYOUTS;
}

@Component({
  selector: 'et-scenario-bracket-unregistered',
  imports: [BracketComponent],
  template: `<et-bracket [source]="source" [layouts]="layouts" />`,
})
class BracketUnregisteredLayoutComponent {
  source = generateBracketDataForEthlete(stage('home'));
  layouts: BracketLayout[] = [];
}

@Component({
  selector: 'et-scenario-linked-card',
  template: `<a [attr.href]="'/matches/' + bracketMatch().id" class="scenario-card">{{ label() }}</a>`,
})
class LinkedMatchCardComponent {
  context = inject(BRACKET_CARD_CONTEXT);

  bracketRound = input.required<BracketRound<unknown, TeamMatch>>();
  bracketMatch = input.required<BracketMatch<unknown, TeamMatch>>();
  bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<unknown, TeamMatch> | null>();

  normalized = createNormalizedBracketMatch(this.bracketMatch);
  label = computed(() => `${this.normalized()?.home?.code} v ${this.normalized()?.away?.code}`);
}

@Component({
  selector: 'et-scenario-bracket-custom-cards',
  imports: [BRACKET_IMPORTS],
  providers: [
    provideBracketLabels({ roundMatchCount: (matches) => `${matches} Spiele` }),
    provideBracketConfig({ layouts: LAYOUTS, columnWidth: 180, roundHeaderLevel: 4 }),
  ],
  template: `
    <et-bracket
      [source]="source"
      [matchComponent]="card"
      [finalMatchComponent]="card"
      [matchNormalizer]="normalizer"
      showContinueElement
    />
  `,
})
class BracketCustomCardsComponent {
  config = injectBracketConfig();
  labels = injectBracketLabels();
  source = generateBracketDataForEthlete(stage('home'));
  card = LinkedMatchCardComponent;
  normalizer = normalizeEthleteBracketMatch;
}

describe('bracket scenarios', () => {
  const scenario = useScenario();

  it('renders an Ethlete stage with the default header, match and final cards', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketPageComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(host.querySelector('.et-bracket')?.classList.contains('et-bracket--single-elimination')).toBe(true);

    const headers = Array.from(host.querySelectorAll('et-bracket-default-round-header'));

    expect(headers.map((header) => text(header.querySelector('.et-bracket-default-round-header-name')))).toEqual([
      'Semi finals',
      'final',
    ]);
    expect(headers.map((header) => text(header.querySelector('.et-bracket-default-round-header-count')))).toEqual([
      '2 matches',
      '1 match',
    ]);
    expect(headers.every((header) => header.getAttribute('role') === 'heading')).toBe(true);
    expect(headers[0]?.getAttribute('aria-level')).toBe('2');

    const cells = Array.from(host.querySelectorAll<HTMLElement>('.et-bracket-element--match'));

    expect(cells.map((cell) => cell.dataset['matchId'])).toEqual(['semi-1', 'semi-2', 'final-1']);
    expect(host.querySelectorAll('et-bracket-default-match et-match-card')).toHaveLength(2);
    expect(text(host.querySelector('[data-match-id="semi-1"]'))).toContain('A');

    const finalCard = host.querySelector('et-bracket-default-final-match');

    expect(text(finalCard?.querySelector('.et-bracket-final-round'))).toBe('final');
    expect(text(finalCard?.querySelector('.et-bracket-final-champion'))).toBe(DEFAULT_BRACKET_LABELS.championPending);
    expect(finalCard?.hasAttribute('data-decided')).toBe(false);

    fixture.componentInstance.finalWinner.set('away');
    s.tick();

    expect(text(finalCard?.querySelector('.et-bracket-final-champion'))).toBe('Champion: Team D');
    expect(finalCard?.hasAttribute('data-decided')).toBe(true);
    expect(host.querySelectorAll('.et-bracket-svg path').length).toBeGreaterThanOrEqual(2);
  });

  it('pins a journey from the participants legend and drops it on Escape', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketPageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;

    s.tick();
    s.flush();

    const legend = host.querySelector('et-bracket-participants');
    const toggles = Array.from(host.querySelectorAll<HTMLButtonElement>('.et-bracket-participants-toggle'));
    const active = () =>
      Array.from(host.querySelectorAll<HTMLElement>('.et-bracket-element--match.et-bracket-journey-active')).map(
        (cell) => cell.dataset['matchId'],
      );

    expect(legend?.getAttribute('role')).toBe('group');
    expect(legend?.getAttribute('aria-label')).toBe('Teams');
    expect(toggles.map(text)).toEqual(['Team A', 'Team B', 'Team C', 'Team D']);

    toggles[3]?.click();
    s.tick();

    expect(page.focusedTeamId()).toBe('team-d');
    expect(toggles[3]?.getAttribute('aria-pressed')).toBe('true');
    expect(active()).toEqual(['semi-2', 'final-1']);

    toggles[0]?.click();
    s.tick();

    expect(page.focusedTeamId()).toBe('team-a');
    expect(active()).toEqual(['semi-1', 'final-1']);

    s.keydown('Escape', host.querySelector('et-bracket') ?? undefined);
    s.tick();

    expect(page.focusedTeamId()).toBeNull();
    expect(active()).toEqual([]);
    expect(toggles[0]?.getAttribute('aria-pressed')).toBe('false');

    toggles[1]?.click();
    s.tick();
    toggles[1]?.click();
    s.tick();

    expect(page.focusedTeamId()).toBeNull();
  });

  it('resolves density, inputs and header alignment into the drawn geometry', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketPageComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;
    const cellWidth = () => host.querySelector<HTMLElement>('[data-match-id="semi-1"]')?.style.width;

    s.tick();
    s.flush();

    expect(cellWidth()).toBe(`${BRACKET_DEFAULTS.columnWidth}px`);
    expect(host.querySelector('.et-bracket-element--header')?.getAttribute('data-align')).toBe(
      BRACKET_ROUND_HEADER_ALIGN.START,
    );

    page.density.set(BRACKET_DENSITY.COMPACT);
    page.align.set(BRACKET_ROUND_HEADER_ALIGN.CENTER);
    s.tick();

    expect(cellWidth()).toBe(`${BRACKET_DENSITY_PRESETS.compact.columnWidth}px`);
    expect(host.querySelector('.et-bracket-element--header')?.getAttribute('data-align')).toBe('center');

    page.columnWidth.set(200);
    s.tick();

    expect(cellWidth()).toBe('200px');
  });

  it('swaps in custom cards, localized labels and config defaults, and draws the continue cell', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketCustomCardsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const page = fixture.componentInstance;

    s.tick();
    s.flush();

    expect(page.config.columnWidth).toBe(180);
    expect(page.labels().roundMatchCount(3)).toBe('3 Spiele');
    expect(page.labels().slotBye).toBe(DEFAULT_BRACKET_LABELS.slotBye);

    const cards = Array.from(host.querySelectorAll<HTMLAnchorElement>('.scenario-card'));

    expect(cards.map((card) => [card.getAttribute('href'), text(card)])).toEqual([
      ['/matches/semi-1', 'A v B'],
      ['/matches/semi-2', 'C v D'],
      ['/matches/final-1', 'A v D'],
    ]);
    expect(host.querySelector('et-bracket-default-match')).toBeNull();
    expect(host.querySelector<HTMLElement>('[data-match-id="semi-1"]')?.style.width).toBe('180px');

    const continueCard = host.querySelector('et-bracket-default-continue');

    expect(continueCard?.getAttribute('aria-label')).toBe('1 winner advances to the next stage');
    expect(text(continueCard)).toBe('1 winner advances');

    const headers = Array.from(host.querySelectorAll('et-bracket-default-round-header'));

    expect(text(headers[0]?.querySelector('.et-bracket-default-round-header-count'))).toBe('2 Spiele');
    expect(headers[0]?.getAttribute('aria-level')).toBe('4');

    const cardContext = fixture.debugElement.query((el) => el.componentInstance instanceof LinkedMatchCardComponent)
      .componentInstance as LinkedMatchCardComponent;

    expect(cardContext.context.resolvedRoundHeaderLevel()).toBe(4);
    expect(cardContext.context.resolvedMatchNormalizer()).toBe(normalizeEthleteBracketMatch);
  });

  it('throws ET3412 naming the missing normalizer when the default cards have none', () => {
    const s = scenario();

    TestBed.createComponent(BracketWithoutNormalizerComponent);
    s.tick();
    s.flush();

    const handled = s.errors.filter((entry) => entry.source === 'ErrorHandler').map((entry) => String(entry.error));

    expect(handled.length).toBeGreaterThan(0);
    expect(handled.every((message) => message.includes(`ET${BRACKET_ERROR_CODES.MISSING_MATCH_NORMALIZER}`))).toBe(
      true,
    );
    expect(handled[0]).toContain('provideBracketConfig({ matchNormalizer');
    s.allow('errors', 'each default card reports the missing normalizer');
  });

  it('throws ET3413 when no registered layout draws the source mode', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BracketUnregisteredLayoutComponent);

    expect(() => fixture.detectChanges()).toThrow(new RegExp(`${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}`));
    s.allow('errors', 'the failed first render is the behavior under test');
  });
});
