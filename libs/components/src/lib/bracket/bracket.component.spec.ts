import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { NormalizedMatch } from '../match';
import { BracketMatchNormalizer } from './bracket-card-context';
import { BracketComponent } from './bracket.component';
import { BracketDataSource } from './integrations';
import { singleEliminationBracketLayout } from './layouts';
import { generateSingleEliminationBracket } from './stories/generate-bracket';

/** What the fixtures render: a single-elimination source needs exactly this one registered. */
const LAYOUTS = [singleEliminationBracketLayout()];

const normalizer: BracketMatchNormalizer = (match): NormalizedMatch => ({
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

/**
 * The same bracket with its opening two matches swapped - a re-seeding a live feed can ship, and one
 * that moves a journey without moving the `p<n>` short id the grid marks its cells with.
 */
const reseededOpeningRound = (source: BracketDataSource<null, null>): BracketDataSource<null, null> => {
  const [first, second] = source.matches;

  if (!first || !second) throw new Error('expected at least two matches in the opening round');

  return {
    ...source,
    matches: source.matches.map((match) => {
      if (match.id === first.id) return { ...match, home: second.home, away: second.away };
      if (match.id === second.id) return { ...match, home: first.home, away: first.away };

      return match;
    }),
  };
};

@Component({
  template: `<et-bracket
    [(focusedParticipantId)]="focusedParticipantId"
    [source]="source()"
    [layouts]="LAYOUTS"
    [matchNormalizer]="NORMALIZER"
  />`,
  imports: [BracketComponent],
})
class HostComponent {
  // Signals, not plain fields: a plain field never refreshes a signal input.
  public source = signal<BracketDataSource<null, null>>(generateSingleEliminationBracket(8));
  public focusedParticipantId = signal<string | null>(null);

  protected readonly LAYOUTS = LAYOUTS;

  protected readonly NORMALIZER = normalizer;
}

describe('BracketComponent participant focus', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let bracket: HTMLElement;

  const activeMatchIds = () =>
    Array.from(bracket.querySelectorAll('.et-bracket-element--match.et-bracket-journey-active')).map((el) =>
      el.getAttribute('data-match-id'),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    bracket = fixture.nativeElement.querySelector('.et-bracket-host');
  });

  it('marks every cell of a pinned participant, and says so on the host', () => {
    // `p1` is the generator's top seed, who wins out - three matches, one per round.
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    expect(bracket.classList).toContain('et-bracket-host--journey-hover');
    expect(bracket.classList).toContain('et-bracket-host--journey-focused');
    expect(activeMatchIds()).toEqual(['se-r0-m0', 'se-r1-m0', 'se-r2-m0']);
  });

  it('leaves the final card to measure its own cell', () => {
    expect(bracket.querySelector('.et-bracket-final-card')?.getAttribute('data-size')).toBe('auto');
  });

  it('crosses out the row a participant went out in', () => {
    host.focusedParticipantId.set('p2');
    fixture.detectChanges();

    const endpoint = bracket.querySelector('.et-bracket-journey-endpoint');

    expect(endpoint?.getAttribute('data-match-id')).toBe('se-r0-m0');
    expect(bracket.querySelector('.et-bracket-journey-eliminated')?.getAttribute('data-participant-id')).toBe('p2');
  });

  it('drops the pin on Escape and writes the null back through the model', () => {
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(host.focusedParticipantId()).toBeNull();
    expect(bracket.classList).not.toContain('et-bracket-host--journey-focused');
  });

  it('leaves the pin alone for any other key', () => {
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(host.focusedParticipantId()).toBe('p1');
  });

  it('drops the pin when a click lands past the cells', () => {
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    bracket.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(host.focusedParticipantId()).toBeNull();
  });

  it('keeps the pin when the click was the card doing its job', () => {
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    bracket.querySelector('[data-match-id="se-r1-m0"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(host.focusedParticipantId()).toBe('p1');
  });

  it('re-marks a pinned journey against the cells of a new source', () => {
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    host.source.set(generateSingleEliminationBracket(16));
    fixture.detectChanges();

    expect(activeMatchIds()).toEqual(['se-r0-m0', 'se-r1-m0', 'se-r2-m0', 'se-r3-m0']);
  });

  it('lights a pin that only the new source knows, and dims nothing until then', () => {
    host.focusedParticipantId.set('p9');
    fixture.detectChanges();

    expect(activeMatchIds()).toEqual([]);
    expect(bracket.classList).not.toContain('et-bracket-host--journey-focused');

    host.source.set(generateSingleEliminationBracket(16));
    fixture.detectChanges();

    expect(activeMatchIds()).toEqual(['se-r0-m4', 'se-r1-m2', 'se-r2-m1', 'se-r3-m0']);
    expect(bracket.classList).toContain('et-bracket-host--journey-focused');
  });

  it('stops marking a participant the new source dropped', () => {
    host.source.set(generateSingleEliminationBracket(16));
    fixture.detectChanges();

    host.focusedParticipantId.set('p9');
    fixture.detectChanges();

    expect(activeMatchIds()).toEqual(['se-r0-m4', 'se-r1-m2', 'se-r2-m1', 'se-r3-m0']);

    host.source.set(generateSingleEliminationBracket(8));
    fixture.detectChanges();

    expect(activeMatchIds()).toEqual([]);
    expect(bracket.classList).not.toContain('et-bracket-host--journey-hover');
  });

  it('re-marks a journey whose cells moved under an unchanged short id', () => {
    host.focusedParticipantId.set('p1');
    fixture.detectChanges();

    host.source.set(reseededOpeningRound(generateSingleEliminationBracket(8)));
    fixture.detectChanges();

    expect(activeMatchIds()).toEqual(['se-r0-m1', 'se-r1-m0', 'se-r2-m0']);
  });

  it('draws nothing once the journey highlight is off', async () => {
    TestBed.resetTestingModule();

    @Component({
      template: `<et-bracket
        [source]="source"
        [layouts]="LAYOUTS"
        [matchNormalizer]="NORMALIZER"
        disableJourneyHighlight
        focusedParticipantId="p1"
      />`,
      imports: [BracketComponent],
    })
    class DisabledHostComponent {
      public source = generateSingleEliminationBracket(8);

      protected readonly LAYOUTS = LAYOUTS;

      protected readonly NORMALIZER = normalizer;
    }

    await TestBed.configureTestingModule({ imports: [DisabledHostComponent] }).compileComponents();

    const disabled = TestBed.createComponent(DisabledHostComponent);

    disabled.detectChanges();

    expect(disabled.nativeElement.querySelectorAll('.et-bracket-journey-active').length).toBe(0);
  });
});
