# Sport UI recipes

Compositions, not components. Everything on this page is built from pieces the library already
ships — [`et-match-card`](/components/match), [`et-match-participant`](/components/match#participants-on-their-own),
[`et-picture`](/components/picture), [`et-scrollable`](/components/scrollable),
[`et-chip`](/components/chip), [`et-skeleton`](/components/skeleton) — because their fields differ per
product far too much to normalize. Copy one, change the fields, own it.

If a recipe here turns out to be universal across products, it gets promoted to a component. None of these
have yet.

## Today's matches rail

The horizontal "what's on today" strip. This is the one recipe that was scoped as a component
(`et-match-list`) and deliberately wasn't built: `et-scrollable` already snaps, scrolls element by element,
sizes children per breakpoint and scrolls the active child into view, so the component would have been
pass-through inputs and nothing else.

<StoryEmbed id="components-sport-recipes--match-rail" height="360px" />

```html
<div class="rail-header">
  <h3>Today</h3>
  <a routerLink="/matches">All matches</a>
</div>

<et-scrollable [itemSize]="{ xs: 'full', md: 'half', lg: 'third' }" scrollableClass="gap-3" scrollableRole="list" snap>
  @for (match of matches(); track match.id) {
  <div [etScrollableActiveChild]="match.status === 'live'" role="listitem">
    <a [match]="match" [routerLink]="['/matches', match.id]" class="grid h-full" et-match-card></a>
  </div>
  }
</et-scrollable>
```

Four details worth keeping:

- **The gap goes on the scroll container**, via `scrollableClass` — `et-scrollable` reads its computed value
  to work out how wide a half- or third-width child is, so there is no `gap` input to set instead.
- **`etScrollableActiveChild` on the live match** — the rail opens on the match that's being played rather
  than at the start of the week.
- **The wrapper carries `role="listitem"`**, not the card. The card owns its own role (a labelled group), so
  a `role` set on it from outside is overwritten.
- **`grid h-full` on the card** equalises the heights: a live card has a badge row the others don't, and a
  rail of different heights looks broken. Plain Tailwind utilities win over component CSS because component
  styles live in the `components` cascade layer — see [overriding component styles](/components/#overriding-component-styles).

## Competition, team, player and nation cards

All four are the same shape: an image, a name, some metadata, and a link around the whole thing. A nation
card is a team card with a flag in the emblem slot; a squad list is a column of player cards.

<StoryEmbed id="components-sport-recipes--entity-cards" height="520px" />

```html
<!-- competition -->
<a [routerLink]="['/competitions', competition.id]" class="competition-card">
  <et-picture [defaultSrc]="competition.banner" [aspectRatio]="16 / 9" [alt]="competition.name" />

  <div class="competition-card-text">
    <span class="competition-card-name">{{ competition.name }}</span>
    <span class="competition-card-meta">{{ competition.matchdayLabel }}</span>
  </div>

  <div class="competition-card-tags">
    <et-chip size="sm">{{ competition.sport }}</et-chip>
    <et-chip size="sm">{{ competition.teamCount }} teams</et-chip>
  </div>
</a>
```

```html
<!-- team, player or nation: the participant primitive already draws the emblem, name, subtitle and seed.
     On an <a> it becomes the link itself, named after the participant. -->
<div class="entity-card">
  <a [participant]="participant" [routerLink]="['/teams', participant.id]" et-match-participant showSeed></a>
  <span class="entity-card-meta">{{ record }}</span>
</div>

<!-- the same card while the API is still answering -->
<div class="entity-card">
  <et-match-participant [participant]="null" loading />
  <et-skeleton-item shape="text" />
</div>
```

`et-match-participant` is doing the work here: the emblem frame keeps its size whether or not an image
arrived, `subtitle` gives you the org under the roster name, and `loading` draws its own bones so the card
doesn't need a second layout for the pending state. On an `<a>` or `<button>` it also names itself after the
participant — without that the link would read "FC Berlin emblem FC Berlin".

## Where the real components are

| You want                       | Use                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| A match, in any density        | [`et-match-card`](/components/match)                                  |
| One side of a match, anywhere  | [`et-match-participant`](/components/match#participants-on-their-own) |
| A league or group table        | [`et-standings`](/components/standings)                               |
| A bracket                      | [`et-bracket`](/components/bracket)                                   |
| A horizontal strip of anything | [`et-scrollable`](/components/scrollable)                             |
