---
status: accepted
open: B508
decided: 2026-11-14
source: doc-agent session 2026-11-14, morning rounds 1-3 on the fifagg migration questions
---

# The FIFA look stays, and the SDK grows generic parts for it

The fifagg migration to SDK components keeps the FIFA look. The human: "wichtig aber weiterhin dass der Fifa Look
erhalten bleibt." and "Match Card hier müssen wir auch aufpassen dass die im Fifa Look bleibt. Unser defsult Look
weicht stark ab." The SDK provides tokens, slots and headless layers; the app supplies the look.

## Migration decisions

- All fifagg slices already built with pick A stay, except the breadcrumb, which goes back to the FIFA look.
- All open fifagg recommendations are accepted, except the carousel: "bis auf karusell das sollte den Look behalten."
- Match-card standings (MC-7) move to `et-standings`, in the FIFA look.
- Theme names `fefhg` and `fifae` are registered by fifagg if fitting colours exist: "Sonst einfach default also Blue".
- The nested double fade is accepted (9.6a A). Merge requests !2032 and !2033 merge together.
- Comboboxes with "load more" (17 fields) show a manual "more options" template that loads the next page through the
  select query adapter (`selectOptionsFromV2Query`, `hasMoreItems`/`loadMore`). The human: "wir zeigen das more
  options Template mit manuellen nachladen mit dem select query Adapter. Gleiches bei tables".
- Contentful icons: a list of today's names maps to icons, with a fallback icon for new ones.

## SDK asks (all generic; the FIFA look stays in the app)

- Menu: a loading state on a menu item. No bottom sheet for `et-menu`; it opens at its trigger. The human on the
  iOS pattern: "wenn dein Finger eh schon beim Button ist welcher das Menu öffnet ist es komisch nun den Finger wieder
  wandern zu lassen weil das Menü unten klebt." The overlay gets an action-sheet look/strategy for choices about an
  action: "wir könnten aber schon einen Action Sheet Look / strategy schon haben. Die sieht ja etwas anders aus als ein
  normales bottom Sheet." Its look is a Studio sketch.
- Progress steps and timeline get a headless layer and a generic content slot, a skipped status, and a status on the
  timeline item; no horizontal scrolling. The human: "Unsere Komponente sollte eher so adaptiv sein dass die damit
  klar kommt aber generisch bleiben. Vielleicht ist das ein guter Ort für die headless Variante."
- Carousel: controls over the image, and a placeable pause button (the pause button stays required).
- Upload: a crop step, more data on existing files, a compact single-file row, a server response per file. The human:
  "wir brauchen hier aber nicht komplett ngx Image Cropper nachbauen. Nur das sinnvolle."
- Match card, through its headless layer: expandable `et-standings` rows first, then a badge slot, a loading state,
  country plus flag on a participant, a cancelled status, and font tokens.
- Table: a column visible from a breakpoint, in the SDK.
- Icons: a build-time check of icon names. No spin state ("bei Spinnern können wir auch die echte Komponente nehmen"),
  no scan generator.
- Overlay: a `backdropClick` event. No fade-in state, no picture-in-picture top layer.
- `et-stat-tile` alignment and rank; `et-picture` image focal crop.
- `et-collapse` for height expand.

The human answered "Q2ok" to the round-1 summary and "R2 ok", "R3 ok" in round 3.
