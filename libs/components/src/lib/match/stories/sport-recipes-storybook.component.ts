import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { CHIP_IMPORTS } from '../../chip';
import { PICTURE_IMPORTS } from '../../picture';
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS } from '../../scrollable';
import { SKELETON_IMPORTS } from '../../skeleton';
import { MATCH_CARD_IMPORTS } from '../match.imports';
import { NormalizedMatch, NormalizedMatchParticipant } from '../match.types';

/**
 * The "today's matches" rail - the reason `et-match-list` was never built. `et-scrollable` already snaps,
 * scrolls element by element, sizes children per breakpoint and scrolls the active one into view; a component
 * around it would be pass-through and nothing else.
 */
@Component({
  selector: 'et-sb-match-rail',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-4 p-8 font-sans">
      <div class="flex items-baseline justify-between">
        <h3 class="text-large m-0">Today</h3>
        <a class="text-small opacity-60" href="#">All matches</a>
      </div>

      <!-- The gap lives on the scroll container, which is what scrollableClass targets - the scrollable reads
           its computed value to work out how wide a half/third-width child is. -->
      <et-scrollable
        [itemSize]="{ xs: 'full', md: 'half', lg: 'third' }"
        etScrollableSnap
        scrollableClass="gap-3"
        scrollableRole="list"
      >
        <!-- The wrapper carries the list semantics: the card owns its own role (a labelled group), so asking
             it to also be a listitem would just be overwritten. -->
        @for (match of matches(); track match.id) {
          <div [etScrollableActiveChild]="match.status === 'live'" role="listitem">
            <!-- The two utilities equalise the cards: a live one has a badge row the others don't, and a rail
                 of different heights looks broken. Plain utilities win over component CSS here because the
                 component styles live in the components cascade layer. -->
            <et-match-card [match]="match" class="grid h-full" />
          </div>
        }
      </et-scrollable>

      <p class="text-small m-0 opacity-60">
        The live match is the scrollable's active child, so the rail opens on it rather than at the start.
        <code>itemSize</code> is per breakpoint: one card on a phone, three on a desktop.
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS, ProvideSurfaceDirective],
})
export class SportRecipesMatchRailStorybookComponent {
  public surface = input('dark');

  protected matches = computed(() => RAIL_MATCHES);
}

/**
 * Competition, team and player cards: composition exercises, not components. Their fields differ per product
 * far too much to normalize, and every one of them is `et-picture` plus type plus the participant primitive.
 */
@Component({
  selector: 'et-sb-sport-entity-cards',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-4">
        <h3 class="text-large m-0">Competition card</h3>

        <a
          [style.max-inline-size.px]="320"
          class="flex flex-col gap-3 rounded-xl p-4"
          href="#"
          style="background: var(--et-surface-background-solid); border: 1px solid var(--et-surface-border-solid)"
        >
          <et-picture
            [defaultSrc]="BANNER"
            [aspectRatio]="16 / 9"
            class="overflow-hidden rounded-lg"
            alt="Regionalliga Nordost"
          />

          <div class="flex flex-col gap-1">
            <span class="text-medium font-semibold">Regionalliga Nordost</span>
            <span class="text-small opacity-60">Matchday 14 · 2026/27</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <et-chip size="sm">Football</et-chip>
            <et-chip size="sm">18 teams</et-chip>
          </div>
        </a>
      </section>

      <section class="flex flex-col gap-4">
        <h3 class="text-large m-0">Team and player cards</h3>

        <div class="flex flex-wrap gap-4">
          @for (participant of PARTICIPANTS; track participant.id) {
            <div
              [style.inline-size.px]="240"
              class="flex flex-col gap-3 rounded-xl p-4"
              style="background: var(--et-surface-background-solid); border: 1px solid var(--et-surface-border-solid)"
            >
              <!-- On an anchor: the whole participant is the link, named after the participant rather than
                   after its emblem's alt text plus the same name again. -->
              <!-- eslint-disable-next-line @angular-eslint/template/elements-content -->
              <a [participant]="participant" (click)="stayHere($event)" et-match-participant href="#" showSeed></a>
              <span class="text-small opacity-60">10 matches · 8 wins</span>
            </div>
          }

          <!-- The same card while the API is still answering: the primitive draws its own bones. -->
          <div
            [style.inline-size.px]="240"
            class="flex flex-col gap-3 rounded-xl p-4"
            style="background: var(--et-surface-background-solid); border: 1px solid var(--et-surface-border-solid)"
          >
            <et-match-participant [participant]="null" loading />
            <et-skeleton-item shape="text" />
          </div>
        </div>

        <p class="text-small m-0 opacity-60">
          A nation card is the same thing with a flag in the emblem slot; a squad list is a column of these. Nothing
          here is a library component - that is the point.
        </p>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [MATCH_CARD_IMPORTS, PICTURE_IMPORTS, CHIP_IMPORTS, SKELETON_IMPORTS, ProvideSurfaceDirective],
})
export class SportRecipesEntityCardsStorybookComponent {
  public surface = input('dark');

  protected readonly BANNER = BANNER_SRC;
  protected readonly PARTICIPANTS = RECIPE_PARTICIPANTS;

  // Real cards are `routerLink`s; this is an href only so it behaves like one without a route to go to.
  protected stayHere(event: Event) {
    event.preventDefault();
  }
}

// Below the components on purpose: an interpolated template literal above an inline `template:` breaks the
// Angular language service inside it.
const crest = (config: { label: string; fill: string }) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      `<rect width="100%" height="100%" fill="${config.fill}"/>` +
      '<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="30" text-anchor="middle" ' +
      `dominant-baseline="middle">${config.label}</text></svg>`,
  );

const BANNER_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<rect width="100%" height="100%" fill="#123b2f"/>' +
      '<text x="50%" y="50%" fill="#00ffa1" font-family="sans-serif" font-size="34" text-anchor="middle" ' +
      'dominant-baseline="middle">Regionalliga Nordost</text></svg>',
  );

const team = (config: {
  id: string;
  name: string;
  code: string;
  subtitle: string | null;
  fill: string;
  seed: number;
}) => ({
  id: config.id,
  name: config.name,
  code: config.code,
  subtitle: config.subtitle,
  emblem: { defaultSrc: crest({ label: config.code, fill: config.fill }) },
  seed: config.seed,
});

const HOME: NormalizedMatchParticipant = team({
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  fill: '#00ffa1',
  seed: 1,
});

const AWAY: NormalizedMatchParticipant = team({
  id: 'neo',
  name: 'Neon Esports',
  code: 'NEO',
  subtitle: 'Neon Gaming Group',
  fill: '#00d0ff',
  seed: 4,
});

const THIRD: NormalizedMatchParticipant = team({
  id: 'rlp',
  name: 'Rote Löwen Pankow',
  code: 'RLP',
  subtitle: null,
  fill: '#ffd000',
  seed: 7,
});

const RECIPE_PARTICIPANTS = [HOME, AWAY];

const KICK_OFF = new Date('2026-05-02T18:30:00Z');

const railMatch = (config: {
  id: string;
  home: NormalizedMatchParticipant;
  away: NormalizedMatchParticipant;
  status: NormalizedMatch['status'];
  homeScore: number | null;
  awayScore: number | null;
  winnerSide: 'home' | 'away' | null;
}): NormalizedMatch => ({
  id: config.id,
  status: config.status,
  startTime: KICK_OFF,
  home: config.home,
  away: config.away,
  homeScore: config.homeScore,
  awayScore: config.awayScore,
  resultKind: 'score',
  gameScores: null,
  winnerSide: config.winnerSide,
  label: null,
});

const RAIL_MATCHES: NormalizedMatch[] = [
  railMatch({ id: 'r1', home: HOME, away: AWAY, status: 'finished', homeScore: 2, awayScore: 1, winnerSide: 'home' }),
  railMatch({ id: 'r2', home: AWAY, away: THIRD, status: 'live', homeScore: 1, awayScore: 1, winnerSide: null }),
  railMatch({
    id: 'r3',
    home: THIRD,
    away: HOME,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerSide: null,
  }),
  railMatch({
    id: 'r4',
    home: HOME,
    away: THIRD,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerSide: null,
  }),
  railMatch({
    id: 'r5',
    home: AWAY,
    away: HOME,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    winnerSide: null,
  }),
];
