import { Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { format } from 'date-fns';
import {
  DEFAULT_MATCH_CARD_START_TIME_FORMAT,
  DEFAULT_MATCH_LABELS,
  EthleteMatchInput,
  EthleteParticipantInput,
  injectMatchLabels,
  MATCH_CARD_IMPORTS,
  MATCH_CARD_SIZES,
  MATCH_CARD_TOKEN,
  MATCH_ERROR_CODES,
  MATCH_LABELS,
  MATCH_PARTICIPANT_IMPORTS,
  MatchCardComponent,
  MatchCardDirective,
  MatchCardGameScoresDirective,
  MatchCardMetaDirective,
  MatchCardScoreDirective,
  MatchCardSize,
  MatchLabels,
  MatchParticipantComponent,
  MatchScoreChange,
  MatchScoreComponent,
  matchParticipantDisplayName,
  NormalizedMatch,
  NormalizedMatchParticipant,
  normalizeEthleteMatch,
  normalizeEthleteMatchStatus,
  normalizeEthleteMedia,
  normalizeEthleteParticipant,
  provideMatchLabels,
  resolveNormalizedMatchSideState,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
  { name: 'calm', primary: swatch('30 160 90') },
];

const code = (value: number) => `ET${value}`;

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const team = (id: 'team-a' | 'team-b', extra: Partial<EthleteParticipantInput> = {}): EthleteParticipantInput => ({
  id,
  name: id === 'team-a' ? 'Team A' : 'Team B',
  code: id === 'team-a' ? 'TMA' : 'TMB',
  emblem: null,
  ...extra,
});

const ethleteMatch = (overrides: Partial<EthleteMatchInput> = {}): EthleteMatchInput => ({
  id: 'match-1',
  status: 'started',
  startTime: '2026-09-26T18:30:00.000Z',
  home: team('team-a'),
  away: team('team-b'),
  homeScore: { score: 1 },
  awayScore: { score: 0 },
  games: [
    { matchGameNumber: 2, homeScore: { score: 9 }, awayScore: { score: 13 } },
    { matchGameNumber: 1, homeScore: { score: 13 }, awayScore: { score: 11 } },
    { matchGameNumber: 3, homeScore: null, awayScore: null },
  ],
  winningSide: null,
  matchNumber: 3,
  ...overrides,
});

@Component({
  selector: 'et-scenario-live-match',
  imports: [MatchCardComponent],
  template: `
    <a
      [match]="match()"
      [size]="size()"
      (scoreChange)="changes.push($event)"
      class="card"
      href="/matches/match-1"
      et-match-card
      showSeeds
    ></a>
  `,
})
class LiveMatchComponent {
  source = signal(ethleteMatch());
  size = signal<MatchCardSize>(MATCH_CARD_SIZES.AUTO);
  changes: MatchScoreChange[] = [];

  match = () => normalizeEthleteMatch(this.source());
}

@Component({
  selector: 'et-scenario-fixture-list',
  imports: [MatchCardComponent],
  providers: [provideMatchLabels({ tbd: 'Offen', versus: 'gegen' })],
  template: `
    <et-match-card [match]="scheduled" [startTimeFormat]="timeFormat()" class="scheduled" />
    <et-match-card [match]="outcome" class="outcome" size="compact" />
    <et-match-card [match]="points" [labels]="pointsLabels" class="points" />
    <et-match-card [match]="live" class="live" liveColor="calm" />
  `,
})
class FixtureListComponent {
  labels = injectMatchLabels();
  timeFormat = signal<string | null>(null);
  scheduled: NormalizedMatch = {
    ...normalizeEthleteMatch(ethleteMatch({ status: 'preparing', home: null, homeScore: null, awayScore: null })),
    gameScores: null,
    label: null,
  };
  outcome: NormalizedMatch = {
    ...normalizeEthleteMatch(ethleteMatch({ status: 'finished', winningSide: 'away' })),
    resultKind: 'outcome',
    gameScores: null,
  };
  points: NormalizedMatch = {
    ...normalizeEthleteMatch(ethleteMatch({ status: 'published', homeScore: { score: 3 }, awayScore: { score: 0 } })),
    resultKind: 'points',
    winnerSide: 'home',
    label: 'Group A',
  };
  live: NormalizedMatch = normalizeEthleteMatch(ethleteMatch({ games: [] }));
  pointsLabels: Partial<MatchLabels> = { finished: 'Done', gameScores: 'Maps' };
}

@Component({
  selector: 'et-scenario-winner-flag',
  template: `<span class="winner-flag">{{ card.winnerName() ?? 'open' }}</span>`,
})
class WinnerFlagComponent {
  card = inject(MATCH_CARD_TOKEN);
}

@Component({
  selector: 'et-scenario-own-card',
  imports: [MATCH_CARD_IMPORTS, WinnerFlagComponent],
  providers: [{ provide: MATCH_LABELS, useValue: { scoreSeparator: '-', gameScores: 'Karten' } }],
  template: `
    <button #card="etMatchCard" [match]="match()" class="own-card" etMatchCard type="button">
      <span class="own-meta" etMatchCardMeta>{{ card.formattedStartTime() }}</span>
      <span class="own-home">{{ card.homeName() }}</span>
      <et-match-score [value]="'' + card.match().homeScore" [animate]="card.animatesScoreChanges()" />
      <span class="own-away">{{ card.awayName() }}</span>
      <span class="own-score" etMatchCardScore>{{ card.result() }}</span>
      <ul class="own-games" etMatchCardGameScores>
        @for (game of card.gameScores() ?? []; track $index) {
          <li>{{ card.gameScoreText(game) }}</li>
        }
      </ul>
      <et-scenario-winner-flag />
    </button>
  `,
})
class OwnCardComponent {
  labels = injectMatchLabels();
  match = signal(normalizeEthleteMatch(ethleteMatch({ status: 'finished', winningSide: 'home' })));
  card = viewChild.required(MatchCardDirective);
}

@Component({
  selector: 'et-scenario-roster',
  imports: [MATCH_PARTICIPANT_IMPORTS],
  template: `
    <button [participant]="seeded" class="player" et-match-participant showSeed type="button"></button>
    <et-match-participant [participant]="seeded" class="compact" compact />
    <et-match-participant [participant]="null" class="tbd" />
    <et-match-participant [participant]="null" class="pending" loading />
  `,
})
class RosterComponent {
  seeded: NormalizedMatchParticipant = {
    ...normalizeEthleteParticipant(
      team('team-a', { gamertag: 'ace', emblem: { original: null, path: '/media/team-a.png' } }),
    ),
    seed: 3,
    subtitle: 'Club A',
  };
}

@Component({
  selector: 'et-scenario-stray-score',
  imports: [MatchCardScoreDirective, MatchCardMetaDirective, MatchCardGameScoresDirective],
  template: `
    <span etMatchCardScore>1 : 0</span>
    <span etMatchCardMeta>Match 3</span>
    <ol etMatchCardGameScores></ol>
  `,
})
class StrayScoreComponent {}

const takeErrorContext = (s: Scenario) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  return s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined;
};

describe('match scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('draws a live Ethlete match as one named link and rolls a new score in', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LiveMatchComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const card = host.querySelector('.card');

    expect(card?.getAttribute('aria-label')).toBe('Match 3: Team A vs. Team B, 1 : 0, Live');
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.hasAttribute('data-interactive')).toBe(true);
    expect(card?.getAttribute('data-status')).toBe('live');
    expect(card?.getAttribute('data-size')).toBe('auto');
    expect(card?.getAttribute('data-result-kind')).toBe('score');
    expect(card?.querySelector('.et-match-card-meta')?.getAttribute('aria-hidden')).toBe('true');
    expect(text(card?.querySelector('.et-match-card-label'))).toBe('Match 3');
    expect(text(card?.querySelector('.et-match-card-live'))).toBe(DEFAULT_MATCH_LABELS.live);
    expect(card?.querySelector('.et-match-card-live')?.classList).toContain('et-color--alert');
    expect(card?.querySelector('.et-match-card-time')).toBeNull();

    const sides = Array.from(card?.querySelectorAll('.et-match-card-side') ?? []);

    expect(sides.map((side) => side.getAttribute('data-participant-id'))).toEqual(['team-a', 'team-b']);
    expect(sides.map((side) => text(side.querySelector('.et-match-participant-name')))).toEqual(['Team A', 'Team B']);
    expect(sides.map((side) => text(side.querySelector('et-match-score')))).toEqual(['1', '0']);
    expect(sides[0]?.querySelector('et-match-score')?.getAttribute('aria-hidden')).toBe('true');

    const games = card?.querySelector('.et-match-card-games');

    expect(games?.getAttribute('role')).toBe('list');
    expect(games?.getAttribute('aria-label')).toBe('Games');
    expect(Array.from(games?.querySelectorAll('li') ?? []).map((li) => li.getAttribute('aria-label'))).toEqual([
      'Game 1: 13 : 11',
      'Game 2: 9 : 13',
    ]);

    const announcement = card?.querySelector('.et-match-card-announcement');

    expect(announcement?.getAttribute('aria-live')).toBe('polite');
    expect(announcement?.getAttribute('aria-atomic')).toBe('true');
    expect(text(announcement)).toBe('1 : 0');
    expect(page.changes).toEqual([]);

    page.source.update((match) => ({ ...match, homeScore: { score: 2 } }));
    s.tick();

    expect(page.changes).toEqual([{ side: 'home', from: 1, to: 2, delta: 1 }]);
    expect(text(announcement)).toBe('2 : 0');

    const homeScore = sides[0]?.querySelector('et-match-score');
    const rolling = Array.from(homeScore?.querySelectorAll('.et-match-score-digit') ?? []);

    expect(rolling.map((digit) => [digit.getAttribute('data-state'), text(digit)])).toEqual([
      ['out', '1'],
      ['in', '2'],
    ]);
    expect(homeScore?.querySelector('.et-match-score-flash')).not.toBeNull();

    rolling[1]?.dispatchEvent(new Event('animationend'));
    s.tick();

    expect(
      Array.from(homeScore?.querySelectorAll('.et-match-score-digit') ?? []).map((d) => d.getAttribute('data-state')),
    ).toEqual(['static']);
    expect(homeScore?.querySelector('.et-match-score-flash')).toBeNull();

    page.source.update((match) => ({ ...match, status: 'finished', awayScore: { score: 1 }, winningSide: 'home' }));
    page.size.set(MATCH_CARD_SIZES.COMPACT);
    s.tick();

    expect(page.changes.at(-1)).toEqual({ side: 'away', from: 0, to: 1, delta: 1 });
    expect(card?.getAttribute('data-winner')).toBe('home');
    expect(card?.getAttribute('aria-label')).toBe(
      `Match 3: Team A vs. Team B, 2 : 1, ${format(new Date('2026-09-26T18:30:00.000Z'), DEFAULT_MATCH_CARD_START_TIME_FORMAT)}, Finished`,
    );
    expect(sides.map((side) => text(side.querySelector('.et-match-participant-name')))).toEqual(['TMA', 'TMB']);
    expect(
      Array.from(sides[1]?.querySelectorAll('.et-match-score-digit') ?? []).map((d) => d.getAttribute('data-state')),
    ).toEqual(['static']);
  });

  it('draws scheduled, TBD, outcome and points matches with app and instance labels', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FixtureListComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;
    const kickOff = new Date('2026-09-26T18:30:00.000Z');

    s.tick();

    expect(page.labels().tbd).toBe('Offen');
    expect(page.labels().live).toBe(DEFAULT_MATCH_LABELS.live);

    const scheduled = host.querySelector('.scheduled');

    expect(scheduled?.getAttribute('role')).toBe('group');
    expect(scheduled?.hasAttribute('data-interactive')).toBe(false);
    expect(scheduled?.getAttribute('data-status')).toBe('scheduled');
    expect(text(scheduled?.querySelector('.et-match-card-time'))).toBe(
      format(kickOff, DEFAULT_MATCH_CARD_START_TIME_FORMAT),
    );
    expect(text(scheduled?.querySelector('.et-match-card-versus'))).toBe('gegen');
    expect(scheduled?.querySelector('et-match-score')).toBeNull();
    expect(scheduled?.querySelector('[data-side="home"] et-match-participant')?.hasAttribute('data-tbd')).toBe(true);
    expect(text(scheduled?.querySelector('[data-side="home"] .et-match-participant-name'))).toBe('Offen');
    expect(scheduled?.getAttribute('aria-label')).toBe(`Offen vs. Team B, ${format(kickOff, 'P p')}`);
    expect(resolveNormalizedMatchSideState(page.scheduled, 'home')).toBe('unavailable');
    expect(resolveNormalizedMatchSideState(page.scheduled, 'away')).toBe('occupied');
    expect(resolveNormalizedMatchSideState({ ...page.scheduled, homeState: 'predicted' }, 'home')).toBe('predicted');
    expect(text(scheduled?.querySelector('.et-match-card-announcement'))).toBe('');

    page.timeFormat.set('p');
    s.tick();
    expect(text(scheduled?.querySelector('.et-match-card-time'))).toBe(format(kickOff, 'p'));

    const outcome = host.querySelector('.outcome');

    expect(outcome?.getAttribute('data-size')).toBe('compact');
    expect(outcome?.querySelector('et-match-score')).toBeNull();
    expect(Array.from(outcome?.querySelectorAll('.et-match-card-outcome') ?? []).map(text)).toEqual(['L', 'W']);
    expect(text(outcome?.querySelector('.et-match-card-announcement'))).toBe('Team B won');
    expect(outcome?.getAttribute('aria-label')).toContain('Match 3: Team A vs. Team B, Team B won');

    const points = host.querySelector('.points');

    expect(text(points?.querySelector('.et-match-card-announcement'))).toBe('3 : 0 points');
    expect(points?.getAttribute('aria-label')).toContain('Group A: Team A vs. Team B, 3 : 0 points');
    expect(points?.querySelector('.et-match-card-games')?.getAttribute('aria-label')).toBe('Maps');

    expect(host.querySelector('.live .et-match-card-live')?.classList).toContain('et-color--calm');
    expect(host.querySelector('.live .et-match-card-games')).toBeNull();
  });

  it('builds an own card from the headless directive, its parts and the card token', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(OwnCardComponent);
    const page = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const card = host.querySelector('.own-card');

    expect(page.labels().scoreSeparator).toBe('-');
    expect(card?.getAttribute('role')).toBeNull();
    expect(card?.getAttribute('aria-label')).toBe(
      `Match 3: Team A vs. Team B, 1-0, ${format(new Date('2026-09-26T18:30:00.000Z'), 'P p')}, Finished`,
    );
    expect(card?.querySelector('.own-meta')?.getAttribute('aria-hidden')).toBe('true');
    expect(card?.querySelector('.own-score')?.getAttribute('aria-live')).toBe('polite');
    expect(text(card?.querySelector('.own-score'))).toBe('1-0');
    expect(card?.querySelector('.own-games')?.getAttribute('aria-label')).toBe('Karten');
    expect(Array.from(card?.querySelectorAll('.own-games li') ?? []).map(text)).toEqual(['13-11', '9-13']);
    expect(text(card?.querySelector('.winner-flag'))).toBe('Team A');
    expect(page.card().isFinished()).toBe(true);
    expect(page.card().isInteractive()).toBe(true);
    expect(fixture.debugElement.queryAll(By.directive(MatchScoreComponent))).toHaveLength(1);

    page.match.update((match) => ({ ...match, homeScore: 2 }));
    s.tick();

    expect(card?.querySelectorAll('.et-match-score-digit')).toHaveLength(1);
    expect(text(card?.querySelector('.own-score'))).toBe('2-0');
  });

  it('draws a participant on its own, as a link-like control, compact, TBD and loading', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RosterComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const player = host.querySelector('.player');

    expect(player?.getAttribute('aria-label')).toBe('ace');
    expect(player?.hasAttribute('data-interactive')).toBe(true);
    expect(text(player?.querySelector('.et-match-participant-subtitle'))).toBe('Club A');
    expect(player?.querySelector('.et-match-participant-seed')?.getAttribute('aria-label')).toBe('Seed 3');
    expect(player?.querySelector('et-picture')).not.toBeNull();
    expect(player?.querySelector('img')?.getAttribute('alt')).toBe('ace emblem');

    const compact = host.querySelector('.compact');

    expect(compact?.hasAttribute('data-compact')).toBe(true);
    expect(compact?.getAttribute('aria-label')).toBeNull();
    expect(text(compact?.querySelector('.et-match-participant-name'))).toBe('TMA');
    expect(compact?.querySelector('.et-match-participant-subtitle')).toBeNull();
    expect(compact?.querySelector('.et-match-participant-seed')).toBeNull();

    expect(text(host.querySelector('.tbd .et-match-participant-name'))).toBe(DEFAULT_MATCH_LABELS.tbd);
    expect(host.querySelector('.tbd .et-match-participant-emblem-mark')).toBeNull();
    expect(host.querySelector('.pending .et-match-participant-name')).toBeNull();
    expect(host.querySelectorAll('.pending et-skeleton-item')).toHaveLength(2);
    expect(fixture.debugElement.queryAll(By.directive(MatchParticipantComponent))).toHaveLength(4);
  });

  it('normalizes Ethlete API data and names participants through the shared fallback chain', () => {
    scenario();

    expect(normalizeEthleteMedia({ original: '/full.png', path: '/stored.png' })).toEqual({ defaultSrc: '/full.png' });
    expect(normalizeEthleteMedia({ path: '/stored.png' })).toEqual({ defaultSrc: '/stored.png' });
    expect(normalizeEthleteMedia({ original: null, path: null })).toBeNull();
    expect(normalizeEthleteMedia(null)).toBeNull();

    expect(normalizeEthleteParticipant(null)).toBeNull();
    expect(
      normalizeEthleteParticipant(team('team-b', { emblem: null, footballClubEmblem: { path: '/club.png' } })),
    ).toEqual({
      id: 'team-b',
      name: 'Team B',
      code: 'TMB',
      subtitle: null,
      emblem: { defaultSrc: '/club.png' },
      seed: null,
    });

    expect(
      (['preparing', 'started', 'finished', 'published', 'hidden', null] as const).map(normalizeEthleteMatchStatus),
    ).toEqual(['scheduled', 'live', 'finished', 'finished', 'scheduled', 'scheduled']);

    const single = normalizeEthleteMatch(
      ethleteMatch({ games: [{ homeScore: { score: 2 }, awayScore: { score: 1 } }], matchNumber: null }),
    );

    expect(single.gameScores).toBeNull();
    expect(single.label).toBeNull();
    expect(single.startTime).toEqual(new Date('2026-09-26T18:30:00.000Z'));

    const labels = { ...DEFAULT_MATCH_LABELS, tbd: 'Open' };
    const codeOnly: NormalizedMatchParticipant = { ...single.home, name: null } as NormalizedMatchParticipant;

    expect(matchParticipantDisplayName({ participant: null, labels })).toBe('Open');
    expect(matchParticipantDisplayName({ participant: single.home, labels, compact: true })).toBe('TMA');
    expect(matchParticipantDisplayName({ participant: codeOnly, labels })).toBe('TMA');
    expect(matchParticipantDisplayName({ participant: { ...codeOnly, code: null }, labels })).toBe('Open');
  });

  it('reports a card part placed outside a card', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StrayScoreComponent);

    s.tick();

    for (const part of ['etMatchCardScore', 'etMatchCardMeta', 'etMatchCardGameScores']) {
      s.expectError(new RegExp(`${code(MATCH_ERROR_CODES.PART_OUTSIDE_MATCH_CARD)}.*\\[${part}\\]`));
    }

    for (let i = 0; i < 3; i++) {
      expect((fixture.nativeElement as HTMLElement).contains(takeErrorContext(s)?.element ?? null)).toBe(true);
    }
  });
});
