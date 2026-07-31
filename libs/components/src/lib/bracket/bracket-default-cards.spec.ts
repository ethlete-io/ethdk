import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { NormalizedMatch } from '../match';
import { BRACKET_CARD_CONTEXT, BracketCardContext, BracketMatchNormalizer } from './bracket-card-context';
import { BracketDefaultContinueComponent } from './bracket-default-continue.component';
import { BracketDefaultFinalMatchComponent } from './bracket-default-final-match.component';
import { BracketDefaultMatchComponent } from './bracket-default-match.component';
import { BracketDefaultRoundHeaderComponent } from './bracket-default-round-header.component';
import { provideBracketLabels } from './bracket-labels';
import { BracketMatch, BracketRound, BracketRoundSwissGroup } from './linked';

/** Only the fields the cards read — the engine's own graph never reaches a card's template. */
const bracketMatch = (winnerSide: 'home' | 'away' | null = 'home') =>
  ({ id: 'm1', winnerSide, status: 'completed', data: null }) as unknown as BracketMatch<unknown, unknown>;

const bracketRound = (name = 'Grand final', matchCount = 4) =>
  ({ id: 'r1', name, matchCount }) as unknown as BracketRound<unknown, unknown>;

const swissGroup = (name: string) => ({ name }) as unknown as BracketRoundSwissGroup<unknown, unknown>;

const normalized = (overrides: Partial<NormalizedMatch> = {}): NormalizedMatch => ({
  id: 'm1',
  status: 'finished',
  startTime: null,
  home: { id: 'h', name: 'FC Berlin', code: 'FCB', subtitle: null, emblem: null, seed: null },
  away: { id: 'a', name: 'Neon Esports', code: 'NEO', subtitle: null, emblem: null, seed: null },
  homeScore: 2,
  awayScore: 1,
  resultKind: 'score',
  gameScores: null,
  winnerSide: 'home',
  label: null,
  ...overrides,
});

/** Stands in for `et-bracket`, which is what really provides this. */
const provideCardContext = (options: { normalizer?: BracketMatchNormalizer | null; headerLevel?: number } = {}) => {
  const context: BracketCardContext = {
    // `??` would swallow a deliberate `null` — which is the case worth testing.
    resolvedMatchNormalizer: signal(options.normalizer === undefined ? () => normalized() : options.normalizer),
    resolvedRoundHeaderLevel: signal(options.headerLevel ?? 3),
  };

  return { provide: BRACKET_CARD_CONTEXT, useValue: context };
};

@Component({
  template: `
    <et-bracket-default-match [bracketRound]="round" [bracketMatch]="match" [bracketRoundSwissGroup]="null" />
  `,
  imports: [BracketDefaultMatchComponent],
})
class MatchHostComponent {
  public round = bracketRound();
  public match = bracketMatch();
}

@Component({
  template: `
    <et-bracket-default-final-match [bracketRound]="round" [bracketMatch]="match" [bracketRoundSwissGroup]="null" />
  `,
  imports: [BracketDefaultFinalMatchComponent],
})
class FinalHostComponent {
  public round = bracketRound();
  public match = bracketMatch();
}

@Component({
  template: `<et-bracket-default-round-header [bracketRound]="round" [bracketRoundSwissGroup]="group()" />`,
  imports: [BracketDefaultRoundHeaderComponent],
})
class HeaderHostComponent {
  public round = bracketRound('Round 2', 4);
  // A signal, not a plain field: a plain field never refreshes a signal input.
  public group = signal<BracketRoundSwissGroup<unknown, unknown> | null>(null);
}

@Component({
  template: `<et-bracket-default-continue [bracketMatches]="matches" />`,
  imports: [BracketDefaultContinueComponent],
})
class ContinueHostComponent {
  public matches = [bracketMatch(), bracketMatch()];
}

const text = (fixture: ComponentFixture<unknown>, selector: string) =>
  (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();

describe('the bracket default cards', () => {
  describe('the match cell', () => {
    it('draws the normalized match as a compact card', () => {
      TestBed.configureTestingModule({ providers: [provideCardContext()] });

      const fixture = TestBed.createComponent(MatchHostComponent);

      fixture.detectChanges();

      const card = (fixture.nativeElement as HTMLElement).querySelector('.et-match-card');

      expect(card?.getAttribute('data-size')).toBe('compact');
      expect(card?.getAttribute('aria-label')).toBe('FC Berlin vs. Neon Esports, 2 : 1, Finished');
    });

    it('draws nothing without a normalizer, rather than an empty card', () => {
      TestBed.configureTestingModule({ providers: [provideCardContext({ normalizer: null })] });

      const fixture = TestBed.createComponent(MatchHostComponent);

      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.et-match-card')).toBeNull();
    });
  });

  describe('the final cell', () => {
    it('names the champion once the final is decided', () => {
      TestBed.configureTestingModule({ providers: [provideCardContext()] });

      const fixture = TestBed.createComponent(FinalHostComponent);

      fixture.detectChanges();

      expect(text(fixture, '.et-bracket-final-round')).toBe('Grand final');
      expect(text(fixture, '.et-bracket-final-champion')).toBe('Champion: FC Berlin');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.et-bracket-final-host')?.hasAttribute('data-decided'),
      ).toBe(true);
    });

    it('says so while it is undecided, rather than leaving the most looked-at cell blank', () => {
      TestBed.configureTestingModule({
        providers: [provideCardContext({ normalizer: () => normalized({ status: 'scheduled', winnerSide: null }) })],
      });

      const fixture = TestBed.createComponent(FinalHostComponent);

      fixture.detectChanges();

      expect(text(fixture, '.et-bracket-final-champion')).toBe('Champion not decided yet');
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.et-bracket-final-host')?.hasAttribute('data-decided'),
      ).toBe(false);
    });
  });

  describe('the round header', () => {
    it('is a real heading, at the level the bracket was told to use', () => {
      TestBed.configureTestingModule({ providers: [provideCardContext({ headerLevel: 2 })] });

      const fixture = TestBed.createComponent(HeaderHostComponent);

      fixture.detectChanges();

      const header = (fixture.nativeElement as HTMLElement).querySelector('.et-bracket-default-round-header-host');

      expect(header?.getAttribute('role')).toBe('heading');
      expect(header?.getAttribute('aria-level')).toBe('2');
      expect(text(fixture, '.et-bracket-default-round-header-name')).toBe('Round 2');
      expect(text(fixture, '.et-bracket-default-round-header-count')).toBe('4 matches');
    });

    it('names the swiss group it belongs to, where there is one', () => {
      TestBed.configureTestingModule({ providers: [provideCardContext()] });

      const fixture = TestBed.createComponent(HeaderHostComponent);

      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('.et-bracket-default-round-header-group')).toBeNull();

      fixture.componentInstance.group.set(swissGroup('2-0 group'));
      fixture.detectChanges();

      expect(text(fixture, '.et-bracket-default-round-header-group')).toBe('2-0 group');
    });
  });

  describe('the continue cell', () => {
    it('says how many winners advance, and names itself for assistive tech', () => {
      const fixture = TestBed.createComponent(ContinueHostComponent);

      fixture.detectChanges();

      const host = (fixture.nativeElement as HTMLElement).querySelector('.et-bracket-default-continue-host');

      expect(text(fixture, '.et-bracket-default-continue-text')).toBe('2 winners advance');
      expect(host?.getAttribute('aria-label')).toBe('2 winners advance to the next stage');
    });

    it('counts one winner in the singular', () => {
      const fixture = TestBed.createComponent(ContinueHostComponent);

      fixture.componentInstance.matches = [bracketMatch()];
      fixture.detectChanges();

      expect(text(fixture, '.et-bracket-default-continue-text')).toBe('1 winner advance');
    });

    it('takes its strings from the bracket labels', () => {
      TestBed.configureTestingModule({
        providers: [provideBracketLabels({ winnersAdvance: (winners) => `${winners} kommen weiter` })],
      });

      const fixture = TestBed.createComponent(ContinueHostComponent);

      fixture.detectChanges();

      expect(text(fixture, '.et-bracket-default-continue-text')).toBe('2 kommen weiter');
    });
  });
});
