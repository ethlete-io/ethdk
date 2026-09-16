# The band: direction

Decided 2026-09-16, from the four prototypes in `Kerbe/Band rebuilds` on the timetrack
Storybook (:4401, `npx nx storybook timetrack-app`).

## The choice

**Inlay is the direction. Plate is the runner-up.** Tally and Rule stay in the story as
rejected options, not as candidates.

- **Inlay** — a flat plate with a strip of metal set into its left edge. A band that asks
  nothing carries a short cut at the top. A band that asks is marked down its whole length.

  The first version broke the strip in its middle instead. That read as a hole, not a
  gesture: the break sat at 50% so its position drifted with the band's height, and on a
  2h45m band it floated in the middle of a long run with no reason to be there. The mark's
  own break is a terminal cut, so a mid-run break is not the same gesture.

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

Decided 2026-09-16, from `Kerbe/Full day` on the same Storybook. The story draws the app's
own geometry at the real window size, 1100x760: the four lanes, the narrow break lane, the
all-day strip, two bands that overlap inside one lane, and background stretches.

Inlay holds a full day. Three defects came out of it, all fixed in
`apps/timetrack/src/design/kerbe-band.component.ts`:

- **A run of touching bands read as one slab.** Four bands that meet in one lane share one
  plate tone, and the metal cannot separate them, because the metal already says what each
  band asks. The plate now carries a lit top edge, `1px solid rgb(255 255 255 / 0.09)`.
  That is the plate's own construction and not a gesture, so it adds no meaning.
- **A 15m band clipped its label.** A band under 2.6rem now drops to one tight row, with no
  block padding and a 1.15rem label.
- **The break lane lost its label.** In a lane 6rem wide, "Break" and "45m" do not both fit.
  A container query drops the duration under 10rem. The grid already says how long the band
  is; the label is what the reader needs.

The overlap case needs no new gesture. Two bands that share a minute each take half the
lane, exactly as `day-review/lanes.ts` packs them, and the metal strip stays on the left
edge of each half.

## Open

- The palette is still only in `src/design/kerbe.ts`. It is not registered as an app theme.
- Fonts load from Google in `preview-head.html`. The shipped Tauri app must self-host them.
- Hover, focus, press, drag and the marked-for-merge state are all undrawn.
