# Tomflix inventory for slice 3

Source: `~/dev/tomflix/.ethlete/design/calls/tomflix/PLAN.md` and the 49 call folders next to it (numbers 01-49, 17 not in PLAN's Settled list).
Call paths: `foundations/`, `components/`, `elements/`, `pages/` under that folder. A call is written "NN X" (call number, chosen variant).
Read-only research. No code changed. Values are copied from PLAN.md, `call.ts`, `themes.ts` and the chosen drawings.

## 1. Foundations

### Colour: palette "Night teal" (01 D)

Reason: blue-black and cool grey neutrals with a teal-cyan accent. User: "D". Losers: A violet (still the app theme), B cinema red, C marquee amber.
Source for exact values: `foundations/01-palette/variant-d.ts` and `themes.ts` (same values).

| Token        | Light         | Dark          |
| ------------ | ------------- | ------------- |
| bg           | `243 246 248` | `11 15 22`    |
| elevated     | `255 255 255` | `21 28 38`    |
| text         | `16 24 32`    | `230 237 243` |
| muted        | `90 103 117`  | `146 159 173` |
| subtle       | `140 151 163` | `100 113 128` |
| border       | `217 225 232` | `38 49 63`    |
| accent       | `12 122 124`  | `45 212 204`  |
| accentHover  | `10 110 112`  | `94 229 221`  |
| accentActive | `7 90 93`     | `22 184 177`  |
| onAccent     | `255 255 255` | `4 26 30`     |
| ink          | `10 108 112`  | `84 222 214`  |
| success      | `22 101 52`   | `74 222 128`  |

- Dark-elevated border is `44 57 73`; light-elevated bg is `255 255 255` (`themes.ts`).
- Surface themes in `themes.ts`: `dark`, `dark-elevated`, `light`, `light-elevated`. Dark is not marked default for light users: both `dark` and `light` set `isDefault`.
- Interaction colours (`themes.ts`): dark default `146 159 173`, hover/focus `200 210 220`, active `230 237 243`, disabled `70 82 96`. Light default `90 103 117`, hover/focus `50 62 75`, active `16 24 32`, disabled `180 190 200`.
- Colour themes in `themes.ts`: `accent`, `accent-light`, `danger` (type `error`), `danger-light`. Registered by `providers.ts`.
- Design is dark first. Light is secondary.

### Colour: error "rose" (13 C)

Reason: it shares the blue undertone of the Night teal neutrals. Losers: A coral, B signal red.
Values from PLAN: `244 63 94` on dark surfaces, `190 18 60` as `danger-light` on light. Danger buttons use `color="danger"`.
`themes.ts` does not hold these values. See conflict C1.

### Colour: tier metals (14 A, 16 C)

Reason: metals read as a trophy case. Values from `components/14-badge/variant-a.ts`; each has hi / mid / lo / ink.

| Tier    | hi            | mid           | lo           | ink        |
| ------- | ------------- | ------------- | ------------ | ---------- |
| bronze  | `246 200 152` | `184 115 51`  | `104 58 22`  | `88 46 14` |
| silver  | `250 252 255` | `168 178 189` | `88 98 110`  | `64 72 84` |
| gold    | `255 238 170` | `212 160 23`  | `126 88 6`   | `104 70 0` |
| special | `178 252 246` | accent        | `10 104 100` | `4 72 70`  |
| locked  | `74 84 98`    | `46 54 66`    | -            | -          |

- Platin: cool white-blue sheen. Diamant: faceted, stops `250 254 255`, `150 228 255`, `255 178 232`, `196 180 255`, `170 255 226`. Legende: dark medal, ring stops `45 212 204`, `124 120 255`, `236 104 220`, `120 250 170`, `45 212 204`. Source: 16 C, `variant-c.ts`.
- Metals use `var(--color-et-bronze, ...)` style tokens with a fallback.

### Type

| Item          | Value                                                                                         | Source                        |
| ------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| Family        | `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`                  | `apps/tomflix/src/styles.css` |
| Root size     | `font-size: 62.5%` (1rem = 10px); body 1.6rem, line-height 1.4                                | same                          |
| Scale         | xs 12/16, sm 14/20, base 16/24, lg 18/28, xl 20/28, 2xl 24/32, 3xl 30/36, 4xl 36/40, 5xl 48/1 | same                          |
| Seen in calls | 10px, 11px, 12px, 14px; headings 26px mobile / 34px desktop (49); control text 14px (35)      | 40 H, 35 B, 49                |

No call decided the type scale. It comes from the app stylesheet. Reason for the part's note: "inherited from the app, not explored".

### Spacing and radii

| Item            | Value                                                                     | Source           |
| --------------- | ------------------------------------------------------------------------- | ---------------- |
| Base unit       | `--spacing: 0.4rem` (4px)                                                 | app styles.css   |
| Radii           | xs 2px, sm 4px, md 6px, lg 8px, xl 12px, 2xl 16px, 3xl 24px               | app styles.css   |
| Catalog grid    | desktop 7 columns, gutters 20px x / 28px y; mobile 3 columns, 10px / 20px | 37 B             |
| Hero to bar gap | 56px desktop / 48px mobile                                                | 36 C             |
| Control height  | 44px (search, filter, alphabet targets, avatar target)                    | 35 B, 42 A, 44 B |
| Nav padding     | 6px top/bottom per link; avatar inset 8px                                 | 42 A             |
| Poster ratio    | 2:3 (46x69 in wishlist rows, 220px detail poster)                         | 09 A, 07 C       |

Shadows: no call decided a shadow token. Medal shadows are drawn inline in 14 A. Recommendation: define none until a component needs one.

### Motion (08 B "shared poster")

Reason: the tapped poster flies into the detail poster, so the user keeps their place. Values from `foundations/08-motion/variant-b.ts`.

| Token      | Value                          | Use                                             |
| ---------- | ------------------------------ | ----------------------------------------------- |
| flight     | 360ms (back 320ms)             | Poster flight card to detail                    |
| emphasized | `cubic-bezier(0.2, 0, 0, 1)`   | Flight, overlays opening                        |
| decelerate | `cubic-bezier(0, 0, 0, 1)`     | Fade in, sheet slides up                        |
| accelerate | `cubic-bezier(0.3, 0, 1, 1)`   | Everything that leaves                          |
| standard   | `cubic-bezier(0.4, 0, 0.2, 1)` | Scroll, hover lift, colour change               |
| fade       | 280ms                          | Banner and page crossfade                       |
| rise       | 240ms                          | Detail head, 8px rise                           |
| overlay    | 220ms                          | Popover/dialog: fade, 4px rise, scale 0.98 to 1 |
| sheet      | 300ms (exit 200ms)             | Bottom sheet                                    |
| exit       | 160ms                          | Popover and dialog close                        |
| hover      | 180ms                          | Card lifts 2px                                  |
| press      | 100ms                          | Poster scales to 0.97                           |
| reduced    | 150ms                          | Opacity crossfade only                          |

- Other settled motion: alphabet morph 340ms open / 220ms close with animated backdrop-filter (44 B); capsule width spring (38 M); medal sheen on rare tiers (19 A); tier-up charge tremble plus emblem reveal (18 D); return animation plays section in order (17 A).
- App note: Angular `withViewTransitions()`, one `view-transition-name` per poster.

### Logo (02 G, changed by 32 B)

Reason: heavy "T" fading from accent to accentDeep with a slanted shadow under the crossbar, "the netflix direction". User: "i chose G".

- Tokens, dark: accent `45 212 204`, accentDeep `20 135 130`. Favicon and app icon: `ink` tile `11 15 22`, `brand` `45 212 204`, `brandDeep` `16 112 108`.
- Wordmark: `capsWordmark()` in `foundations/02-logo/marks.ts` (condensed caps, 7-unit letter gap, 24px high). T path and mask: `variant-g.ts`.
- 32 B (elements): a single folded T is the initial before "OMFLIX", with media-derived colour from 31 C. See conflict C4.

### CI

No separate CI call exists. Logo, palette and the "Katalog" label rule are the only identity decisions. Label rule (05 A): "Filmkatalog" becomes "Katalog" (en "Catalog") everywhere. UI language: German labels; exploration talk is English.

## 2. Components (generic)

Rule: use the SDK part where one fits (style override through tokens). A "new" part needs a reason.
SDK parts checked in `libs/components/src/lib`: accordion, avatar, badge, banner, button, card, carousel, chip, description-list, divider, empty-state, filter-overlay, focus-ring, forms (input, select, form field, segmented), menu, overlay (popover, dialog, sheet), progress-steps, skeleton, stat-tile, tabs, tooltip, toggletip, and more.

| Part                          | Base                            | States needed                                                                                                                                                       | Chosen shape and reason                                                                                                                                                             | Source               |
| ----------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| button                        | SDK: button                     | filled accent, tonal, icon-only, danger (`color="danger"`), disabled                                                                                                | Hero actions, Filter, dialog actions. Tomflix only sets tokens.                                                                                                                     | 03, 04, 05, 13       |
| version badge                 | SDK: badge                      | 4K, 3D (outline); count                                                                                                                                             | Filter count and version marks.                                                                                                                                                     | 05, 06, 07           |
| avatar                        | SDK: avatar                     | initials, image, accent theme                                                                                                                                       | Header and cast rows.                                                                                                                                                               | 03, 07               |
| form field, search            | SDK: forms (form field + input) | default, focus, query                                                                                                                                               | Search field in the catalog bar.                                                                                                                                                    | 05 A, 06 A           |
| select                        | SDK: forms (select)             | closed, open, inline label                                                                                                                                          | Genre.                                                                                                                                                                              | 05                   |
| segmented switch              | SDK: forms (segmented)          | Alle / Filme / Serien                                                                                                                                               | Removed from the bar by 34 C and 45 C; may stay elsewhere.                                                                                                                          | 05, 06               |
| filter chips                  | SDK: chip                       | selected, removable                                                                                                                                                 | Active criteria (desktop up to 2 in the bar). Call 04 used selection-list chips.                                                                                                    | 04 G, 45 C           |
| card surface                  | SDK: card                       | outlined, filled                                                                                                                                                    | Detail sidebar, cast and season rows.                                                                                                                                               | 07 C                 |
| stat tile                     | SDK: stat-tile                  | label above value                                                                                                                                                   | Detail ratings. The call's tile put the label below; use the SDK order.                                                                                                             | 07 C                 |
| description list, divider     | SDK: description-list, divider  | stacked                                                                                                                                                             | Detail fact lists.                                                                                                                                                                  | 07 C                 |
| popover, dialog, bottom sheet | SDK: overlay                    | open, close; dialog 420px (login), 560px (edit); phone sheet                                                                                                        | Same pattern for login and wishlist. Motion tokens from section 1.                                                                                                                  | 09 A, 10 A, 45 C     |
| empty state                   | SDK: empty-state                | no matches, empty library                                                                                                                                           | Base for 47/49. Tomflix adds the countdown graphic (element).                                                                                                                       | 47, 49               |
| focus ring                    | SDK: focus-ring                 | focus-visible (teal)                                                                                                                                                | Card links.                                                                                                                                                                         | 06 A                 |
| carousel controls             | SDK: carousel                   | prev, next                                                                                                                                                          | Hero arrows.                                                                                                                                                                        | 21                   |
| catalog card                  | new                             | default, hover (2px lift only), focus, no poster (title on placeholder), badge Neu / Neue Staffel / Neue Folge / Neue Folgen / 4K / 3D (one only), subline per kind | No SDK part covers a poster card. Poster, one truncated title line, one subline. Neu beats 4K beats 3D. No brightening on hover ("it fakes colors"). Uses SDK badge and focus-ring. | 40 H (replaces 06 A) |
| poster placeholder            | new                             | title drawn on placeholder                                                                                                                                          | No SDK part draws a title as an image stand-in. Part of the catalog card.                                                                                                           | 06 A, 40 H           |
| medal                         | new                             | tier locked, bronze, silver, gold, special; progress ring 0-100; maxed gold (full ring, glow, star); 92px desktop / 80px phone; hint on hover/focus                 | No SDK part covers a metal achievement medal. Embossed icon, ring fills in the next tier's metal. 4 per row at 560px, 3 at 358px.                                                   | 14 A                 |
| medal tiers 2                 | new (state of medal)            | Platin, Diamant, Legende (animated holographic ring, glow, static under reduced motion)                                                                             | Three rare materials after gold. Thresholds double: Filmfan 500, 1000, 2000; points 4, 5, 6.                                                                                        | 16 C                 |
| medal motion                  | new (state of medal)            | rest (subtle sheen on rare tiers), hover/focus (full sheen), tier-up, reduced motion                                                                                | One sheen language for all rare tiers. Tier-up: charge tremble, emblem reveal, smaller core flash.                                                                                  | 19 A, 18 D           |
| medal hidden                  | new (state of medal)            | silhouette, "???", vague hint; found gets "Geheim" tag                                                                                                              | Keeps the medal shape and invites the hunt.                                                                                                                                         | 20 A                 |
| status tag                    | SDK: badge                      | gewuenscht, bestellt (accent), da                                                                                                                                   | Small tag in a wishlist row. Check the badge covers a text-only tag; else new.                                                                                                      | 09 A                 |
| settings row                  | new                             | normal, link, destructive ("Abmelden")                                                                                                                              | No SDK list-row part found (info-list not checked in detail). Recommend checking `info-list` first.                                                                                 | 12 A                 |

Not SDK-covered, stays tomflix: nav tabs. `et-nav-tabs` needs a Router in the renderer and has no stacked icon-and-label bottom bar (03, 05, 07). Header links and phone tab bar are therefore elements.

## 3. Elements (tomflix-specific)

"Uses" names foundations (F) and components (C). Elements use only F and C. All elements are "new" (product-specific); SDK parts sit in C.

| Element            | States needed                                                                                                                                | Chosen shape and reason                                                                                                                                                                                                                                                       | Uses                                                              | Source                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| header             | over hero (transparent, ambient colour), solid after hero, hidden on scroll down past hero, returns on scroll up or focus; desktop and phone | Transparent over hero, gradually solid as hero exits. Phone header holds only the logo, so hiding is fine. New: no SDK app header.                                                                                                                                            | F colour, F logo, F motion; C avatar (SDK)                        | 28 B, 31 C, 33 C           |
| header logo        | desktop, phone, fades over first 48px scroll on phone                                                                                        | Single folded T as the initial before OMFLIX. Logo and avatar share the media-derived bright accent (contrast min 6.02 at 70%, 4.10 at 100%).                                                                                                                                 | F logo                                                            | 32 B, 31 C, 39 B           |
| header nav         | Katalog, Wunschliste, avatar; past hero: hamburger in a glass capsule, nav inline                                                            | Past the hero the search capsule morphs into nav and account, content-sized (594px nav / 760px search), restrained spring. No popup. New: SDK tabs/menu do not morph a capsule.                                                                                               | F motion; C avatar (SDK)                                          | 05 A, 38 M                 |
| phone tab bar      | Katalog, Wunschliste, Konto (05 A)                                                                                                           | Solid `bg-et-surface-bg`, no see-through. New: no SDK bottom bar. See conflict C3.                                                                                                                                                                                            | F colour; icons                                                   | 03 D, 05 A                 |
| hero               | active slide, neighbours, 4 artworks (Knight, Smile, Smile 2, Dune); desktop and phone                                                       | Cover deck: centred poster card 960x434 desktop / 310x472 phone, neighbours visible, title art on image. Compact neutral pill action. No "Neu im Regal". Visible-bounds logo, natural height: 16px gap phone, 20px desktop. Dots/counter/line rejected; arrows and drag only. | F colour, F motion; C button, carousel controls (SDK)             | 22, 24 A, 25 A, 26 B, 27 A |
| hero ambient       | on/off, strength                                                                                                                             | Static radial gradients from precomputed image palette, diffuse wash behind header. No blur layers, no canvas.                                                                                                                                                                | F colour                                                          | 30 C, 31 C                 |
| catalog search bar | default, sticky, query, active filter chips (desktop up to 2), badge-only (phone), suggestions (desktop only)                                | One-line capsule, 760px centred desktop (356px on a 390 phone), matched 44px controls, inset Filter pill. Desktop: expanding capsule, filter shortcuts, title suggestions, keyboard selection. Phone: direct title search plus Filter only.                                   | C form field, button, badge, chip (SDK); F colour                 | 34 C, 35 B, 46 B, 45 C     |
| filter panel       | Art direct; Genre (searchable), Jahre, Fassung, Sortierung as subpages; draft/apply/discard/reset; count badge excludes sort                 | Overview with focused subpages, rounded rows, Reset beside Apply only when needed, no Cancel. Popover desktop, bottom sheet phone. Check SDK `filter-overlay` first; recommend it as the base.                                                                                | C overlay, button, badge, select (SDK); F motion                  | 45 C                       |
| alphabet           | closed (A-Z in bar), open (morph), selected letter                                                                                           | Search capsule grows downward into the letter field. Controls stay fixed, query kept. Desktop 12 columns; phone 5/6; all targets 44px circles; no heading, arrow or X; 16px inner bottom padding. New: custom morph.                                                          | F motion (340/220ms); C button (SDK)                              | 42 A, 44 B                 |
| catalog grid       | 28 / 55 cards, loading, empty                                                                                                                | 7 columns desktop, 3 phone, gutters as in section 1. Check SDK `grid`/`masonry`; plain CSS grid is enough.                                                                                                                                                                    | C catalog card (new)                                              | 37 B                       |
| catalog empty      | no matches, empty library (separate)                                                                                                         | Direction: cinematic countdown graphic. Geometry not decided. 112px graphic phone / 160px desktop, 26/34px heading, 14px text.                                                                                                                                                | C empty state, button (SDK); F colour                             | 48 B, 49 (open)            |
| detail layout      | desktop, phone                                                                                                                               | 380px banner (phone 210px) under transparent header, 220px poster overlapping (phone 110px), two columns, sticky 320px sidebar.                                                                                                                                               | C card, badge, stat tile, avatar, divider, description list (SDK) | 07 C                       |
| recovery row       | 6 posters, sideways scroll on phone                                                                                                          | Used on not-found: "Vielleicht das hier?".                                                                                                                                                                                                                                    | C catalog card (new)                                              | 11 C                       |

## 4. SDK parts a tomflix part can take from the base

| SDK part                                            | Used for                                                                           | Source         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------- |
| `et-button`                                         | hero actions (filled accent, tonal), Filter, dialogs, danger with `color="danger"` | 03, 04, 05, 13 |
| `et-badge`                                          | version badge, Filter count                                                        | 05, 06, 07     |
| `et-avatar`                                         | header avatar, cast rows (initials)                                                | 03, 07         |
| `et-form-field` + `et-input` (search)               | catalog bar search                                                                 | 05 A, 06 A     |
| `et-segmented-button-group`                         | Alle / Filme / Serien (removed from the bar by 34 C)                               | 05, 06         |
| `et-select`                                         | Genre                                                                              | 05             |
| `et-card` (outlined, filled)                        | detail sidebar, cast and season rows                                               | 07 C           |
| `et-stat-tile`, `et-description-list`, `et-divider` | detail ratings and fact lists                                                      | 07 C           |
| declarative overlay, selection-list chips           | filter panel                                                                       | 04 G           |
| popover, sheet                                      | alphabet (43), filters                                                             | 43, 45         |
| Empty State                                         | catalog empty                                                                      | 47, 49         |
| carousel controls                                   | hero arrows                                                                        | 21             |
| `etFocusRing`                                       | card links                                                                         | 06 A           |

Not in the SDK, stays drawn: poster tile, backdrop banner, app shell, logo, header nav links, phone tab bar, icons. Reasons given: `et-nav-tabs` needs a Router and has no stacked icon-and-label bottom bar; `ng()` takes no providers, so `provideIcons` is unavailable; `et-icon-button` drops a raw SVG.

## 5. Viewport presets

| Preset  | Size                                                     | Evidence                                                        |
| ------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| phone   | 390 x 844                                                | nearly every call; also checks at 358, 356 and 320 (14, 45, 44) |
| desktop | 1280 x 900 (also 1280 x 820; hero-only 1280 x 480 in 21) | nearly every call                                               |

- `frameWidth` is the canvas width of the call (not a viewport): 1740 in 39 calls, 1280 (01, 02), 1420 (08), 1100 (14, 16), 1040 (19), 1000 (13), 980 (40), 720 (20), 700 (18).
- No call uses tablet, fold outer or fold inner. "Intermediate widths" are listed as unfinished in PLAN. Recommendation: ship phone and desktop; add tablet only when a call needs it.
- Measured widths: desktop capsule 760px, phone capsule 356px (45 C).

## 6. Fixture set (`fixtures.ts`)

| Data                     | Content                                                                                                                                                                                                           | Source                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Catalog                  | 55 real titles, 54 real posters (`poster-01.webp` ...), one title without poster. Fields: title, year, kind (Film/Serie), genres, length, rating, certification (FSK), versions (4K, 3D), isNew, hasPoster, angle | `elements/41-catalog-alphabet/fixture.ts` |
| Genres                   | 25 genre keys with German names (Action ... Action & Abenteuer)                                                                                                                                                   | 45 `fixture.ts`                           |
| Filter groups and counts | Art, Genre, Jahre (decade), Fassung, Sortierung; derived from the 55 titles                                                                                                                                       | 45                                        |
| Novelty states           | explicit examples: new movie, new series, new season, one new episode, several new episodes                                                                                                                       | 40 H                                      |
| Search examples          | `action`, `action dark`, `4k dark`, `horror`, `dark`, `xyz`                                                                                                                                                       | 46                                        |
| Hero                     | 4 titles with backdrop `.webp` and title-art `.png`: A Knight of the Seven Kingdoms, Smile, Smile 2, Dune                                                                                                         | 25                                        |
| Card sample              | 15 titles, e.g. A Knight of the Seven Kingdoms (2026, Serie, Drama/Fantasy)                                                                                                                                       | 06                                        |
| Wishlist                 | 17 wishes (Konklave, Severance, Blood & Sinners, The Last of Us, One Battle After Another, Andor, ...), open and done groups, search result set, edit example with history                                        | 09                                        |
| Badges                   | 27 badges: films 612, series 31, episodes 3400, genres (Action 104, Horror 57, Drama 88, ...), decades, community, special; points; last-viewed snapshot                                                          | 15                                        |
| Users and shop           | wished-by names, shop and tracking links, prices                                                                                                                                                                  | 09                                        |
| Labels                   | German UI strings per call (`LABELS`, `STATUS_LABELS`)                                                                                                                                                            | 06, 09, 15                                |

Fixtures reference real posters and logos. Slice 3 must check the rights before they move into a product folder. The Studio fixtures rule says no client names; film titles are not client names, but recommend a short check.
Fixtures sit in several call folders and chain by import (46 imports 45 imports 41). `fixtures.ts` must merge them once.

## 7. Conflicts and open points

### Conflicts

| #   | Conflict                                                                                                                                                                                                                                                | Source                       | Recommendation                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Danger colour. Call 13 C says `244 63 94` / `190 18 60`. `themes.ts` holds `239 68 68` / `185 28 28`. Palette D `error` is `248 113 113` / `185 28 28`.                                                                                                 | 13 C, `themes.ts`, 01 D      | Use call 13 C. Fix `themes.ts` in the slice, then record the change in the note.                                               |
| C2  | Card. 06 A: two-line title, "year · genre", Serie and Neu as tags, hover brightens. 40 H: one line, one subline, no genre, one badge, no brighten. 37 B and 08 still cite 06 A.                                                                         | 06 A, 40 H, 37 B, 08 B       | 40 H wins (later, explicit). Drop brighten from motion. Part of 06 A goes away.                                                |
| C3  | Phone tabs. 05 A: three (Katalog, Wunschliste, Konto). 38 M and 39 B: "five bottom tabs". PLAN does not name the five.                                                                                                                                  | 05 A, 38 M, 39 B             | Ask the user. Recommend three, as no call drew the other two.                                                                  |
| C4  | Logo. 02 G: separate mark plus wordmark. 32 B: single folded T as initial of OMFLIX, media-derived colour. 10 A still draws "logo G".                                                                                                                   | 02 G, 32 B, 31 C, 10 A       | 32 B wins for the header. Keep 02 G as the app icon and favicon.                                                               |
| C5  | Header. 03 C: transparent, solid on scroll, nav Filmkatalog/Filme/Serien/search. 05 A: Katalog, Wunschliste, no search. 33 C: hides on scroll down. 38 M: past the hero the capsule replaces the header on desktop. 08 B: fill fades in as hero leaves. | 03 C, 05 A, 33 C, 38 M, 08 B | Take the latest per part: 05 A labels, 33 C behaviour, 38 M past-hero capsule. List the older calls as superseded in the note. |
| C6  | Filters. 04 G: bar holds search, kind switch, Genre; Jahre, Fassung, Sortierung in a Filter chip. 05 A keeps kind in the bar. 34 C moves genre and type into the overlay. 45 C makes Art direct.                                                        | 04 G, 05 A, 34 C, 45 C       | 45 C wins. Kind switch leaves the bar.                                                                                         |
| C7  | Alphabet. 43 chose D (anchored popover) and E (sheet), then closed as superseded by 44 B. PLAN order lists 42 A.                                                                                                                                        | 42 A, 43, 44 B               | 44 B wins. 43 and 41 are history.                                                                                              |
| C8  | Hero. 04 B "hero" and 03 C hero layout vs cover deck from 22/24.                                                                                                                                                                                        | 04 B, 24 A                   | 24 A wins.                                                                                                                     |
| C9  | Hardcoded colours. Medal drawings use `rgb(...)` metals with `--color-et-*` fallbacks; the app's `medal.ts` has 16 hardcoded occurrences (styling debt). SDK rule forbids a hardcoded primary colour.                                                   | PLAN "Styling debt", 14 A    | Define metals as tomflix tokens in foundations; the medal reads tokens only.                                                   |
| C10 | Hover. 08 B: poster brightens on hover. 40 H: no colour change.                                                                                                                                                                                         | 08 B, 40 H                   | 40 H wins (same as C2).                                                                                                        |

### Open and undecided

| Item                                                                                                                   | Status                                                                                                                | Source                          | Recommendation                                                     |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| 49 empty countdown geometry                                                                                            | A vs B, verdict pending                                                                                               | 49                              | Leave the part out of slice 3 or ship with a note "geometry open". |
| 48 empty character                                                                                                     | B direction only, not approved                                                                                        | 48                              | Same as above.                                                     |
| 47 empty                                                                                                               | all rejected                                                                                                          | 47                              | Drop.                                                              |
| Keyword search / autocomplete syntax                                                                                   | queued, no syntax chosen                                                                                              | PLAN Open                       | Out of scope for slice 3.                                          |
| Empty, loading, error, completion, return state, intermediate widths, mobile keyboard, a11y                            | catalog review list, no treatment chosen                                                                              | PLAN, `plans/catalog-design.md` | Record as states with no drawing.                                  |
| Hero: mobile focal points, autoplay                                                                                    | open                                                                                                                  | 25, 27                          | List as open.                                                      |
| Official 4K/3D/Atmos logos                                                                                             | parked for detail page                                                                                                | PLAN                            | Not a part yet.                                                    |
| Hidden badge eggs, seasonal badges (Spooktober 2026, ends 2026-10-31; past season display open), return animation data | open for app                                                                                                          | PLAN Open 1-3                   | Medal parts only; data stays out.                                  |
| Wishlist, login, account, not-found, detail, achievements                                                              | chosen in design, "Not yet in the app"                                                                                | 07, 09, 10, 11, 12, 15          | Slice 6 pages.                                                     |
| Account page "Darstellung" and "Server settings"                                                                       | invented, not drawn                                                                                                   | 12 A                            | Do not carry into pages.                                           |
| Palette, logo, shell, card, detail, motion, error, login, wishlist, account                                            | "Not yet committed to the app theme"                                                                                  | PLAN                            | Note only.                                                         |
| PLAN workflow item                                                                                                     | "make call.ts the only record", extract medal to `.ethlete/design/system/tomflix/` once accepted; proposed, not ruled | PLAN Open 4                     | Slice 3 is that extraction. Ask the user to accept the medal.      |
| Legacy flags                                                                                                           | 03, 04, 05, 06, 07 should be `closed: 'shipped'`; 21, 22, 23, 29, 43 are `closed: 'superseded'`                       | PLAN Open 5, `call.ts`          | Slice 7 handles legacy calls.                                      |
| Stale CSS                                                                                                              | utility stylesheet needs `touch styles.css` after scaffolding; watch invalidation owed upstream                       | PLAN                            | Design server issue, not tomflix.                                  |

## 8. Pages (slice 6)

- catalog (04, with 37, 45, 46): hero, bar, grid.
- structure (05): shell and nav labels; becomes the header and tab elements.
- card (06): superseded by 40 H; becomes a component.
- detail (07 C): banner, poster, two columns.
- wishlist (09 A): list with add and edit dialogs.
- login (10 A): dialog over the catalog; phone sheet. No route.
- not-found (11 C): recovery first.
- account (12 A): settings list.
- achievements (15 A): sections, medal grids; with return animation (17 A).

## Not classified

- `pages/04-catalog`, `05-structure`, `06-card`: partly shell and card decisions. Split between pages and parts as listed above.
- Calls 21, 22, 23, 29, 41, 43 are superseded. Kept only as history.
- CI: no call or PLAN section defines it. Section 1 states this.
