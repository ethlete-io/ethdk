import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { BUTTON_IMPORTS } from '../../button';
import { MATCH_CARD_IMPORTS } from '../match.imports';
import { MatchCardSize } from '../headless';
import { NormalizedMatch, NormalizedMatchParticipant, NormalizedMatchResultKind } from '../match.types';

@Component({
  selector: 'et-sb-match-card',
  template: `
    <div
      [etProvideSurface]="surface()"
      [attr.dir]="rtl() ? 'rtl' : null"
      class="text-medium flex flex-col gap-8 p-8 font-sans"
    >
      <section class="flex flex-col gap-4">
        <p class="text-small m-0 opacity-60">
          One component, three layouts. The card is its own container query: drag <code>width</code> across 320px and it
          switches from the dense row a bracket column needs to the featured card, and across 560px the two sides stop
          stacking and face each other. <code>size</code> pins any one of them.
        </p>

        <!-- px, not a max-w-* class: the playground's root font is 62.5%, so the rem container scale is 62.5% of
             what its name says — and here the exact width is the thing being demonstrated. -->
        <div [style.inline-size.px]="width()">
          @if (interactive()) {
            <!-- The card renders its own content and its own accessible name (an aria-label bound by the
                 headless directive), neither of which the template linter can see. -->
            <!-- eslint-disable-next-line @angular-eslint/template/elements-content -->
            <a
              [match]="match()"
              [size]="size()"
              [showSeeds]="showSeeds()"
              [hideNames]="hideNames()"
              (click)="stayHere($event)"
              et-match-card
              href="#"
            ></a>
          } @else {
            <et-match-card [match]="match()" [size]="size()" [showSeeds]="showSeeds()" [hideNames]="hideNames()" />
          }
        </div>

        @if (status() === 'live') {
          <div class="flex gap-2">
            <button (click)="addGoal('home')" class="self-start" et-button size="xs" variant="transparent">
              Goal for {{ match().home?.name }}
            </button>
            <button (click)="addGoal('away')" class="self-start" et-button size="xs" variant="transparent">
              Goal for {{ match().away?.name }}
            </button>
          </div>

          <p class="text-small m-0 opacity-60">
            The score sits in a polite, atomic live region, so each goal is announced once as "{{ scoreText() }}" rather
            than digit by digit. Animating the change is a later step — the announcement is not.
          </p>
        }
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, BUTTON_IMPORTS, ProvideSurfaceDirective],
})
export class MatchCardStorybookComponent {
  public surface = input('dark');
  public width = input(360);
  public size = input<MatchCardSize>('auto');
  public status = input<NormalizedMatch['status']>('finished');
  public resultKind = input<NormalizedMatchResultKind>('score');
  public series = input(false);
  public tbd = input(false);
  public longNames = input(false);
  public showSeeds = input(false);
  public hideNames = input(false);
  public interactive = input(true);
  public rtl = input(false);

  private extraGoals = signal({ home: 0, away: 0 });

  protected match = computed<NormalizedMatch>(() => {
    const status = this.status();
    const scheduled = status === 'scheduled';
    const extra = this.extraGoals();
    const kind = this.resultKind();

    // Which result form a competition reports is its own decision, so the adapter's — here it is a story
    // control. `outcome` needs no values at all: the card derives W/L/D from `winnerSide`.
    const values = kind === 'points' ? { home: 3, away: 0 } : null;

    return {
      id: 'm-1',
      status,
      startTime: KICK_OFF,
      home: this.longNames() ? LONG_HOME : HOME,
      away: this.tbd() ? null : this.longNames() ? LONG_AWAY : AWAY,
      homeScore: scheduled ? null : (values?.home ?? 2 + extra.home),
      awayScore: scheduled ? null : (values?.away ?? 1 + extra.away),
      resultKind: kind,
      gameScores: this.series() && !scheduled ? GAME_SCORES : null,
      winnerSide: status === 'finished' ? 'home' : null,
      label: 'Quarter-final 2',
    };
  });

  // Concatenated rather than interpolated: an interpolated template literal above an inline template
  // desynchronises the Angular language service inside it (`ethlete/no-template-literal-before-inline-template`).
  protected scoreText = computed(() => this.match().homeScore + ' : ' + this.match().awayScore);

  protected addGoal(side: 'home' | 'away') {
    this.extraGoals.update((goals) => ({ ...goals, [side]: goals[side] + 1 }));
  }

  // Real cards are `routerLink`s; this is an href only so it behaves like one without a route to go to.
  protected stayHere(event: Event) {
    event.preventDefault();
  }
}

@Component({
  selector: 'et-sb-match-card-states',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-4">
        <h3 class="text-large m-0">Every state, at bracket width and at card width</h3>
        <p class="text-small m-0 opacity-60">
          The same eight matches at three widths: 220px lands on the dense row, 400px on the featured card with the
          per-game breakdown, and 620px on the wide row where the two sides face each other. Scheduled, live, finished,
          a best-of-three, a best-of-seven, table points, W/L outcomes, and a TBD slot.
        </p>

        <div class="flex flex-wrap items-start gap-8">
          <div [style.inline-size.px]="220" class="flex flex-col gap-2">
            @for (match of MATCHES; track match.id) {
              <et-match-card [match]="match" />
            }
          </div>

          <div [style.inline-size.px]="400" class="flex flex-col gap-2">
            @for (match of MATCHES; track match.id) {
              <et-match-card [match]="match" />
            }
          </div>

          <div [style.inline-size.px]="620" class="flex flex-col gap-2">
            @for (match of MATCHES; track match.id) {
              <et-match-card [match]="match" />
            }
          </div>
        </div>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, ProvideSurfaceDirective],
})
export class MatchCardStatesStorybookComponent {
  public surface = input('dark');

  protected readonly MATCHES = STATE_MATCHES;
}

// Below the components on purpose: an interpolated template literal above an inline `template:` breaks the
// Angular language service inside it — see the `ethlete/no-template-literal-before-inline-template` rule.
//
// Inline SVG data URIs rather than remote crests, so the story renders identically offline and in CI.
const emblem = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="34" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const HOME: NormalizedMatchParticipant = {
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  emblem: { defaultSrc: emblem({ label: 'FCB', fill: '#00ffa1' }) },
  seed: 1,
};

const AWAY: NormalizedMatchParticipant = {
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: 'Neon Gaming Group',
  emblem: { defaultSrc: emblem({ label: 'NEO', fill: '#00d0ff' }) },
  seed: 8,
};

const LONG_HOME: NormalizedMatchParticipant = {
  ...HOME,
  name: 'Sportverein Werder Bremen von 1899',
};

const LONG_AWAY: NormalizedMatchParticipant = {
  ...AWAY,
  name: 'Königsblau Gelsenkirchen Esports Academy',
};

const THIRD: NormalizedMatchParticipant = {
  id: 'rlp',
  name: 'Rote Löwen Pankow',
  code: 'RLP',
  subtitle: null,
  emblem: { defaultSrc: emblem({ label: 'RLP', fill: '#ffd000' }) },
  seed: 4,
};

// A fixed date, so the story reads the same on every run — the card formats it in the active locale.
const KICK_OFF = new Date('2026-05-02T18:30:00Z');

// A best-of-three: the headline 2 : 1 is games won, and these are the games.
const GAME_SCORES = [
  { home: 13, away: 11 },
  { home: 8, away: 13 },
  { home: 13, away: 9 },
];

// A best-of-seven that went the distance — a Rocket League series looks like this.
const BO7_GAME_SCORES = [
  { home: 3, away: 1 },
  { home: 0, away: 2 },
  { home: 4, away: 3 },
  { home: 1, away: 5 },
  { home: 2, away: 1 },
  { home: 0, away: 3 },
  { home: 4, away: 2 },
];

const STATE_MATCHES: NormalizedMatch[] = [
  {
    id: 'scheduled',
    status: 'scheduled',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Match 1',
  },
  {
    id: 'live',
    status: 'live',
    startTime: KICK_OFF,
    home: HOME,
    away: THIRD,
    homeScore: 1,
    awayScore: 1,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Match 2',
  },
  {
    id: 'finished',
    status: 'finished',
    startTime: KICK_OFF,
    home: THIRD,
    away: AWAY,
    homeScore: 0,
    awayScore: 3,
    resultKind: 'score',
    gameScores: null,
    winnerSide: 'away',
    label: 'Match 3',
  },
  {
    id: 'series',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: AWAY,
    homeScore: 2,
    awayScore: 1,
    resultKind: 'score',
    gameScores: GAME_SCORES,
    winnerSide: 'home',
    label: 'Semi-final',
  },
  {
    id: 'bo7',
    status: 'finished',
    startTime: KICK_OFF,
    home: AWAY,
    away: THIRD,
    homeScore: 4,
    awayScore: 3,
    resultKind: 'score',
    gameScores: BO7_GAME_SCORES,
    winnerSide: 'home',
    label: 'Semi-final 2',
  },
  {
    id: 'points',
    status: 'finished',
    startTime: KICK_OFF,
    home: HOME,
    away: THIRD,
    homeScore: 3,
    awayScore: 0,
    resultKind: 'points',
    gameScores: null,
    winnerSide: 'home',
    label: 'Matchday 14',
  },
  // A competition that reports only who advanced. The W/L letters come from `winnerSide`, so this row
  // still says "FC Berlin won" to a screen reader — and carries no numbers at all.
  {
    id: 'outcome',
    status: 'finished',
    startTime: KICK_OFF,
    home: THIRD,
    away: HOME,
    homeScore: null,
    awayScore: null,
    resultKind: 'outcome',
    gameScores: null,
    winnerSide: 'away',
    label: 'Group B',
  },
  {
    id: 'tbd',
    status: 'scheduled',
    startTime: null,
    home: HOME,
    away: null,
    homeScore: null,
    awayScore: null,
    resultKind: 'score',
    gameScores: null,
    winnerSide: null,
    label: 'Grand Final',
  },
];
