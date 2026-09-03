import { NgComponentOutlet } from '@angular/common';
import { booleanAttribute, Component, computed, input, numberAttribute, Type, ViewEncapsulation } from '@angular/core';
import { BRACKET_DATA_LAYOUT } from './core';
import { BracketContinueComponent, BracketMatchComponent, BracketRoundHeaderComponent } from '@ethlete/bracket';
import { MATCH_CARD_SIZES, MatchCardSize } from '../match';
import { BracketDataSource } from './integrations';
import { BracketMatch, BracketRound, createBracket } from './linked/bracket';
import { BracketRoundSwissGroup } from './linked/swiss';
import { BRACKET_CARD_CONTEXT, BracketMatchNormalizer } from './bracket-card-context';
import { resolveBracketComponents, usesBracketFinalCard } from './bracket-components';
import { injectBracketLabels } from './bracket-labels';
import { BracketLayout, resolveBracketLayout } from './bracket-layout';
import { BRACKET_DEFAULTS, injectBracketConfig } from './bracket.config';

/**
 * One header and the matches under it: a round, or - in a swiss stage, where a round is drawn as several
 * standings groups - one group of one round.
 */
export type BracketRoundsListBlock<TRoundData, TMatchData> = {
  /** Unique among the rendered blocks; a swiss round contributes one per group. */
  id: string;
  round: BracketRound<TRoundData, TMatchData>;
  swissGroup: BracketRoundSwissGroup<TRoundData, TMatchData> | null;
  matches: BracketMatch<TRoundData, TMatchData>[];
};

/**
 * A run of rounds under a shared heading. Double elimination has three - the winners bracket, the losers
 * bracket, and the deciding rounds; a layout without a `listSection` hook is one unnamed section.
 */
export type BracketRoundsListSection<TRoundData, TMatchData> = {
  id: string;
  /** `null` for the single section of a source that needs no dividing. */
  name: string | null;
  blocks: BracketRoundsListBlock<TRoundData, TMatchData>[];
};

/**
 * The same tournament as [`<et-bracket>`](/components/bracket), drawn as a vertical list of rounds
 * instead of a connected grid - the representation that survives a phone, a blog column, or a
 * match-day page.
 *
 * It takes the same `BracketDataSource`, resolves the same cards through the same
 * `provideBracketConfig`, and reads your matches through the same `matchNormalizer`, so switching
 * between the two representations costs nothing but the `@if`. What it drops is everything a narrow
 * column can't show: the connector lines and the journey highlight that rides on them.
 *
 * **Not a fallback only.** A list of "who plays whom this round" is the right thing on a match-day page
 * however much room there is.
 *
 * @example
 * <et-bracket-rounds-list [source]="source()" />
 *
 * @example
 * <!-- one round at a time, driven by your own tabs -->
 * <et-bracket-rounds-list [source]="source()" [selectedRoundId]="roundId()" />
 */
@Component({
  selector: 'et-bracket-rounds-list',
  templateUrl: './bracket-rounds-list.component.html',
  styleUrl: './bracket-rounds-list.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [NgComponentOutlet],
  // The same contract `et-bracket` provides, so the shipped cards work identically in both.
  providers: [{ provide: BRACKET_CARD_CONTEXT, useExisting: BracketRoundsListComponent }],
  host: {
    class: 'et-bracket-rounds-list-host',
  },
})
export class BracketRoundsListComponent<TRoundData = unknown, TMatchData = unknown> {
  private config = injectBracketConfig();
  private labels = injectBracketLabels();

  public source = input.required<BracketDataSource<TRoundData, TMatchData>>();

  /**
   * Render only this round, by its id in the source. `null` (the default) stacks every round - set it
   * from a tab bar or a select to page through a long tournament instead.
   */
  public selectedRoundId = input<string | null>(null);

  /**
   * The layouts this instance may draw with, replacing the `provideBracketConfig` list entirely -
   * see {@link BracketLayout}. The list draws no grid, but it asks the matching layout how to group
   * (swiss standings groups) and section (double elimination's brackets) the rounds, and which cards
   * are its defaults. A source nothing matches throws `ET3413`, same as `<et-bracket>`.
   */
  public layouts = input<readonly BracketLayout<TRoundData, TMatchData>[] | undefined>(undefined);

  public hideRoundHeaders = input(this.config.hideRoundHeaders ?? BRACKET_DEFAULTS.hideRoundHeaders, {
    transform: booleanAttribute,
  });

  public roundHeaderComponent = input<BracketRoundHeaderComponent<TRoundData, TMatchData> | undefined>();
  public matchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();
  public finalMatchComponent = input<BracketMatchComponent<TRoundData, TMatchData> | undefined>();

  /** Unused here - the list draws no continue element - and accepted so the two hosts take the same bindings. */
  public continueComponent = input<BracketContinueComponent<TRoundData, TMatchData> | undefined>();

  /**
   * How to read your match data, for the **default** cards - see {@link BracketMatchNormalizer}. Cards of
   * your own get the match through their inputs and need none of this.
   */
  public matchNormalizer = input<BracketMatchNormalizer<TRoundData, TMatchData> | undefined>();

  /** The `aria-level` the default round headers announce themselves at. @default 3 */
  public roundHeaderLevel = input(this.config.roundHeaderLevel ?? BRACKET_DEFAULTS.roundHeaderLevel, {
    transform: numberAttribute,
  });

  /** @internal The normalizer in effect, read by the default cards through `BRACKET_CARD_CONTEXT`. */
  public resolvedMatchNormalizer = computed<BracketMatchNormalizer | null>(
    () => this.matchNormalizer() ?? this.config.matchNormalizer ?? null,
  );

  /** @internal The heading level in effect, read by the default round headers. */
  public resolvedRoundHeaderLevel = computed(() => this.roundHeaderLevel());

  /**
   * @internal The featured card, pinned. A list row is as wide as the page it sits in, and an unpinned
   * final measuring that would flip to the wide side-by-side arrangement past 560px while every dense
   * row above it stayed as it was.
   */
  public resolvedFinalMatchCardSize = computed<MatchCardSize>(() => MATCH_CARD_SIZES.EXPANDED);

  /**
   * The layout answering for this source - see the `layouts` input. Resolved even though the list draws
   * no grid: the grouping/sectioning hooks and the per-layout cards live on it, and a mode the app never
   * registered should fail the same loud way in both representations.
   */
  private resolvedLayout = computed(() =>
    resolveBracketLayout<TRoundData, TMatchData>(
      this.layouts() ?? (this.config.layouts as readonly BracketLayout<TRoundData, TMatchData>[] | undefined),
      this.source().mode,
    ),
  );

  /**
   * Always built left-to-right, whatever the layout's own fold is: a mirrored layout splits a round in
   * two halves with synthetic ids, which is a statement about where cells sit on a canvas and means
   * nothing in a list.
   */
  public bracketData = computed(() => createBracket(this.source(), { layout: BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT }));

  /** The section heading sits one level above the round headers it covers. */
  protected sectionHeadingLevel = computed(() => Math.max(1, this.resolvedRoundHeaderLevel() - 1));

  private components = computed(() =>
    resolveBracketComponents(
      {
        roundHeader: this.roundHeaderComponent(),
        match: this.matchComponent(),
        finalMatch: this.finalMatchComponent(),
      },
      this.config,
      this.resolvedLayout().components,
    ),
  );

  protected sections = computed<BracketRoundsListSection<TRoundData, TMatchData>[]>(() => {
    const layout = this.resolvedLayout();
    const bracket = this.bracketData();
    const swissGroups = layout.listGrouping?.(bracket) ?? null;
    const selectedRoundId = this.selectedRoundId();
    const labels = this.labels();
    const sections = new Map<string, BracketRoundsListSection<TRoundData, TMatchData>>();

    for (const round of bracket.rounds.values()) {
      if (selectedRoundId !== null && round.id !== selectedRoundId) continue;

      const { id, name } = layout.listSection?.(round, bracket, labels) ?? { id: 'all', name: null };
      const section = sections.get(id) ?? { id, name, blocks: [] };

      sections.set(id, section);

      // A swiss round is several standings groups drawn under their own headers, the way the grid draws
      // them; every other round is one block.
      const groups = swissGroups?.get(round.id)?.groups;

      if (groups) {
        for (const group of groups.values()) {
          if (!group.matches.size) continue;

          section.blocks.push({
            id: `${round.id}--${group.id}`,
            round,
            swissGroup: group,
            matches: Array.from(group.matches.values()),
          });
        }
      } else {
        section.blocks.push({
          id: round.id,
          round,
          swissGroup: null,
          matches: Array.from(round.matches.values()),
        });
      }
    }

    return Array.from(sections.values());
  });

  /**
   * Which component draws a block's matches - the deciding round gets the final card here just as it does
   * in the grid.
   */
  protected matchComponentFor(block: BracketRoundsListBlock<TRoundData, TMatchData>): Type<unknown> {
    const components = this.components();
    const component = usesBracketFinalCard(block.round, this.bracketData()) ? components.finalMatch : components.match;

    return component as Type<unknown>;
  }

  protected roundHeaderComponentFor(): Type<unknown> {
    return this.components().roundHeader as Type<unknown>;
  }
}
