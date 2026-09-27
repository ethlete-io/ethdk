# components misc-b scan - open findings

Scan of `libs/components/src/lib/{scrollbar,toggletip,tooltip,picture,filter-overlay,floating-action,query-error,chip,kbd,progress-steps,banner,avatar,skeleton,internals,toolbar,timeline,badge,empty-state,description-list,card,divider,copy-button,focus-ring}` from 2026-09-28. 0 High, 7 Medium, 25 Low, 4 Spec. Skipped: specs, stories, testing drivers, most CSS beyond the layer/colour check.

## picture, avatar (image URL handling)

- Medium: `withBaseUrl` treats a URL as absolute only if it starts with `http` or `data:` (`picture/picture.utils.ts:60`). A `blob:` preview URL or a protocol-relative `//cdn/…` gets the base URL in front and breaks, and a relative path such as `https-logo.png` does not get it. Test with a scheme regex (`/^[a-z][a-z\d+.-]*:/i`) plus `//`. S Verified: only bites when `baseUrl` is configured.
- Medium: `loadResetKey` keys on the `sources()` array identity (`picture/picture.component.ts:156`). A parent that passes a new array with the same srcsets resets the state to `loading`, but `@for … track source.srcset` keeps the DOM and the browser fires no new `load`, so the placeholder overlays a loaded image forever. Key on the resolved srcset strings instead. S Verified: the computed builds a new array on each `sources()` change, so the `linkedSignal` resets.
- Medium: the load state comes only from the `(load)`/`(error)` events (`picture/picture.component.html:23-24`). After SSR hydration an image that finished loading before the listeners attached never leaves `loading`. Check `img.complete`/`naturalWidth` once after render. S Verified: there is no `complete` check, and `load` does not bubble, so event replay cannot catch it.
- Low: `extractFirstImageUrl` splits a candidate on `' '` only (`picture/picture.utils.ts:22`). A srcset written across lines (`a.jpg\n1x`) returns `a.jpg\n1x` as the URL. Split on `/\s+/`, as `withPictureBaseUrl` already does. S
- Low: comments outside the allowlist - cdk narration at `picture/picture.utils.ts:57,68-69`, the "worth knowing" essay in the public JSDoc at `picture/picture.component.ts:27-31`, rationale at `avatar/avatar-group.component.ts:67,76-77`. S
- Low: the `+N` overflow avatar has no accessible label, so a screen reader reads "+3" with no context (`avatar/avatar-group.component.ts:34`). Add a label ("3 more") to the avatar labels. S
- Note: no security hole. Every URL is bound through `[src]`/`[attr.src]`/`[attr.srcset]` and goes through Angular's sanitizer. No `bypassSecurityTrust*` or `innerHTML` in scope.

## tooltip, toggletip

- Medium: every `etTooltip` instance appends a hidden description `<div>` to `document.body` at construction, even if it never shows (`tooltip/headless/tooltip.directive.ts:345-363`). A table with 1000 tooltip cells adds 1000 body nodes. Under SSR the server-made nodes serialize into the HTML, and hydration leaves them in place next to the client copies with the same ids. Create the node lazily on first focus/hover, or use `aria-description` for string content. M Verified: the node is made from a constructor `effect` for any string content, with no platform guard. It is not made when there is no string description.
- Low: tooltip and toggletip CSS is ~120 lines each and mostly the same (`tooltip/tooltip.component.css`, `toggletip/toggletip.component.css`). Both also hardcode the shadow colour `rgb(0 0 0 / 0.16)` (`tooltip.component.css:54`, `toggletip.component.css:47`). Move the shared rules to the floating-panel styles. M
- Low: `tooltip.utils.ts` and `toggletip.utils.ts` are the same module-global id counter. The lib has 15 of these. One shared helper would do. S
- Low: the same comment is repeated at `tooltip/tooltip.component.ts:39-40` and `toggletip/toggletip.component.ts:50-51`. S
- Low: `pressedVariant()` reads `data-variant` from the DOM in a host binding (`toggletip/headless/toggletip-trigger.directive.ts:90`). It is not reactive to a variant change while the toggletip is open. Read the button directive's variant signal. S

## toolbar

- Medium: `handleKeydown` takes ArrowLeft/Right, Home and End from every control, text inputs included (`toolbar/headless/toolbar.directive.ts:54-88`). A search `<input>` or `<select>` in a toolbar loses caret movement and option navigation. It also ignores modifiers, so Ctrl+Arrow is taken too. Skip the event when `isFormInputTarget(event.target)` or when a modifier is held. S Verified: `CONTROL_SELECTOR` includes `input, select, textarea`.
- Low: `afterEveryRender` runs `querySelectorAll` over the host twice per render (`toolbar/headless/toolbar.directive.ts:46,117-124`). Every toolbar on the page pays this on every change detection in the app. Re-sync from a `MutationObserver` or on `focusin` only. M Re-rated from Medium: the queries run over one small toolbar subtree, few toolbars sit on a page, and the tabIndex writes are skipped when unchanged.
- Low: `CONTROL_SELECTOR` misses `[tabindex]` and `[contenteditable]` elements, and `focusableControls` keeps hidden controls, so arrow navigation stops on a `display: none` control (`toolbar/headless/toolbar.directive.ts:5,113-115`). S
- Low: rationale comment at `toolbar/headless/toolbar.directive.ts:127-128`. S

## floating-action

- Medium: the parts set themselves on the parent in their constructor and never clear themselves on destroy (`floating-action/headless/floating-action-parts.directive.ts:63,87,114,139`). A scope inside `@if (results().length)` that is destroyed leaves its frozen `intersection()` in `state()`, so the trigger stays `hidden` or `floating` for the rest of the page. Reset the signal in `DestroyRef.onDestroy` when it still points at this part. S Verified: `signalHostElementIntersection` only disconnects on destroy and keeps its last entry. A scope destroyed while `isAbove` keeps the trigger hidden until a new scope registers.
- Low: migration narration and rationale in public JSDoc (`floating-action/headless/floating-action.directive.ts:36-42`, `floating-action-styles.component.ts:3-10`). S

## progress-steps, banner

- Medium: a step's state reaches assistive tech only as `aria-current` for `current`. The `complete`/`success`/`warning`/`error` icons are `aria-hidden` and have no text (`progress-steps/progress-step.component.html:3`), and the step number is CSS only. A screen reader user cannot tell that a step failed. Add a visually hidden state label from a labels set. S Verified.
- Low: `progress-step.component.ts:91-108` and `banner/banner.component.ts:102-126` repeat the same "inject the semantic theme by type inside an effect" block and the same comment. Extract one helper. S
- Low: `et-progress-steps` has no list semantics (`progress-steps/progress-steps.component.ts:27`), unlike `et-timeline`, which sets `role="list"`. S

## skeleton

- Low: `@for (line of lineList(); track line)` tracks the width (`skeleton/skeleton-text.component.ts:14`). The default is `[100, 100, 60]`, so every `et-skeleton-text` with 3 or more lines has duplicate keys and logs NG0955 in dev. Use `track $index`. S Re-rated from Medium (repro): the spec run logs NG0955, but it is a dev-only warning and the duplicate items are identical, so users see nothing.
- Low: `role="status"` together with a permanent `aria-busy="true"` (`skeleton/skeleton.component.ts:26-27`). Some screen readers hold back announcements in a busy region, so the loading text can go unread. Drop `aria-busy` from the status element. S

## query-error, filter-overlay

- Low: `@for (message of error.messages; track message)` (`query-error/query-error.component.html:16`). Violation lists often repeat a message ("This value should not be blank.") and give duplicate keys. Use `track $index`. S
- Low: `(Code: ${status})` is hardcoded outside the labels (`query-error/headless/query-error.directive.ts:89`). A German label set still gets English punctuation and "Code". Move it into `labels.message`. S
- Low: the preview counts the debounced `draft.value` (`filter-overlay/filter-overlay.ts:119`), but `submit` applies `draft.liveValue()` (`:145`). During a pending debounce the button shows the count for the old value. S
- Low: cdk narration and shape rationale in public JSDoc (`query-error/headless/query-error.directive.ts:15-19`, `filter-overlay/filter-overlay.ts:45-49,164-166`, `filter-overlay/filter-overlay-labels.ts:81-82`). S

## chip, copy-button, card

- Low: each remove button is labelled "Remove" with no chip name (`chip/headless/chip-remove.directive.ts:32`). A row of chips reads as "Remove, Remove, Remove". Include the chip label, or use `aria-describedby` to the label. S
- Low: `focusSuccessors` stays set when the consumer does not remove the chip after `remove` (for example a cancelled confirm). A later destroy then moves focus to a sibling (`chip/headless/chip.directive.ts:103,49-53`). Clear it after the next render. S
- Low: `copied()` changes only the icon. Nothing announces "Copied" to a screen reader (`copy-button/copy-button.directive.ts`). S
- Low: hardcoded shadow colour `rgb(0 0 0 / 0.12)` (`card/card.component.css:36`). S

## scrollbar, internals

- Low: comments outside the allowlist at `scrollbar/headless/scrollbar.directive.ts:103-104,110-111`. S
- Low: `createVirtualWindow` divides by `itemHeight()` with no guard (`internals/virtual-window.ts:134-135`). An estimate of `0` gives a `NaN` range. Clamp the height to at least 1. S

## Spec gaps

- Spec: toolbar with an `<input>` inside, arrow keys and Home/End. S
- Spec: picture state after the parent passes new `sources` with the same URLs, and `withPictureBaseUrl` with `blob:` and `//` URLs. S
- Spec: floating-action with a scope or anchor that is destroyed. S
- Spec: no spec for progress-steps, banner or `internals/virtual-window.ts`. M
