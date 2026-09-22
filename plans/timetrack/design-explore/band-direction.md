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
`.ethlete/design/calls/timetrack/shared/kerbe-band.component.ts`:

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

## Call 4: where a break goes

Decided 2026-09-17, from `kerbe/04-break-lane`. The app gave a break its own 6rem column, and
every band in it repeated the column header. Four whole days at 1100x760, one per answer.

**B, a rule across the day, wins.** A break leaves the lanes and becomes a stretch across all
of them, so the work lanes take the 6rem back. It says what a break is: the absence of work in
every lane at once, and not a track running beside them.

- **A, the column stays and the word goes** — rejected. The band drops "Break" and keeps its
  length, which fixes the repeated word but not the column. A break still reads as a parallel
  track, and 6rem is spent all day on two events.
- **C, a mark in the hour gutter** — rejected. The break leaves the field and marks the clock
  instead. A strip with no word has to be learned, and a 15m break is 2rem of it.
- **D, the day closes up** — rejected. A break costs no height and the rows meet at a seam.
  The hour axis then stops being linear, so a band's height and its place no longer read off
  the same scale. Every other call so far leans on that scale.

The call left two things open, both named by the user on 2026-09-17, and both taken up in
call 5.

## Call 5: a break that is not empty

Decided 2026-09-17, from `kerbe/05-break-not-empty`. Call 4 assumed no band overlaps a break. That is
wrong: an agent can run while nobody is at the machine, so a break is not proof that nothing
happened. Every frame adds one agent band at 12:30 for 45m, which starts inside the 12:15
break and ends 15m after it. The 15:30 break stays empty, so both cases read in one picture.

The label moved out of the gutter and into the block in all three options, as the user asked.

**B, the break is a frame and not a fill, wins.** Two hairlines and a label, no wash at all.
Nothing is behind a band, so nothing can contradict it.

- **A, the work sits on the break** — rejected. The wash is a claim that the lane was idle, and
  the band contradicts that claim in the same pixels.
- **C, the break parts around the work** — rejected. The washed and unwashed cells make one rule
  look broken, and the label can still land over a band in the first lane.

## Call 6: how a break says it is a break

Decided 2026-09-17, from `kerbe/06-break-label`. Seven rounds and twenty-four options, because
the first two rounds were rejected whole. The frame from call 5 has to say "break" where a band
cannot cover the answer, and the gutter is not free either, because the hour labels live there.
The fixture runs three agents across the 12:15 break, one per lane, so **no** lane is idle
through it; the 15:30 break keeps every lane idle and is 15m long. Every option has to hold both
ends. Do not change that fixture.

**The answer is the chain K → N → Q → T → W.** The break is two 2px rules across the full width
of the day, with the lane lines cut between them. Its block in the gutter is hatched, and a
pause sign sits centred in that block on its own ground plate. Under 3rem the bars drop to 8px
and the plate halves its padding, so the plate keeps 4px clear of each rule.

Two rendering faults were found by drawing this call, and both fixes must stay:

- `.hour` carries a `transform`, so it is a stacking context and a `z-index` inside it could
  never beat the break's `z-index: 3`. The `z-index` sits on `.hour` itself now. Before that, a
  heavy rule drew straight through `13:00`.
- The pause bars were 2px with a 3.5px gap. At a fractional display scale a 2px bar is 2.5
  device pixels, the two bars land on different subpixel phases, and one renders wider. They are
  4px wide with a 4px gap now, so the width and the pitch are whole device pixels at 1.25, 1.5,
  2 and 3.

### The rounds

| Round    | What it asked                  | Answer                  |
| -------- | ------------------------------ | ----------------------- |
| r1 (A-C) | the word inside the lanes      | all rejected            |
| r2 (D-I) | a mark instead of the word     | all rejected, too quiet |
| r3 (J-L) | the same ideas, turned up      | **K**                   |
| r4 (M-P) | K, and a name with it          | **N**                   |
| r5 (Q-S) | a sign in place of the word    | **Q**                   |
| r6 (T-V) | how the sign sits on the hatch | **T**                   |
| r7 (W-X) | the 15m break                  | **W**                   |

**r1, the word inside the lanes.** A label in the band area, on whatever ground it needs.
Rejected whole: _"the plate breaks the frame rule, maybe it could be just a visual indicator
rather than the word and time?"_ A plate under the word is a fill, and call 5 threw fills out.
A took its own ground, B took the first idle lane, C stayed in the gutter as the app does today.

**r2, a mark and no word.** D, E and F drew at the left edge of the gutter, where no band
reaches. G, H and I used a pattern instead of a line: G is D with a texture, H puts the pattern
in the rules, I runs a hatch across the whole day and over the bands, which re-opens call 5.
All six rejected: _"still quiet aint it."_

**r3, the same three ideas turned up. K wins.** The frame goes heavy: 2px rules across the full
width, with the lane lines cut between them. J gave the gutter a block, L made the hatch coarse.
K holds the day apart, but a mark alone never says the word "break".

**r4, K with a name. N wins.** The word sits in the gutter on a hatched gutter block. M put the
word on K alone, O hatched the day behind it, P turned the word down the gutter. Two faults came
out of N: the word is pinned to the top, so a 15m break is nearly all word, and a word has to be
translated.

**r5, a sign in place of the word. Q wins.** A pause sign, centred in the block, so it needs no
translation and it sits in the middle of a 15m break. R drew a cup, S left the block empty. The
bars still read as noise on the hatch behind them.

**r6, how the sign sits on the hatch. T wins.** The sign gets its own ground plate. U cut the
sign out of the hatch, which only interrupts hairline strokes, so the sign nearly disappeared. V
used weight alone, and the hatch still ran between the bars.

**r7, the 15m break. W wins.** The sign shrinks and keeps its ground, so the plate T was chosen
for survives the short break. X dropped the plate under 3rem and put the bars back on the hatch,
which is the noise T was drawn to fix.

## Call 7: what the axis gives the reader to measure with

Decided 2026-09-17, from `kerbe/07-hour-axis`. The app books in 15m increments and the axis
marks only the hour, so three of every four band edges meet no mark. Four whole days, each one
changing only what the axis says between one hour label and the next.

**B, quarter ticks in the gutter, wins.** The field keeps the hour line and nothing else. Each
15m step draws a 0.5rem tick at the right edge of the gutter, 0.9rem at the half hour. The scale
sits where no band can cover it, and the field stays quiet behind the bands, which is what call
5 decided when it threw out the wash.

Its cost is named and accepted: the break's gutter block owns the gutter for its own height, so
the ticks stop across a break. The measure also sits away from the band, so a lane on the right
is read across the day.

- **A, the hour alone** — rejected. It is what the app draws today. A band that starts at 09:45
  meets no mark, so the reader counts the quarter by eye against a band four lanes away.
- **C, the half hour crosses the field** — rejected. B, plus a line at 3% white across the whole
  field at :30. It doubles the lines behind the bands, and that is the place call 5 cleared.
- **D, the gutter is a ruler and the field is clean** — rejected. Nothing crosses at all, and the
  gutter carries the whole scale: a 2px notch at the hour, 1rem at the half, 0.5rem at the
  quarter. It is the most on-brand of the four and the least useful at this width, because a band
  in the rightmost lane then cannot be lined up with a time at a glance.

The gutter stayed 5rem in all four frames. **How wide the gutter should be is still open**, and
so are the hour labels themselves; this call changed neither.

## Call 8: what a lane header carries

Decided 2026-09-17, from `kerbe/08-lane-headers`. Three rounds and ten options. A lane is one
checkout, and its header named it and nothing else, so nothing on screen said where the day went.
This is the first call drawn without the story strip.

**The answer is B with I's ink.** The header carries the checkout name and the lane's total on one
row, in the mono it already uses, at one size. The name takes `--k-ink` and the total
`--k-ink-3`, so the column says what it is first and the number waits to be looked for.

**r1, what the header carries. B wins.** The lane total is the one fact the column below cannot
show, and it is text in the frame, so it claims nothing about any minute. It is the honest form
of what the cut story strip was reaching for.

- **A, the name alone** — rejected. What the app draws today. The reader adds the bands in a
  column by eye, or reads the day total and cannot break it down.
- **C, the total and a brass bar for the share** — rejected. Brass says a band asks the reader for
  something. A brass bar sized by a lane's share makes the same metal mean size.
- **D, the count of what still asks** — rejected. The column below already says this in metal, so
  the header repeats what the reader can see, and it says nothing once a lane is answered.

**r2, which of the two leads. All three rejected**, in the user's words: _"i think we should do
this only using font color."_ E made the total 1.5rem, F made the name 1.2rem, G stacked them on
two rows. Size and row count are not available; the hierarchy comes from the ink alone.

**r3, the same row and only the ink. I wins.** H put `--k-ink` on the total, which made four
numbers the loudest row on screen, above a field this exploration keeps quiet throughout. J
lifted the total one step to `--k-ink-2`, which does not separate the two at 1.05rem mono.

One defect was found by drawing r1 and is fixed in every r2 and r3 frame: `.head-lane` sets
`text-transform: uppercase`, which ran over the time as well, so r1 drew `7H 45M` while the title
bar drew `7h 15m`. A clock is not a tag.

## Call 9: what the clock column costs the day

Decided 2026-09-17, from `kerbe/09-gutter`. One round, four options. Call 7 settled what the axis
marks and left the gutter at 5rem with `08:00` in mono; neither number was ever designed. The
width and the label are one answer, because the label is what the width allows.

**B, a 3.4rem gutter and the bare hour, wins.** The label drops the `:00` and keeps two digits,
right-aligned, at 1.05rem in `--k-ink-3`, which is how it is set today. The day gets 1.6rem of
every screen back.

- **A, 5rem and `08:00`** — rejected. What the app draws today. Three of the five characters never
  change, because every label sits on an hour.
- **C, 2.6rem and no leading zero** — rejected. `8` and `13` leave the column ragged on both edges,
  and at 2.6rem the two-digit hours overhang their box by 2px. 2.8rem would seat them, but the
  ragged edge is the reason and not the two pixels.
- **D, 6.4rem and the label at 1.3rem in `--k-ink-2`** — rejected. It tested whether the scale
  should be easy to read. It made the quietest part of the frame the largest text outside the title
  bar, over a field every call since 5 has kept quiet.

Drawing it found one thing a shipped change has to carry: the gutter width is not three CSS rules
but nine. Besides the gutter itself, the hour label and the quarter tick, it sets where the field
starts for the break block, its hatch, its edges, its sign, the now marker and the lane grid. The
shell binds one `--k-gutter` custom property and reads it in all six of the rest.

## Cut: the all-day story strip

Decided 2026-09-17 by the user: _"i think its bloat for this specific view."_ The strip is not a
call. It is removed, and no option is drawn for it.

It ships today in `apps/timetrack/src/app/day-review/day-timeline.component.ts:191`. It draws one
band per story: `stories` at :525 groups the day's rows by `row.storyKey`, drops a row whose
`storyKey` is missing or equal to its own `issueKey`, and keeps a story only when more than one
row sits under it. A band spans the earliest to the latest of those rows and shows the story key
with a count of rows under it. A click opens the first row under it.

Four things are wrong with it, and three are structural:

- **It counts rows, not time.** A row is a `ReviewedRow`, a worklog proposal. How many rows an
  epic broke into is a fact about the review list, not about the day.
- **Its length is a false claim.** A bar on a time axis has to mean time. This one runs from the
  first row to the last, with breaks, other epics and other lanes inside it. That is the defect
  call 5 threw out, where a wash claimed a lane was idle and a band contradicted it.
- **It appears only when the Jira hierarchy is filled in**, so it is not a place a reader can
  learn to look.
- It costs fixed height at the top of every day.

The question under it stays real: what did today go into? It is answered as a total, in the
totals area, and never as geometry over the axis. It is not an open call, because no drawing
fixes a bar that cannot mean what its length says.

**Owed:** the sketch shells under `.ethlete/design/calls/timetrack/` still draw the strip, and
calls 1 to 7 were judged with it in the picture. Every shell drawn from now on leaves it out.
Removing it from the shipped `day-timeline.component.ts` is a code change, not a drawing, and it
waits for the user to call it.

## Open calls

Stated by the user on 2026-09-17: **nothing in the app is cut in stone.** The three calls
above settled the band. Everything else the scheduler draws was never designed, so each item
below is a rework and not a fix. Take one at a time, in the order the user asks for.

### The scheduler's frame

- **Whether a break still shortens when work lands in it.** A break is derived from a gap, so
  an event inside the gap arguably ends the break at that minute. That is a data question, not
  a drawing one, and call 5 draws only the picture. Raised 2026-09-17.
- ~~The gutter width, and the hour labels themselves.~~ **Decided 2026-09-17.** See call 9.
- ~~The all-day story strip above the axis.~~ **Cut, 2026-09-17.** See below.
- **The scheduler's chrome**: the date, the day total, and the controls. **Drawn and parked**,
  2026-09-17, in `kerbe/10-chrome`. Two things came out of drawing it. The bar belongs to the
  scheduler and not to the window, so the product name does not go in it at all, which rejected
  options A and D. What is left is B and C, which differ only by whether the day total stays. The
  call cannot resolve, because every button in it is a placeholder: **the button treatment is not
  defined yet, and it is the call that has to come first.**

### Direct manipulation, none of which is drawn

- **Resize handles** on a band's top and bottom edge.
- **The drag ghost** in the slot the band came from. The sketch fades the band in place, which
  is only half of a drag.
- **How the rest of the lane reacts** while a band moves or resizes: whether the neighbours
  reflow, and whether that is animated.
- **A band being added**, and how it arrives.
- **A break the user adds, edits or removes.** Stated by the user on 2026-09-17: a pause is not
  only derived from a gap, the user makes one. Calls 4 to 6 drew a break as a read-only rule
  across the day, with no handle on it and no way to place one. Raised 2026-09-17, not drawn.

### A band state with no drawing

- **Currently active, still collecting.** The band that is still growing at the bottom of the
  day. It is not one of the six states in `kerbe/ref-band-states`.
- **The current time marker.** The sketch draws a dot on a line; it was never judged.

### Carried over

- The palette is still only in `src/design/kerbe.ts`. It is not registered as an app theme.
- Fonts load from Google in `src/design/head.html`. The shipped Tauri app must self-host them.

## Where the calls live

The three calls above were drawn on the timetrack Storybook, which is gone. Every call now
lives under `.ethlete/design/calls/timetrack/`, one folder each, and `yarn design` serves
them on http://localhost:4402. A folder holds `call.ts`, a shared `fixture.ts` and one
`option-*.ts` per option. A folder named `ref-*` is a view: one reference picture that
answers no question.

| Slug                                            | What it is                                  |
| ----------------------------------------------- | ------------------------------------------- |
| `kerbe/00-treatment`                            | the four band treatments, Inlay chosen      |
| `kerbe/01-separator`                            | what cuts a run of touching bands, A chosen |
| `kerbe/02-short-bands`                          | what a 15m band gives up, B chosen          |
| `kerbe/03-narrow-lane`                          | a lane too narrow for both, A chosen        |
| `kerbe/04-break-lane`                           | where a break goes, B chosen                |
| `kerbe/05-break-not-empty`                      | a break that is not empty, B chosen         |
| `kerbe/06-break-label`                          | how a break says it is a break, W chosen    |
| `kerbe/07-hour-axis`                            | what the axis marks, B chosen               |
| `kerbe/08-lane-headers`                         | what a lane header carries, B with I's ink  |
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
