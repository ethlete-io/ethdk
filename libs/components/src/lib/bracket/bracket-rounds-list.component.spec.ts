import { Component, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { NormalizedMatch } from '../match';
import { BracketMatchNormalizer } from './bracket-card-context';
import { bracketFitsWidth, bracketNaturalWidth } from './bracket-fits-width';
import { provideBracketLabels } from './bracket-labels';
import { BracketRoundsListComponent } from './bracket-rounds-list.component';
import { BracketMatch, BracketRound, BracketRoundSwissGroup } from './linked';
import { BracketDataSource } from './integrations';
import { generateDoubleEliminationBracket, generateSingleEliminationBracket } from './stories/generate-bracket';

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

/** Stands in for a consumer's own cell, to prove the overrides reach the list. */
@Component({
  selector: 'et-test-match',
  template: `<span class="test-match">{{ bracketMatch().id }}</span>`,
})
class TestMatchComponent {
  public bracketRound = input.required<BracketRound<unknown, unknown>>();
  public bracketMatch = input.required<BracketMatch<unknown, unknown>>();
  public bracketRoundSwissGroup = input.required<BracketRoundSwissGroup<unknown, unknown> | null>();
}

@Component({
  template: `
    <et-bracket-rounds-list
      [source]="source()"
      [matchNormalizer]="NORMALIZER"
      [selectedRoundId]="selectedRoundId()"
      [matchComponent]="matchComponent()"
    />
  `,
  imports: [BracketRoundsListComponent],
})
class HostComponent {
  // Signals, not plain fields: a plain field never refreshes a signal input.
  public source = signal<BracketDataSource<null, null>>(generateSingleEliminationBracket(8));
  public selectedRoundId = signal<string | null>(null);
  public matchComponent = signal<typeof TestMatchComponent | undefined>(undefined);

  protected readonly NORMALIZER = normalizer;
}

describe('BracketRoundsListComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const sectionNames = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.et-bracket-rounds-list-section')).map((section) => ({
      id: (section as HTMLElement).dataset['section'],
      name: (section as HTMLElement).querySelector('.et-bracket-rounds-list-section-name')?.textContent?.trim() ?? null,
    }));

  const roundNames = () =>
    Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('.et-bracket-default-round-header-name')).map((el) =>
      el.textContent?.trim(),
    );

  const matchCount = () => fixture.nativeElement.querySelectorAll('.et-bracket-rounds-list-match').length;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders every round of a single-elimination source in one unnamed section', () => {
    expect(sectionNames()).toEqual([{ id: 'all', name: null }]);
    expect(roundNames()).toEqual(['Round 1', 'Round 2', 'Final']);
    expect(matchCount()).toBe(7);
  });

  it('draws the deciding round with the final card', () => {
    expect(fixture.nativeElement.querySelectorAll('.et-bracket-final-host').length).toBe(1);
  });

  it('splits a double-elimination source into upper, lower and finals sections', () => {
    host.source.set(generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }));
    fixture.detectChanges();

    expect(sectionNames()).toEqual([
      { id: 'upper', name: 'Upper bracket' },
      { id: 'lower', name: 'Lower bracket' },
      { id: 'finals', name: 'Finals' },
    ]);
  });

  it('gives the bracket-reset final the final card, not the grand final', () => {
    host.source.set(generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }));
    fixture.detectChanges();

    const finalCards = fixture.nativeElement.querySelectorAll('.et-bracket-final-host');

    expect(finalCards.length).toBe(1);
    expect(finalCards[0].textContent).toContain('Bracket reset');
  });

  it('narrows to a single round when selectedRoundId is set', () => {
    host.selectedRoundId.set('se-r1');
    fixture.detectChanges();

    expect(roundNames()).toEqual(['Round 2']);
    expect(matchCount()).toBe(2);
  });

  it('renders a matchComponent of your own instead of the default card', () => {
    host.matchComponent.set(TestMatchComponent);
    fixture.detectChanges();

    // The final keeps its own card — only the ordinary cells were overridden.
    expect(fixture.nativeElement.querySelectorAll('.test-match').length).toBe(6);
  });

  it('localizes the section headings', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideBracketLabels({ upperBracketSection: 'Oberes Bracket' })],
    }).compileComponents();

    const localized = TestBed.createComponent(HostComponent);
    localized.componentInstance.source.set(generateDoubleEliminationBracket({ participantCount: 8 }));
    localized.detectChanges();

    expect(localized.nativeElement.querySelector('.et-bracket-rounds-list-section-name').textContent).toContain(
      'Oberes Bracket',
    );
  });
});

describe('bracketNaturalWidth', () => {
  it('measures a bracket the way the grid lays it out', () => {
    const source = generateSingleEliminationBracket(8);

    // 2 ordinary columns + the wider final column + 2 gaps.
    expect(bracketNaturalWidth(source, { columnWidth: 200, finalColumnWidth: 300, columnGap: 50 })).toBe(800);
  });

  it('grows with the column width', () => {
    const source = generateSingleEliminationBracket(8);

    expect(bracketNaturalWidth(source, { columnWidth: 300 })).toBeGreaterThan(
      bracketNaturalWidth(source, { columnWidth: 200 }),
    );
  });

  it('needs more room for a double-elimination source than a single-elimination one', () => {
    expect(bracketNaturalWidth(generateDoubleEliminationBracket({ participantCount: 8 }))).toBeGreaterThan(
      bracketNaturalWidth(generateSingleEliminationBracket(8)),
    );
  });
});

describe('bracketFitsWidth', () => {
  const source = generateSingleEliminationBracket(8);
  const config = { columnWidth: 200, finalColumnWidth: 300, columnGap: 50 };

  it('fits at exactly its natural width', () => {
    expect(bracketFitsWidth(source, config, 800)).toBe(true);
  });

  it('does not fit one pixel below it', () => {
    expect(bracketFitsWidth(source, config, 799)).toBe(false);
  });
});
