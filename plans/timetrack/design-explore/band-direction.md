# The band: direction

Decided 2026-09-16, from the four prototypes in `Kerbe/Band rebuilds` on the timetrack
Storybook (:4401, `npx nx storybook timetrack-app`).

## The choice

**Inlay is the direction. Plate is the runner-up.** Tally and Rule stay in the story as
rejected options, not as candidates.

- **Inlay** — a flat plate with a strip of metal set into its left edge. The strip is
  broken while the band asks nothing, and closes when it asks. The break is the mark's own
  gesture, and it carries a meaning rather than decorating.
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

## Open

- Inlay against a full day: four project columns, overlapping bands, the all-day strip.
- The palette is still only in `src/design/kerbe.ts`. It is not registered as an app theme.
- Fonts load from Google in `preview-head.html`. The shipped Tauri app must self-host them.
- Hover, focus, press, drag and the marked-for-merge state are all undrawn.
