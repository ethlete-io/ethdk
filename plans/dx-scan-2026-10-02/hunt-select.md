# hunt-select — bug hunt 2026-10-10

Scope: `libs/components/src/lib/forms/select`, `forms/cascader`, `forms/selection-list`, `forms/tag-input`,
`forms/choice-field`. Read-only hunt; findings already in `select.md` (SEL-01..09) are not repeated.

| ID    | Sev    | Kind | Decision | Title                                                                                                      |
| ----- | ------ | ---- | -------- | ---------------------------------------------------------------------------------------------------------- |
| HS-01 | High   | bug  | no       | Select separator / Tab / paste / close commits store an option's label as a custom string, not its value   |
| HS-02 | Medium | bug  | no       | `et-tag-input` throws on a `null` value (`.length` of null)                                                |
| HS-03 | Medium | bug  | no       | With `valueKey`, windowed data rows never attach their element (registry looked up by value, keyed by key) |
| HS-04 | Medium | bug  | no       | Closed-trigger typeahead emits `pickOption` on every keystroke (pickOnly single select picks repeatedly)   |
| HS-05 | Medium | bug  | yes      | A preselected value with no loaded option renders as the raw string id, or as an empty chip / placeholder  |
| HS-06 | Low    | bug  | no       | Cascader search commits a node under a disabled branch that browsing cannot reach                          |
| HS-07 | Low    | bug  | no       | Select paste silently drops the pieces `maxSelection` / `normalizeValue` refused (tag input keeps them)    |

## HS-01 Select separator / Tab / paste / close commits store an option's label as a custom string, not its value

- Status: fixed

- Where: `libs/components/src/lib/forms/select/headless/select-search.directive.ts:208-217` (character separator),
  `:231-245` (key separator, e.g. `'Tab'`), `:282-306` (paste); `select.directive.ts` `handlePanelBeforeClosed`
  (`commitCustomValueOnClose`) - all call `commitCustomValue` / `applyCustomValue`
  (`select.directive.ts` `applyCustomValue`), which only checks `includesValue(values, normalized)`.
- Problem: the duplicate-label guard lives only in `customValueCandidate` (the "Create …" row). The guide
  promises the same rule for every commit (`apps/docs/components/select.md:316`: a query is committable only
  when it is "neither an existing selection nor an exact label match of a visible option"). Input:
  `<et-select multiple allowCustomValues [separators]="[',']">` with
  `<et-select-option value="apple">Apple</et-select-option>`; type `Apple,` → value becomes `['Apple']`
  (a custom string chip), the `apple` option stays unchecked; typing `Apple,` again after picking the option
  gives `['apple', 'Apple']`. Same with `separators=['Tab']` (type `Apple`, Tab: the active `Apple` option is
  ignored), with a paste of `Apple, Pear`, and with `commitCustomValueOnClose` + outside click. Only Enter is
  correct, because it commits the active option first. With id values (`[value]="user.id"`) the form gets a
  label string where an id is expected.
- Fix: in `applyCustomValue`, before writing, look up a visible, enabled, non-`custom` item whose label
  equals the normalized text case-insensitively (the same test `customValueCandidate` uses); if found, commit
  that option's value instead (multi: add if not selected; single: `pickSingleOption`). Add specs next to
  `select.directive.spec.ts:919` ("commits custom values on separator characters") for separator, key
  separator, paste and close.
- Breaking: no. Decision: no.

## HS-02 `et-tag-input` throws on a `null` value

- Status: fixed

- Where: `libs/components/src/lib/forms/tag-input/headless/tag-input.directive.ts:51`
  (`effectiveValues = mixed() ? [] : this.value()`), read by `hasValue` (`:53`), `isFull` (`:67`), `add` (`:96`),
  `removeAt` (`:131`); `hasValue` is read by the form field shell (`form-field.directive.ts:151`).
- Problem: `<et-tag-input [formField]="form.tags">` where the API returned `{ tags: null }` (JSON null in a
  `string[]` field, a common shape) throws `Cannot read properties of null (reading 'length')` on first
  render. The select and cascader normalize `null`/`undefined` to `[]` and run `warnOnValueShapeMismatch`;
  the tag input does neither. No spec mounts it with `null`.
- Fix: `effectiveValues = computed(() => (this.mixed() ? [] : (this.value() ?? [])))` and read
  `this.value() ?? []` in `removeAt`; add a spec with `value = signal<string[] | null>(null)` that renders,
  adds a tag (`['a']`) and removes it.
- Breaking: no. Decision: no.

## HS-03 With `valueKey`, windowed data rows never attach their element

- Status: fixed

- Where: `libs/components/src/lib/forms/select/headless/select.directive.ts` `attachVirtualOptionElement` /
  `detachVirtualOptionElement` (`this.dataItemRegistry.get(item.value())`), versus the options effect and
  `rekeyDataItemRegistry`, which key the registry by `identify(data.value)` = `valueKey(value)`. Introduced
  with e72cc67a9.
- Problem: `<et-select [options]="teams" [valueKey]="byId">` with more than 40 options (windowing on, via
  `etSelectViewport`): `get(teamObject)` misses the `id` key, so `entry.element` stays `null` and
  `virtualWindow.measureItem` is never called. Consequences: row height stays at the 36px estimate (wrong
  paddings and scroll math for any other `--et-select-option-height`, size variant, or two-line row), and
  keyboard navigation never does the final `scrollIntoView`, relying on the estimate alone. Any `valueKey`
  that is not the identity triggers it (`(v) => v.id`, `(s) => s.toLowerCase()`). No spec combines
  `valueKey` with windowing (`select-value-key.spec.ts`, `select-virtual-options.spec.ts`).
- Fix: look up with `this.dataItemRegistry.get(this.valueIdentity()(item.value()))` in both methods (or
  store the key on `SelectDataItemEntry`). Add a spec: 100 object options + `valueKey`, open, assert the
  rendered row's `item.element()` is set and `ArrowDown` past the window scrolls the active row in.
- Breaking: no. Decision: no.

## HS-04 Closed-trigger typeahead emits `pickOption` on every keystroke

- Status: fixed

- Where: `libs/components/src/lib/forms/select/headless/select.directive.ts` `handleClosedKeydown` (default
  branch only skips `multiple()`), `commitOptionWhileClosed` → `pickSingleOption` (emits `pickOption`
  unconditionally).
- Problem: a single `et-select pickOnly` (supported and specced, `select.directive.spec.ts:1738`) with the
  trigger focused: typing `a` then `p` emits `pickOption('apple')` twice - `selectedItems()` is always empty
  in pickOnly mode, so the second search starts at index 0 and re-matches. A consumer that appends picks to
  a list gets duplicates, and every letter of a run is a separate pick. A normal single select also re-emits `pickOption` for an unchanged value on
  each typeahead character. Only the multi pickOnly case is covered (`:1786`).
- Fix: in `handleClosedKeydown`, skip closed typeahead when `pickOnly()` (as for `multiple()`), and in
  `commitOptionWhileClosed` emit `pickOption` only when the match differs from the current value. Add a spec
  to the `SelectDirective (pickOnly)` block: `press('a')` emits nothing.
- Breaking: no. Decision: no.

## HS-05 A preselected value with no loaded option renders as the raw string id, an empty chip, or the placeholder

- Status: fixed (user decision 2026-10-10: `displayWith` input on the select; the cascader closes the same gap through `resolvePath`)

- Where: `libs/components/src/lib/forms/select/headless/select.directive.ts` `selectedEntries` (label fallback
  `typeof entryValue === 'string' && entryValue !== '' ? entryValue : null`, independent of
  `allowCustomValues`); rendered at `select.component.html:23` (chip) and `:30-31` (trigger).
- Problem: the documented async setup (`[etSelectOptions]="users"` with `[value]="user.id"`) on an edit form
  whose stored `assignee` is not on the first page - or with `args` returning `null` for the empty query
  (`select.md:280`) - has no option for the value until the user searches for it. String ids show the raw
  id (`u_42` / a UUID) as the trigger text; numeric ids show the placeholder although `hasValue()` is true
  (clear button visible, label floated); in multi mode each such value renders as an empty removable chip.
  There is no input to supply a label for a value without a live option, and the guide does not say to
  render `etSelectValue` for this.
- Fix: add a `displayWith`/`valueLabel` input (`(value) => string | null`) consulted after the live option
  and the label cache; keep the raw-string fallback only when `allowCustomValues` is on. Document the
  edit-form case in the async section of `select.md` with a story.
- Breaking: no (raw-string fallback change is a visible behaviour change). Decision: yes (API name/shape).

## HS-06 Cascader search commits a node under a disabled branch

- Status: fixed

- Where: `libs/components/src/lib/forms/cascader/headless/cascader.directive.ts` `activateSearchResult`
  (`node.disabled` checks the last node only), `enabledSearchIndex`, `activateFocusedSearchResult`;
  `cascader-search-option.directive.ts:40` (`disabled` = last node only).
- Problem: the guide says node `disabled` "Blocks selecting and expanding" (`cascader.md:38`), and browsing
  honours it (`activateNode` and ArrowRight refuse a disabled branch). A data source whose `search` returns
  `[EU (disabled), Germany]` lists `Germany` as enabled and Enter commits it; a branch result under a disabled
  ancestor is drilled into via `browseToPath`. So a subtree the consumer disabled is reachable through search.
- Fix: treat a result as disabled when any node of its path is disabled (one helper used by
  `activateSearchResult`, `enabledSearchIndex`, the Enter fallback and `CascaderSearchOptionDirective`).
  Spec: search result under a disabled branch is `aria-disabled` and Enter does nothing.
- Breaking: no. Decision: no.

## HS-07 Select paste silently drops refused pieces

- Status: fixed

- Where: `libs/components/src/lib/forms/select/headless/select-search.directive.ts` `handlePaste`
  (`this.clear()` then `commitCustomValue(part)` for each part, results ignored). Tag input counterpart fixed
  in fd9195eef (`tag-input-field.directive.ts:151-153`).
- Problem: `<et-select multiple allowCustomValues [separators]="[',']" [maxSelection]="2">`, paste `a,b,c` →
  value `['a','b']`, and `c` is gone - the field is cleared. Same for parts `normalizeValue` rejects. The tag
  input keeps the refused pieces in the field so the user can fix them; the guide tells users to move from
  the tag input to the select.
- Fix: collect parts for which `commitCustomValue` returned `false` (and that are non-blank), and write them
  back into the query (`query.set` + `queryChange.emit`) like `TagInputFieldDirective.writeField`. Spec next
  to `select.directive.spec.ts:1001`.
- Breaking: no. Decision: no.
