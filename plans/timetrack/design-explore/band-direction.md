# The band: direction

Decided 2026-09-16, from the four prototypes now in `kerbe/00-treatment`.

## The choice

**Inlay is the direction. Plate is the runner-up.** Tally and Rule stay in the story as
rejected options, not as candidates.

- **Inlay** — a flat plate with a strip of metal set into its left edge. The strip runs the
  band's whole length, and its colour alone says what the band asks.

  Two earlier versions of the strip are gone. The first broke it in its middle, which read
  as a hole and not a gesture: the break sat at 50%, so its position drifted with the band's
  height, and on a 2h45m band it floated in a long run with no reason to be there. The
  second cut the strip short — 1.6rem from the top — on a band that asks nothing. Decided
  2026-09-16: a partial line looks like a defect next to a full one, so length carries no
  meaning any more. Only colour does.

- **Plate** — a raised panel framed in the metal, with corner brackets that close on a band
  that asks. Kept as the fallback.
- **Tally** — rejected. The notch column is the most on-brand of the four and the quietest,
  but the metal alone cannot separate two bands that touch.
- **Rule** — rejected. Elegant, and two touching bands run into each other.

## The rule the treatment carries

**The metal says what a band asks of the reader.** It does not say how sure the matcher
was. This is the inversion of what the app does today, where `certain` is the loudest thing
on screen and needs no attention at all.

| Ask                      | Metal               |
| ------------------------ | ------------------- |
| nothing                  | dim grey            |
| a glance                 | brass `#D6B569`     |
| an answer, a yes or a no | lit brass `#F0E0B4` |
| a ticket, later          | patina `#3FB39A`    |

## Where deco is allowed

Ornament marks a threshold, never a workspace. Three layers:

1. **Frame** — title bar, the mark, the widget, the empty state. Never scrolls, never
   repeats. Spend freely.
2. **Act** — buttons. Flat at rest, deco on hover, press and load, then gone.
3. **Field** — the day list, the tables, the forms. The band lives here. One gesture only,
   and that gesture must carry a meaning.

If a thing can appear twenty times on one screen, it gets no ornament.

## Fixed in this round

- A 45m band could not hold three lines. The duration now shares the label's row, and the
  band drops `from` because the grid already says where it sits.
- The break band lost its label at short heights. Same fix.

## The full day, and what it changed

Decided 2026-09-16, from the picture now in `kerbe/ref-full-day`. It draws the app's own
geometry at the real window size, 1100x760: the four lanes, the narrow break lane, the
all-day strip, two bands that overlap inside one lane, and background stretches.

Inlay holds a full day. Three defects came out of it, all fixed in
`apps/timetrack/src/design/kerbe-band.component.ts`:

- **A run of touching bands read as one slab.** Four bands that meet in one lane share one
  plate tone, and the metal cannot separate them, because the metal already says what each
  band asks. The plate now carries a lit top edge, `1px solid rgb(255 255 255 / 0.09)`.
  That is the plate's own construction and not a gesture, so it adds no meaning.
- **A 15m band clipped its label.** A band under 2.6rem now drops to one tight row, with no
  block padding. Call 2 later settled what that row looks like.
- **The break lane lost its label.** In a lane 6rem wide, "Break" and "45m" do not both fit.
  A container query drops the duration under 10rem. The grid already says how long the band
  is; the label is what the reader needs.

The overlap case needs no new gesture. Two bands that share a minute each take half the
lane, exactly as `day-review/lanes.ts` packs them, and the metal strip stays on the left
edge of each half.

## The states under the pointer

Drawn in `kerbe/ref-band-states`, and checked again inside a packed lane on
`kerbe/ref-full-day`.
Chromium's `CSS.forcePseudoState`, over a CDP session, holds `:hover`, `:focus-visible` and
`:active` open at once, so all six states are judged from one image.

**No state touches the metal.** The strip says what the band asks of the reader, and a
pointer over a band says nothing about that. The plate answers instead.

| State  | What it does                                                              |
| ------ | ------------------------------------------------------------------------- |
| hover  | the plate lifts to `--k-panel-hi` and its top edge lights to 20% white    |
| focus  | a 2px ring in `--k-ink-2`, on three sides                                 |
| press  | the plate goes down to `--k-ground`                                       |
| drag   | the band drops to 0.7 opacity and the grid reads through it               |
| marked | the plate lifts, and two brackets in lit brass close on the right corners |

Two of these were found by drawing them, not by planning them:

- **The focus ring leaves the left edge free.** A four-sided ring runs over the metal strip,
  and a focused band then cannot say what it asks. It is three inset shadows and not an
  `outline`, for two reasons: an outline cannot leave one side out, and an outline paints
  above every descendant, so it would cover the strip even at full width. A transparent
  outline carries the ring into forced-colors mode.
- **Marked for a merge is the one state that earns ornament.** It is chosen by hand, it is
  rare, and two at once is the whole point of it, so it cannot appear twenty times on one
  screen. It reuses Plate's corner brackets, on the edge away from the metal.

## Call 1: what cuts a run of touching bands

Decided 2026-09-16, from `kerbe/01-separator`. Four bands of
`lane:ethlete-sdk` meet from 08:45 to 12:15 with no ground between them, so they share one
plate tone, and the metal cannot cut them apart because the metal already says what each
band asks. The same run, drawn four ways in one lane.

**A, the lit top edge, wins.** Each plate carries `1px solid rgb(255 255 255 / 0.09)` along
its top. It is the plate's own construction and carries no meaning, so it adds nothing to
what the metal says. Its cost is that it also draws on the first band of a run, where
nothing touches.

- **B, a cut of ground** — rejected. The top pixel is `--k-ground`, so the run reads as
  separate slabs and the line vanishes by itself where nothing touches. It takes a pixel off
  every plate, and a 15m band has few to spare.
- **C, alternating tone** — rejected. Every second plate lifts by about 3% white. The tone is
  a band property with no meaning, and it collides with hover, which also lifts.
- **D, nothing** — rejected. The metal restarts at each band, and four bands still read as
  one slab.

All four stay in the call, the three losers marked `rejected`. The `separator` input on
`KerbeBandComponent` defaults to `edge`, so every other story draws the winner.

## Call 2: what a 15m band gives up

Decided 2026-09-16, from `kerbe/02-short-bands`.

**The app books in 15m increments, so 15m is the only length that is a problem.** A band is
as tall as the time it covers, at 8rem to the hour, so 15m is 2rem and a padded row needs
3.2rem. 30m gets 4rem and holds one with room to spare. An earlier draw of this call used a
20m rung and found a clipping window between 2.6rem and 3.2rem; no real band lands there.

**B, the same type centred, wins.** A 15m band drops its block padding and its duration. Its
label stays at 1.3rem and sits centred in the 2rem. The detail still goes at 5.2rem, which is
the same rule as before.

- **A, smaller type** — rejected. It was what the sketch did: the label went to 1.15rem. The
  label then changes size down a column, and a 15m band reads as a lesser kind of band.
- **C, keep the duration** — rejected. Both do fit on one row in 2rem, but the grid already
  says the band is 15m, so the number repeats what the reader can see.

The `shrink` input on `KerbeBandComponent` defaults to `plain`, which is B.

## Call 3: a lane too narrow for both

Decided 2026-09-17, from `kerbe/03-narrow-lane`. The break lane is 6rem
wide, so "Break" and "45m" cannot share a row. A 15m band has no duration at any width, from
call 2, so all three options draw that one the same.

**A, the duration goes, wins.** Under 10rem the band hides its duration and keeps the label
on one row. This is the rule the sketch already had. It has to hold for any lane that gets
narrow, not only the break lane.

- **B, the duration moves under** — rejected. The head becomes two rows, and a 15m band has
  room for one, so it falls back to A anyway. Two rows in a 30m band leave no ground, and the
  type sits tighter than anywhere else in the app.
- **C, the label goes** — rejected. It is right for the break lane alone, where the lane
  header already says "Break". A work lane that falls to 10rem would lose its ticket, which
  is the one thing the reader needs.

The `narrow` input on `KerbeBandComponent` defaults to `drop-time`, which is A.

## Open calls

Stated by the user on 2026-09-17: **nothing in the app is cut in stone.** The three calls
above settled the band. Everything else the scheduler draws was never designed, so each item
below is a rework and not a fix. Take one at a time, in the order the user asks for.

### The scheduler's frame

- **The break lane.** A 6rem column whose bands repeat its own header. The column, the label,
  and the idea that a break is a band in a lane at all are open.
- **The hour axis** down the left side: the hour labels, the lines, the gutter width.
- **The lane headers** across the top - the category columns.
- **The all-day story strip** above the axis.
- **The window chrome**: the title bar, the date, the day total.

### Direct manipulation, none of which is drawn

- **Resize handles** on a band's top and bottom edge.
- **The drag ghost** in the slot the band came from. The sketch fades the band in place, which
  is only half of a drag.
- **How the rest of the lane reacts** while a band moves or resizes: whether the neighbours
  reflow, and whether that is animated.
- **A band being added**, and how it arrives.

### A band state with no drawing

- **Currently active, still collecting.** The band that is still growing at the bottom of the
  day. It is not one of the six states in `kerbe/ref-band-states`.
- **The current time marker.** The sketch draws a dot on a line; it was never judged.

### Carried over

- The palette is still only in `src/design/kerbe.ts`. It is not registered as an app theme.
- Fonts load from Google in `src/design/head.html`. The shipped Tauri app must self-host them.

## Where the calls live

The three calls above were drawn on the timetrack Storybook, which is gone. Every call now
lives under `apps/timetrack/src/design/calls/`, one folder each, and `yarn design` serves
them on http://localhost:4402. A folder holds `call.ts`, a shared `fixture.ts` and one
`option-*.ts` per option. A folder named `ref-*` is a view: one reference picture that
answers no question.

| Slug                                            | What it is                                  |
| ----------------------------------------------- | ------------------------------------------- |
| `kerbe/00-treatment`                            | the four band treatments, Inlay chosen      |
| `kerbe/01-separator`                            | what cuts a run of touching bands, A chosen |
| `kerbe/02-short-bands`                          | what a 15m band gives up, B chosen          |
| `kerbe/03-narrow-lane`                          | a lane too narrow for both, A chosen        |
| `kerbe/ref-full-day`                            | the whole day at 1100x760                   |
| `kerbe/ref-band-states`                         | the six states under the pointer            |
| `timeline/ref-states`, `timeline/ref-durations` | the block sketch the band replaced          |

Check a call before you look at it:

```bash
node tools/design-explore/check-call.mjs --lint <changed files> --tsconfig tools/design-explore/tsconfig.json
```

## How this exploration runs

Agreed with the user on 2026-09-16, after a session that ran too far alone.

1. **One open call at a time.** I take a single question, draw its options as real frames,
   and stop. I never carry two calls into one stop.
2. **I put the options in the call and name my pick.** Two to four options side by side,
   labelled, with what each one costs. My pick is a proposal. The user chooses. No
   screenshots - the user keeps the page open.
3. **Nothing is committed until the user says commit.** Sketch code waits in the working
   tree between stops.

A finding is not a licence to pick the fix.
