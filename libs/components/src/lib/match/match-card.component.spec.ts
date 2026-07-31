import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { MatchCardSize, MatchScoreChange } from './headless';
import { provideMatchLabels } from './match-labels';
import { MATCH_CARD_IMPORTS } from './match.imports';
import { NormalizedMatch } from './match.types';

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

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const card = (fixture: ComponentFixture<unknown>) =>
  (fixture.nativeElement as HTMLElement).querySelector('.et-match-card') as HTMLElement;

const text = (fixture: ComponentFixture<unknown>, selector: string) =>
  (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();

const all = (fixture: ComponentFixture<unknown>, selector: string) =>
  Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector));

describe('MatchCardComponent', () => {
  it('draws both sides, in home-away order', () => {
    const names = all(create(), '.et-match-participant-name').map((element) => element.textContent?.trim());

    expect(names).toEqual(['FC Berlin', 'Neon Esports']);
  });

  it('draws each side its own score', () => {
    const scores = all(create(), '.et-match-card-score').map((element) => element.textContent?.trim());

    expect(scores).toEqual(['2', '1']);
  });

  it('draws no score before there is one', () => {
    const fixture = create();

    fixture.componentInstance.match.set({ ...FINISHED, status: 'scheduled', homeScore: null, awayScore: null });
    fixture.detectChanges();

    expect(all(fixture, '.et-match-card-score')).toHaveLength(0);
  });

  describe('the composed name', () => {
    it('is one string on the card itself, so a screen reader reads the match', () => {
      expect(card(create()).getAttribute('aria-label')).toBe('Match 3: FC Berlin vs. Neon Esports, 2 : 1, Finished');
    });

    it('names the kick-off instead of a score while the match is scheduled', () => {
      const fixture = create();

      fixture.componentInstance.match.set({
        ...FINISHED,
        status: 'scheduled',
        homeScore: null,
        awayScore: null,
        winnerSide: null,
      });
      fixture.detectChanges();

      expect(card(fixture).getAttribute('aria-label')).toBe('Match 3: FC Berlin vs. Neon Esports, 2026');
    });

    it('uses the full name even where the card draws a short code', () => {
      const fixture = create();

      fixture.componentInstance.size.set('compact');
      fixture.detectChanges();

      expect(text(fixture, '.et-match-participant-name')).toBe('FCB');
      expect(card(fixture).getAttribute('aria-label')).toContain('FC Berlin vs. Neon Esports');
    });

    it('names a TBD slot rather than leaving a gap in the sentence', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, away: null });
      fixture.detectChanges();

      expect(card(fixture).getAttribute('aria-label')).toContain('FC Berlin vs. TBD');
    });

    it('comes from the match labels', () => {
      TestBed.configureTestingModule({
        providers: [provideMatchLabels({ matchName: ({ home, away }) => `${home} gegen ${away}` })],
      });

      expect(card(create()).getAttribute('aria-label')).toBe('FC Berlin gegen Neon Esports');
    });
  });

  describe('the score announcement', () => {
    it('is a polite, atomic live region, so a goal is read as one value', () => {
      const announcement = (create().nativeElement as HTMLElement).querySelector('.et-match-card-announcement');

      expect(announcement?.getAttribute('aria-live')).toBe('polite');
      expect(announcement?.getAttribute('aria-atomic')).toBe('true');
      expect(announcement?.textContent?.trim()).toBe('2 : 1');
    });

    it('stays in the DOM while there is nothing to announce — a live region has to exist first', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, status: 'scheduled', homeScore: null, awayScore: null });
      fixture.detectChanges();

      expect(text(fixture, '.et-match-card-announcement')).toBe('');
    });

    it('is not doubled by the drawn digits, which are hidden from assistive tech', () => {
      const scores = all(create(), '.et-match-card-score');

      expect(scores.every((element) => element.getAttribute('aria-hidden') === 'true')).toBe(true);
    });
  });

  describe('what the two headline values mean', () => {
    it('draws table points as they are, and says they are points', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, resultKind: 'points', homeScore: 3, awayScore: 0 });
      fixture.detectChanges();

      expect(all(fixture, '.et-match-card-score').map((element) => element.textContent?.trim())).toEqual(['3', '0']);
      expect(text(fixture, '.et-match-card-announcement')).toBe('3 : 0 points');
    });

    it('is exposed to CSS, so points can be styled differently from a score', () => {
      const fixture = create();

      expect(card(fixture).getAttribute('data-result-kind')).toBe('score');

      fixture.componentInstance.match.set({ ...FINISHED, resultKind: 'points' });
      fixture.detectChanges();

      expect(card(fixture).getAttribute('data-result-kind')).toBe('points');
    });

    it('honours a scoreSeparator override without touching resultName', () => {
      TestBed.configureTestingModule({ providers: [provideMatchLabels({ scoreSeparator: ' \u2013 ' })] });

      expect(text(create(), '.et-match-card-announcement')).toBe('2 \u2013 1');
    });
  });

  describe('win/loss outcomes', () => {
    const withOutcome = (match: Partial<NormalizedMatch> = {}) => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, resultKind: 'outcome', ...match });
      fixture.detectChanges();

      return fixture;
    };

    it('are derived from the winner rather than sent as data', () => {
      const fixture = withOutcome();

      expect(all(fixture, '.et-match-card-outcome').map((element) => element.textContent?.trim())).toEqual(['W', 'L']);
    });

    it('replace the score rather than joining it — one slot, one form', () => {
      const fixture = withOutcome();

      expect(all(fixture, '.et-match-card-score')).toHaveLength(0);
    });

    it('are a draw on both sides when nobody won', () => {
      const fixture = withOutcome({ winnerSide: null, homeScore: 1, awayScore: 1 });

      expect(all(fixture, '.et-match-card-outcome').map((element) => element.textContent?.trim())).toEqual(['D', 'D']);
    });

    it('announce who won, since the letters say nothing read aloud', () => {
      expect(text(withOutcome(), '.et-match-card-announcement')).toBe('FC Berlin won');
    });

    it('stay away until the match is over — there is no W before then', () => {
      const fixture = withOutcome({ status: 'live', winnerSide: null });

      expect(all(fixture, '.et-match-card-outcome')).toHaveLength(0);
      expect(text(fixture, '.et-match-card-announcement')).toBe('');
    });

    it('are hidden from assistive tech, which gets the phrased result instead', () => {
      const outcomes = all(withOutcome(), '.et-match-card-outcome');

      expect(outcomes.every((element) => element.getAttribute('aria-hidden') === 'true')).toBe(true);
    });
  });

  describe('the meta row', () => {
    it('shows the label and the kick-off, hidden from assistive tech — the card name has both', () => {
      const fixture = create();

      expect(text(fixture, '.et-match-card-label')).toBe('Match 3');
      expect(text(fixture, '.et-match-card-time')).toBe('2026');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.et-match-card-meta')?.getAttribute('aria-hidden'),
      ).toBe('true');
    });

    it('swaps the kick-off for a live badge while the match is running', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, status: 'live', winnerSide: null });
      fixture.detectChanges();

      expect(text(fixture, '.et-match-card-live')).toBe('Live');
      expect((fixture.nativeElement as HTMLElement).querySelector('.et-match-card-time')).toBeNull();
    });

    it('is left out entirely when there is nothing to put in it', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, label: null, startTime: null });
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.et-match-card-meta')).toBeNull();
    });
  });

  describe('a series', () => {
    const series = () => {
      const fixture = create();

      fixture.componentInstance.match.set({
        ...FINISHED,
        gameScores: [
          { home: 13, away: 11 },
          { home: 8, away: 13 },
          { home: 13, away: 9 },
        ],
      });
      fixture.detectChanges();

      return fixture;
    };

    it('lists every game, as a real list', () => {
      const fixture = series();
      const games = (fixture.nativeElement as HTMLElement).querySelector('.et-match-card-games');

      expect(games?.getAttribute('role')).toBe('list');
      expect(games?.getAttribute('aria-label')).toBe('Games');
      expect(all(fixture, '.et-match-card-game').map((element) => element.textContent?.trim())).toEqual([
        '13 : 11',
        '8 : 13',
        '13 : 9',
      ]);
    });

    it('numbers each game for assistive tech, since "8 : 13" alone says nothing', () => {
      const labels = all(series(), '.et-match-card-game').map((element) => element.getAttribute('aria-label'));

      expect(labels).toEqual(['Game 1: 13 : 11', 'Game 2: 8 : 13', 'Game 3: 13 : 9']);
    });

    it('is absent for a single game', () => {
      expect((create().nativeElement as HTMLElement).querySelector('.et-match-card-games')).toBeNull();
    });
  });

  describe('the state it exposes to CSS', () => {
    it('marks the status, the density and the winner', () => {
      const element = card(create());

      expect(element.getAttribute('data-status')).toBe('finished');
      expect(element.getAttribute('data-size')).toBe('auto');
      expect(element.getAttribute('data-winner')).toBe('home');
    });

    it('marks no winner while the match is undecided', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, status: 'live', winnerSide: null });
      fixture.detectChanges();

      expect(card(fixture).getAttribute('data-winner')).toBeNull();
    });
  });

  describe('the state it exposes to CSS', () => {
    it('marks hidden names, and keeps them in the accessible name regardless', () => {
      const fixture = create();

      fixture.componentInstance.hideNames.set(true);
      fixture.detectChanges();

      expect(card(fixture).hasAttribute('data-hide-names')).toBe(true);
      expect(card(fixture).getAttribute('aria-label')).toContain('FC Berlin vs. Neon Esports');
    });
  });

  describe('a score changing', () => {
    const live = { ...FINISHED, status: 'live', winnerSide: null } as NormalizedMatch;

    const digits = (fixture: ComponentFixture<unknown>) =>
      all(fixture, '.et-match-score-digit').map(
        (element) => `${element.textContent?.trim()}/${element.getAttribute('data-state')}`,
      );

    it('reports which side moved and by how much', () => {
      const fixture = create();

      fixture.componentInstance.match.set(live);
      fixture.detectChanges();

      expect(fixture.componentInstance.changes).toEqual([]);

      fixture.componentInstance.match.set({ ...live, homeScore: 3 });
      fixture.detectChanges();

      expect(fixture.componentInstance.changes).toEqual([{ side: 'home', from: 2, to: 3, delta: 1 }]);
    });

    it('reports nothing for the first render, however the scores arrive', () => {
      const fixture = create();

      expect(fixture.componentInstance.changes).toEqual([]);
    });

    it('rolls the old value out as the new one arrives, both as real elements', () => {
      const fixture = create();

      fixture.componentInstance.match.set(live);
      fixture.detectChanges();

      expect(digits(fixture)).toEqual(['2/static', '1/static']);

      fixture.componentInstance.match.set({ ...live, homeScore: 3 });
      fixture.detectChanges();

      expect(digits(fixture)).toEqual(['2/out', '3/in', '1/static']);
    });

    it('does not roll a finished match — a result arriving late is not a moment', () => {
      const fixture = create();

      fixture.componentInstance.match.set({ ...FINISHED, homeScore: 3 });
      fixture.detectChanges();

      expect(digits(fixture)).toEqual(['3/static', '1/static']);
    });
  });

  describe('interactivity', () => {
    it('is a labelled group when the card is not a click target', () => {
      const element = card(create());

      expect(element.getAttribute('role')).toBe('group');
      expect(element.hasAttribute('data-interactive')).toBe(false);
    });

    it('keeps the link role and marks itself interactive on an anchor', () => {
      const fixture = TestBed.createComponent(LinkHostComponent);

      fixture.detectChanges();

      const element = card(fixture);

      expect(element.tagName).toBe('A');
      expect(element.hasAttribute('role')).toBe(false);
      expect(element.hasAttribute('data-interactive')).toBe(true);
      expect(element.getAttribute('aria-label')).toContain('FC Berlin vs. Neon Esports');
    });
  });

  it('shows the seeds when asked to', () => {
    const fixture = create();

    fixture.componentInstance.showSeeds.set(true);
    fixture.detectChanges();

    expect(all(fixture, '.et-match-participant-seed').map((element) => element.textContent?.trim())).toEqual([
      '1',
      '4',
    ]);
  });
});
