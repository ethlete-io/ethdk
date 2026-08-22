import { Component, signal } from '@angular/core';
import '../../test-helpers';
import { MatchCardSize, MatchScoreChange } from './headless';
import { provideMatchLabels } from './match-labels';
import { MATCH_CARD_IMPORTS } from './match.imports';
import { NormalizedMatch } from './match.types';
import { MatchCardDriver, mountMatchCard } from './testing/match-card-driver';

const HOME = {
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  emblem: { defaultSrc: '/fcb.png' },
  seed: 1,
};

const AWAY = {
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: null,
  emblem: null,
  seed: 4,
};

const FINISHED: NormalizedMatch = {
  id: 'm1',
  status: 'finished',
  startTime: new Date('2026-05-02T18:30:00Z'),
  home: HOME,
  away: AWAY,
  homeScore: 2,
  awayScore: 1,
  resultKind: 'score',
  gameScores: null,
  winnerSide: 'home',
  label: 'Match 3',
};

@Component({
  template: `
    <et-match-card
      [match]="match()"
      [size]="size()"
      [showSeeds]="showSeeds()"
      [hideNames]="hideNames()"
      [startTimeFormat]="startTimeFormat()"
      (scoreChange)="changes.push($event)"
    />
  `,
  imports: [MATCH_CARD_IMPORTS],
})
class HostComponent {
  public match = signal<NormalizedMatch>(FINISHED);
  public size = signal<MatchCardSize>('auto');
  public showSeeds = signal(false);
  public hideNames = signal(false);
  public changes: MatchScoreChange[] = [];
  // Year only: every other date-fns token moves with the runner's timezone.
  public startTimeFormat = signal<string | null>('yyyy');
}

@Component({
  template: `
    <!-- The card renders its own content and its own accessible name, neither visible to the linter. -->
    <!-- eslint-disable-next-line @angular-eslint/template/elements-content -->
    <a [match]="match()" et-match-card href="#"></a>
  `,
  imports: [MATCH_CARD_IMPORTS],
})
class LinkHostComponent {
  public match = signal<NormalizedMatch>(FINISHED);
}

const create = () => mountMatchCard(HostComponent);

describe('MatchCardComponent', () => {
  it('draws both sides, in home-away order', () => {
    const names = create()
      .queryAll('.et-match-participant-name')
      .map((element) => element.textContent?.trim());

    expect(names).toEqual(['FC Berlin', 'Neon Esports']);
  });

  it('draws each side its own score', () => {
    const scores = create()
      .queryAll('.et-match-card-score')
      .map((element) => element.textContent?.trim());

    expect(scores).toEqual(['2', '1']);
  });

  it('draws no score before there is one', () => {
    const driver = create();

    driver.host.match.set({ ...FINISHED, status: 'scheduled', homeScore: null, awayScore: null });
    driver.detectChanges();

    expect(driver.queryAll('.et-match-card-score')).toHaveLength(0);
  });

  describe('the composed name', () => {
    it('is one string on the card itself, so a screen reader reads the match', () => {
      expect(create().card().getAttribute('aria-label')).toBe('Match 3: FC Berlin vs. Neon Esports, 2 : 1, Finished');
    });

    it('names the kick-off instead of a score while the match is scheduled', () => {
      const driver = create();

      driver.host.match.set({
        ...FINISHED,
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
        winnerSide: null,
      });
      driver.detectChanges();

      expect(driver.card().getAttribute('aria-label')).toBe('Match 3: FC Berlin vs. Neon Esports, 2026');
    });

    it('uses the full name even where the card draws a short code', () => {
      const driver = create();

      driver.host.size.set('compact');
      driver.detectChanges();

      expect(driver.text('.et-match-participant-name')).toBe('FCB');
      expect(driver.card().getAttribute('aria-label')).toContain('FC Berlin vs. Neon Esports');
    });

    it('names a TBD slot rather than leaving a gap in the sentence', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, away: null });
      driver.detectChanges();

      expect(driver.card().getAttribute('aria-label')).toContain('FC Berlin vs. TBD');
    });

    it('comes from the match labels', () => {
      const driver = mountMatchCard(HostComponent, [
        provideMatchLabels({ matchName: ({ home, away }) => `${home} gegen ${away}` }),
      ]);

      expect(driver.card().getAttribute('aria-label')).toBe('FC Berlin gegen Neon Esports');
    });
  });

  describe('the score announcement', () => {
    it('is a polite, atomic live region, so a goal is read as one value', () => {
      const announcement = create().query('.et-match-card-announcement');

      expect(announcement?.getAttribute('aria-live')).toBe('polite');
      expect(announcement?.getAttribute('aria-atomic')).toBe('true');
      expect(announcement?.textContent?.trim()).toBe('2 : 1');
    });

    it('stays in the DOM while there is nothing to announce - a live region has to exist first', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, status: 'scheduled', homeScore: null, awayScore: null });
      driver.detectChanges();

      expect(driver.text('.et-match-card-announcement')).toBe('');
    });

    it('is not doubled by the drawn digits, which are hidden from assistive tech', () => {
      const scores = create().queryAll('.et-match-card-score');

      expect(scores.every((element) => element.getAttribute('aria-hidden') === 'true')).toBe(true);
    });
  });

  describe('what the two headline values mean', () => {
    it('draws table points as they are, and says they are points', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, resultKind: 'points', homeScore: 3, awayScore: 0 });
      driver.detectChanges();

      expect(driver.queryAll('.et-match-card-score').map((element) => element.textContent?.trim())).toEqual(['3', '0']);
      expect(driver.text('.et-match-card-announcement')).toBe('3 : 0 points');
    });

    it('is exposed to CSS, so points can be styled differently from a score', () => {
      const driver = create();

      expect(driver.card().getAttribute('data-result-kind')).toBe('score');

      driver.host.match.set({ ...FINISHED, resultKind: 'points' });
      driver.detectChanges();

      expect(driver.card().getAttribute('data-result-kind')).toBe('points');
    });

    it('honours a scoreSeparator override without touching resultName', () => {
      const driver = mountMatchCard(HostComponent, [provideMatchLabels({ scoreSeparator: ' \u2013 ' })]);

      expect(driver.text('.et-match-card-announcement')).toBe('2 \u2013 1');
    });
  });

  describe('win/loss outcomes', () => {
    const withOutcome = (match: Partial<NormalizedMatch> = {}) => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, resultKind: 'outcome', ...match });
      driver.detectChanges();

      return driver;
    };

    it('are derived from the winner rather than sent as data', () => {
      const driver = withOutcome();

      expect(driver.queryAll('.et-match-card-outcome').map((element) => element.textContent?.trim())).toEqual([
        'W',
        'L',
      ]);
    });

    it('replace the score rather than joining it - one slot, one form', () => {
      expect(withOutcome().queryAll('.et-match-card-score')).toHaveLength(0);
    });

    it('are a draw on both sides when nobody won', () => {
      const driver = withOutcome({ winnerSide: null, homeScore: 1, awayScore: 1 });

      expect(driver.queryAll('.et-match-card-outcome').map((element) => element.textContent?.trim())).toEqual([
        'D',
        'D',
      ]);
    });

    it('announce who won, since the letters say nothing read aloud', () => {
      expect(withOutcome().text('.et-match-card-announcement')).toBe('FC Berlin won');
    });

    it('stay away until the match is over - there is no W before then', () => {
      const driver = withOutcome({ status: 'live', winnerSide: null });

      expect(driver.queryAll('.et-match-card-outcome')).toHaveLength(0);
      expect(driver.text('.et-match-card-announcement')).toBe('');
    });

    it('are hidden from assistive tech, which gets the phrased result instead', () => {
      const outcomes = withOutcome().queryAll('.et-match-card-outcome');

      expect(outcomes.every((element) => element.getAttribute('aria-hidden') === 'true')).toBe(true);
    });
  });

  describe('the meta row', () => {
    it('shows the label and the kick-off, hidden from assistive tech - the card name has both', () => {
      const driver = create();

      expect(driver.text('.et-match-card-label')).toBe('Match 3');
      expect(driver.text('.et-match-card-time')).toBe('2026');
      expect(driver.query('.et-match-card-meta')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('swaps the kick-off for a live badge while the match is running', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, status: 'live', winnerSide: null });
      driver.detectChanges();

      expect(driver.text('.et-match-card-live')).toBe('Live');
      expect(driver.query('.et-match-card-time')).toBeNull();
    });

    it('is left out entirely when there is nothing to put in it', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, label: null, startTime: null });
      driver.detectChanges();

      expect(driver.query('.et-match-card-meta')).toBeNull();
    });
  });

  describe('a series', () => {
    const series = () => {
      const driver = create();

      driver.host.match.set({
        ...FINISHED,
        gameScores: [
          { home: 13, away: 11 },
          { home: 8, away: 13 },
          { home: 13, away: 9 },
        ],
      });
      driver.detectChanges();

      return driver;
    };

    it('lists every game, as a real list', () => {
      const driver = series();
      const games = driver.query('.et-match-card-games');

      expect(games?.getAttribute('role')).toBe('list');
      expect(games?.getAttribute('aria-label')).toBe('Games');
      expect(driver.queryAll('.et-match-card-game').map((element) => element.textContent?.trim())).toEqual([
        '13 : 11',
        '8 : 13',
        '13 : 9',
      ]);
    });

    it('numbers each game for assistive tech, since "8 : 13" alone says nothing', () => {
      const labels = series()
        .queryAll('.et-match-card-game')
        .map((element) => element.getAttribute('aria-label'));

      expect(labels).toEqual(['Game 1: 13 : 11', 'Game 2: 8 : 13', 'Game 3: 13 : 9']);
    });

    it('is absent for a single game', () => {
      expect(create().query('.et-match-card-games')).toBeNull();
    });
  });

  describe('the state it exposes to CSS', () => {
    it('marks the status, the density and the winner', () => {
      const element = create().card();

      expect(element.getAttribute('data-status')).toBe('finished');
      expect(element.getAttribute('data-size')).toBe('auto');
      expect(element.getAttribute('data-winner')).toBe('home');
    });

    it('marks no winner while the match is undecided', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, status: 'live', winnerSide: null });
      driver.detectChanges();

      expect(driver.card().getAttribute('data-winner')).toBeNull();
    });
  });

  describe('the state it exposes to CSS', () => {
    it('marks hidden names, and keeps them in the accessible name regardless', () => {
      const driver = create();

      driver.host.hideNames.set(true);
      driver.detectChanges();

      expect(driver.card().hasAttribute('data-hide-names')).toBe(true);
      expect(driver.card().getAttribute('aria-label')).toContain('FC Berlin vs. Neon Esports');
    });
  });

  describe('a score changing', () => {
    const live = { ...FINISHED, status: 'live', winnerSide: null } as NormalizedMatch;

    const digits = (driver: MatchCardDriver<HostComponent>) =>
      driver
        .queryAll('.et-match-score-digit')
        .map((element) => `${element.textContent?.trim()}/${element.getAttribute('data-state')}`);

    it('reports which side moved and by how much', () => {
      const driver = create();

      driver.host.match.set(live);
      driver.detectChanges();

      expect(driver.host.changes).toEqual([]);

      driver.host.match.set({ ...live, homeScore: 3 });
      driver.detectChanges();

      expect(driver.host.changes).toEqual([{ side: 'home', from: 2, to: 3, delta: 1 }]);
    });

    it('reports nothing for the first render, however the scores arrive', () => {
      expect(create().host.changes).toEqual([]);
    });

    it('rolls the old value out as the new one arrives, both as real elements', () => {
      const driver = create();

      driver.host.match.set(live);
      driver.detectChanges();

      expect(digits(driver)).toEqual(['2/static', '1/static']);

      driver.host.match.set({ ...live, homeScore: 3 });
      driver.detectChanges();

      expect(digits(driver)).toEqual(['2/out', '3/in', '1/static']);
    });

    it('does not roll a finished match - a result arriving late is not a moment', () => {
      const driver = create();

      driver.host.match.set({ ...FINISHED, homeScore: 3 });
      driver.detectChanges();

      expect(digits(driver)).toEqual(['3/static', '1/static']);
    });
  });

  describe('interactivity', () => {
    it('is a labelled group when the card is not a click target', () => {
      const element = create().card();

      expect(element.getAttribute('role')).toBe('group');
      expect(element.hasAttribute('data-interactive')).toBe(false);
    });

    it('keeps the link role and marks itself interactive on an anchor', () => {
      const element = mountMatchCard(LinkHostComponent).card();

      expect(element.tagName).toBe('A');
      expect(element.hasAttribute('role')).toBe(false);
      expect(element.hasAttribute('data-interactive')).toBe(true);
      expect(element.getAttribute('aria-label')).toContain('FC Berlin vs. Neon Esports');
    });
  });

  it('shows the seeds when asked to', () => {
    const driver = create();

    driver.host.showSeeds.set(true);
    driver.detectChanges();

    expect(driver.queryAll('.et-match-participant-seed').map((element) => element.textContent?.trim())).toEqual([
      '1',
      '4',
    ]);
  });
});
