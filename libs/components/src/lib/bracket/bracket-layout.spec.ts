import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RoundStageStructureWithMatchesView } from '@ethlete/types';
import '../../test-helpers';
import { NormalizedMatch } from '../match';
import { BracketMatchNormalizer } from './bracket-card-context';
import { BRACKET_ERROR_CODES } from './bracket-errors';
import { BracketLayout, resolveBracketLayout } from './bracket-layout';
import { BracketComponent } from './bracket.component';
import { provideBracketConfig } from './bracket.config';
import { TOURNAMENT_MODE } from './core/tournament';
import { BracketDataSource } from './integrations';
import { generateBracketDataForEthlete } from './integrations/ethlete';
import {
  doubleEliminationBracketLayout,
  mirroredSingleEliminationBracketLayout,
  singleEliminationBracketLayout,
  swissBracketLayout,
} from './layouts';
import { BracketSwissStylesComponent } from './layouts/swiss/bracket-swiss-styles.component';
import { ET_DUMMY_DATA_SWISS } from './stories/dummy-data';
import { generateDoubleEliminationBracket } from './stories/generate-bracket';

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

const swissSource = () =>
  generateBracketDataForEthlete(ET_DUMMY_DATA_SWISS as unknown as RoundStageStructureWithMatchesView[]);

@Component({
  template: `<et-bracket [source]="source()" [layouts]="layouts()" [matchNormalizer]="NORMALIZER" />`,
  imports: [BracketComponent],
})
class HostComponent {
  // Signals, not plain fields: a plain field never refreshes a signal input.
  public source = signal<BracketDataSource<unknown, unknown>>(
    generateDoubleEliminationBracket({ participantCount: 8, includeFinal: true }),
  );
  public layouts = signal<readonly BracketLayout<unknown, unknown>[] | undefined>(undefined);

  protected readonly NORMALIZER = normalizer;
}

describe('resolveBracketLayout', () => {
  it('throws ET3413 for a mode nothing was registered for, naming the factory that fixes it', () => {
    expect(() =>
      resolveBracketLayout([singleEliminationBracketLayout()], TOURNAMENT_MODE.SWISS_WITH_ELIMINATION),
    ).toThrowError(/swissBracketLayout\(\)/);

    expect(() => resolveBracketLayout(undefined, TOURNAMENT_MODE.SWISS_WITH_ELIMINATION)).toThrowError(
      new RegExp(`ET${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}.*swiss-with-elimination`),
    );
  });

  it('takes the first registered layout whose mode matches, so a mirrored entry can win', () => {
    const layout = resolveBracketLayout(
      [mirroredSingleEliminationBracketLayout(), singleEliminationBracketLayout()],
      TOURNAMENT_MODE.SINGLE_ELIMINATION,
    );

    expect(layout.dataLayout).toBe('mirrored');
    expect(layout.name).toBe('single-elimination-mirrored');
  });
});

describe('the layouts input', () => {
  it('replaces the provideBracketConfig list rather than adding to it', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      // Only single elimination app-wide — the double-elimination source below would throw on this alone.
      providers: [provideBracketConfig({ layouts: [singleEliminationBracketLayout()] })],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);

    fixture.componentInstance.layouts.set([doubleEliminationBracketLayout()]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.et-bracket-element--match').length).toBeGreaterThan(0);
  });

  it('throws ET3413 when neither the input nor the config answers for the source', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);

    expect(() => fixture.detectChanges()).toThrowError(new RegExp(`ET${BRACKET_ERROR_CODES.LAYOUT_NOT_REGISTERED}`));
  });
});

describe('swissBracketLayout', () => {
  it('mounts its group border styles while a swiss bracket renders', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);

    fixture.componentInstance.source.set(swissSource());
    fixture.componentInstance.layouts.set([swissBracketLayout()]);
    fixture.detectChanges();

    // The mounted instance in the style manager's hidden container is what carries the group border CSS
    // into the document — asserting the `<style>` itself is not possible here, since the test build
    // strips component stylesheets.
    expect(document.querySelector('.et-style-manager et-bracket-swiss-styles')).toBeTruthy();
    expect(swissBracketLayout().styles).toContain(BracketSwissStylesComponent);
  });

  it('draws no swiss styles for an elimination bracket', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);

    fixture.componentInstance.layouts.set([doubleEliminationBracketLayout()]);
    fixture.detectChanges();

    expect(document.querySelector('et-bracket-swiss-styles')).toBeNull();
  });
});
