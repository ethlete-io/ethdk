# Accordion

A disclosure: a header that expands a panel. One `<et-accordion>` is a complete
disclosure on its own; wrap several in an `<et-accordion-group>` to get optional
single-open behavior and arrow-key navigation between the headers. Colours come from
the [surface and color theming](/core/theming) systems, so it reads correctly on any
surface it sits on.

```ts
import { ACCORDION_IMPORTS } from '@ethlete/components';
```

```html
<et-accordion-group autoCloseOthers>
  <et-accordion label="How long does shipping take?" isOpenByDefault>
    Orders leave the warehouse within a day and arrive in two to four working days.
  </et-accordion>

  <et-accordion label="Returns">Send anything back within 30 days.</et-accordion>
</et-accordion-group>
```

## Live demo

<StoryEmbed id="components-layout-accordion--default" height="420px" />

## Anatomy

| Piece                | What it is                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `et-accordion`       | One disclosure: a `role="heading"` wrapper around a `<button>` trigger, plus the collapsible panel it controls.                  |
| `et-accordion-group` | A stack of accordions separated by hairlines, with single-open and arrow-key navigation.                                         |
| `etAccordionLabel`   | `ng-template` slot replacing the plain `label` text when the header needs markup.                                                |
| `etAccordionHint`    | `ng-template` slot for secondary header content, rendered between the label and the chevron.                                     |
| `etAccordionContent` | `ng-template` slot whose content is created on the first expand instead of up front - see [Deferred content](#deferred-content). |

### Accordion inputs

| Input             | Default | Description                                                                                               |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `label`           | `''`    | The header text. Use `etAccordionLabel` instead when the header needs markup.                             |
| `isOpen`          | `false` | Whether the panel is expanded. Two-way bindable (`[(isOpen)]`).                                           |
| `isOpenByDefault` | `false` | Expand on first render. Only the initial value is honoured - a later change never reopens a closed panel. |
| `disabled`        | `false` | Refuse to toggle. The header stays focusable and is marked `aria-disabled` rather than natively disabled. |
| `headingLevel`    | `3`     | The heading level the header reports (`1`–`6`), so the accordion slots into the page outline.             |

### Group inputs

| Input                | Default | Description                                                                        |
| -------------------- | ------- | ---------------------------------------------------------------------------------- |
| `autoCloseOthers`    | `false` | Keep at most one panel open - expanding one collapses the rest.                    |
| `preventCloseLast`   | `false` | Keep at least one panel open - collapsing the last open one does nothing.          |
| `arrowKeyNavigation` | `true`  | Move focus between headers with `ArrowUp`/`ArrowDown`, and jump with `Home`/`End`. |

Leaving `autoCloseOthers` off lets a reader compare two sections side by side; turn it
on when the panels are long enough that several open at once push the headers off
screen. When two accordions both start open under `autoCloseOthers`, the first in DOM
order wins.

### Always keeping one open

`preventCloseLast` is the other half: clicking the header of the only open panel does
nothing. Together with `autoCloseOthers` the group behaves like a radio set - exactly one
section open at a time, which is the right shape for a set of mutually exclusive views.

```html
<et-accordion-group autoCloseOthers preventCloseLast>…</et-accordion-group>
```

<StoryEmbed id="components-layout-accordion--always-one-open" height="360px" />

Two things it deliberately does not do:

- **It doesn't mark the header `aria-disabled`.** The control isn't disabled - it works, and
  it will collapse the moment another panel is open. Announcing it as disabled would be wrong
  a second later, and it would also stop conveying `aria-expanded="true"`, which is the state
  that actually matters here.
- **It doesn't force a panel open.** A group that starts with everything closed stays that
  way until the user opens something; the rule is about not losing the last one, not about
  guaranteeing one from the start. Use `isOpenByDefault` on a panel if you want one.

It gates the header's own toggle. `close()`, `closeAll()` and writing `[(isOpen)]` still
collapse the panel - the same way they ignore `disabled` - so a "collapse everything" control
keeps working.

The group's directive also exposes `openAll()` and `closeAll()` for a "expand
everything" control - grab it with `#group="etAccordionGroup"`. `openAll()` does
nothing while `autoCloseOthers` is on, since it would immediately undo itself.

## Rich headers

`label` covers plain text. For anything else, project the two header slots:

```html
<et-accordion>
  <ng-template etAccordionLabel> <et-icon name="warning" /> Unsaved changes </ng-template>
  <ng-template etAccordionHint>3 items</ng-template>

  Your draft is kept locally until you publish it.
</et-accordion>
```

The hint sits between the label and the chevron in muted text - a summary of what's
inside ("3 items", "Optional"), not a second label.

## Deferred content

Children projected into `<et-accordion>` are created with their parent, whether the
panel ever opens or not. When the panel holds something expensive - a table, a chart, a
component that fetches - put it in an `etAccordionContent` template instead: it is
created on the first expand and then stays mounted, so collapsing keeps its state and
still has something to animate.

```html
<et-accordion label="Revenue">
  <ng-template etAccordionContent>
    <app-revenue-chart />
  </ng-template>
</et-accordion>
```

<StoryEmbed id="components-layout-accordion--lazy-content" height="360px" />

## Headless

`ACCORDION_IMPORTS` also ships the behavior on its own, with no chrome: `etAccordion`
owns the state and the ids, `etAccordionTrigger` wires up `aria-expanded` /
`aria-controls` and toggles on click, `etAccordionPanel` carries `role="region"`,
`aria-labelledby` and `inert`, and `etAccordionGroup` adds single-open and arrow keys.

```html
<div etAccordionGroup autoCloseOthers>
  <div #accordion="etAccordion" etAccordion>
    <h3>
      <button etAccordionTrigger type="button">Own markup {{ accordion.isOpen() ? '−' : '+' }}</button>
    </h3>

    @if (accordion.isOpen()) {
    <div etAccordionPanel>Rendered only while open - no height animation needed.</div>
    }
  </div>
</div>
```

Put the trigger on a native `<button>`: that is what gives you Enter/Space, focus and
the right role for free. A panel may be rendered conditionally as above - the trigger
drops its `aria-controls` while the panel isn't in the DOM, rather than pointing at a
missing id.

<StoryEmbed id="components-layout-accordion--headless" height="320px" />

## Accessibility

The default component emits the ARIA accordion pattern:

- A `role="heading"` wrapper with `aria-level` (from `headingLevel`) around a native
  `<button>`, so the headers appear in the page's heading outline. One element with a
  level input instead of six `<h1>`–`<h6>` branches; assistive tech treats them the same.
- The trigger carries `aria-expanded` and `aria-controls`; the panel carries
  `role="region"` and `aria-labelledby` pointing back at the trigger.
- A collapsed panel is `inert` (nothing inside it can be focused or clicked) and
  `visibility: hidden`, which also keeps it out of find-in-page and the accessibility
  tree until it opens.
- `disabled` marks the trigger `aria-disabled="true"` instead of natively disabling it,
  so the header stays focusable and announces that it won't expand.

| Key                     | Action                                                         |
| ----------------------- | -------------------------------------------------------------- |
| `Enter` / `Space`       | Toggle the focused header (native `<button>` behavior).        |
| `ArrowDown` / `ArrowUp` | Move focus to the next/previous header in the group, wrapping. |
| `Home` / `End`          | Move focus to the first/last header in the group.              |

Arrow-key navigation only acts on the group's own headers, so the same keys keep
working normally inside panel content; switch it off entirely with
`[arrowKeyNavigation]="false"`.

The collapse animation is a `grid-template-rows` transition, dropped under
`prefers-reduced-motion: reduce` - expanding then happens instantly instead of being
paused mid-way.

## Theming

Colours come from the app-registered [surface and color themes](/core/theming): text
and hairlines from the surface tokens, the hover/press tint mixed from
`--et-surface-interaction-solid`, and the focus ring from
`--et-theme-color-primary-solid`. Geometry and timing are tokens:

| Property                        | Default | Applies to                                                 |
| ------------------------------- | ------- | ---------------------------------------------------------- |
| `--et-accordion-padding-block`  | `14px`  | header padding, and the panel's bottom padding             |
| `--et-accordion-padding-inline` | `0px`   | header and panel side padding - raise it for a boxed group |
| `--et-accordion-gap`            | `12px`  | gap between label, hint and chevron                        |
| `--et-accordion-chevron-size`   | `14px`  | chevron box                                                |
| `--et-accordion-radius`         | `0px`   | the hover tint's shape - raise it when the group is a card |
| `--et-accordion-duration`       | `240ms` | collapse and chevron rotation                              |
| `--et-accordion-color-duration` | `120ms` | the header's hover response - tint, hairline and chevron   |

### The hover response

Hovering a header does three things at once, all on `--et-accordion-color-duration`: the row takes
its tint, the accordion's own bottom hairline brightens toward
`--et-surface-interaction-solid`, and the hint and chevron come up from the muted colour to full
strength. Across a full-width header the tint alone is easy to miss - the hairline is the edge that
actually shows which row the pointer is on.

All three are behind `@media (hover: hover)`, so a touch device never gets a highlight stuck on the
last row tapped, and a header that is `disabled` responds to none of them.

Under `prefers-reduced-motion: reduce` the chevron stops rotating but keeps its colour fade - a
cross-fade is not motion.

Every accordion brings its own bottom hairline and the group drops the trailing one, so
a boxed group is a border and a radius away without having to undo anything:

```css
.faq {
  border: 1px solid var(--et-surface-border-solid);
  border-radius: 12px;
  --et-accordion-padding-inline: 16px;
}
```

## Error codes

The accordion throws `ET36xx` in dev mode when its parts are misplaced (a trigger,
panel or slot template outside an `[etAccordion]`, or an accordion with no trigger) -
see [error codes](/components/error-codes#accordion-et36xx).
