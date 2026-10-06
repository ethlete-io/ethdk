# select — DX scan 2026-10-02

Scope: `libs/components/src/lib/forms/select`, `forms/cascader`, `forms/selection-list`, `forms/tag-input`,
`forms/choice-field`; guides `apps/docs/components/select.md`, `cascader.md`, `choice-inputs.md`,
`text-inputs.md#tag-input`; their stories.

| ID     | Sev    | Kind     | Decision | Title                                                                                        |
| ------ | ------ | -------- | -------- | -------------------------------------------------------------------------------------------- |
| SEL-01 | Medium | bug      | no       | Select paste splits on every letter of a multi-character `customValueSeparators` entry       |
| SEL-02 | Medium | dx       | no       | `et-select` / `et-cascader` never show the async-validator busy state or feed `<et-counter>` |
| SEL-03 | Medium | dx       | no       | Selection-list groups have no `compareWith` / `valueKey`; object values select nothing       |
| SEL-04 | Medium | dx       | yes      | `et-select` has both `error` (panel load error) and `errors` (validation) inputs             |
| SEL-05 | Medium | dx       | no       | `et-radio` / `et-checkbox-option` outside a group fail silently (no dev-mode error)          |
| SEL-06 | Low    | dx       | yes      | Sibling naming drift: `maxSelection`/`maxTags`, `normalizeCustomValue`/`normalizeTag`, …     |
| SEL-07 | Low    | dx       | no       | Output tables in the select and cascader guides are incomplete                               |
| SEL-08 | Low    | dx       | no       | `selectOptionsFromQuery` JSDoc teaches the five-binding wiring the guide says not to use     |
| SEL-09 | Low    | test-gap | no       | `pickOnly` has no story; the tag-input guide has no live demo                                |

## SEL-01 Select paste splits on every letter of a multi-character `customValueSeparators` entry

- Status: fixed: shared `separatorPattern` helper (tag-input/headless/internals), select paste splices at the caret, dev-mode warning for entries longer than one character.

- Review: ok

- Where: `libs/components/src/lib/forms/select/headless/select-search.directive.ts:290-293`, input at
  `libs/components/src/lib/forms/select/headless/select.directive.ts:165`.
- Problem: the paste handler joins every separator into one regex character class:
  ``new RegExp(`[\\n${separators.map(escape).join('')}]`)``. A multi-character entry gets spread into
  single characters. The tag input uses the same input concept with key names
  (`separators = ['Enter', ',']`, `tag-input.directive.ts:44`), and both guides tell people to move from
  the tag input to the select (`text-inputs.md:445-451`, `select.md:312` "a superset of the tag input's
  behavior"). So a consumer who copies the tag-input value gets this:
  `<et-select multiple allowCustomValues [customValueSeparators]="['Enter', ',']">`. Pasting
  `Peter, Anne` splits on `[\nEnter,]` and commits `P`, `A`, … instead of `Peter` and `Anne`. Typing is
  not affected, because the keystroke path checks only `lastChar` (`select-search.directive.ts:218`).
  The select paste also ignores the text already in the field (it does not splice at the caret). The tag
  input does (`tag-input-field.directive.ts` `handlePaste`; text-inputs.md:479-481), so `pre` plus a
  pasted `one,two` gives different results in the two controls.
- Fix: build the pattern with alternation, like the tag input's `separatorPattern`
  (`['\\n', ...escaped].join('|')`), and skip entries whose length is not 1. Better still, share one helper
  between the two controls. Splice the paste into the current query at the caret, as the tag input does. Add a
  dev-mode warning when a `customValueSeparators` entry is longer than one character (Enter already
  commits). Add a spec next to `select.directive.spec.ts:943`.
- Breaking: no. Decision: no.

## SEL-02 `et-select` / `et-cascader` never show the async-validator busy state or feed `<et-counter>`

- Status: fixed: `pending` + `maxLength` on select and cascader, `pending` on the selection-list groups; forms.md updated.

- Review: fixed trimmed the maxLength/pending JSDoc; test audit: the groups rendered no busy state, now bind `aria-busy` while pending (spec added)

- Where: `libs/components/src/lib/forms/select/headless/select.directive.ts:122-136` and
  `libs/components/src/lib/forms/cascader/headless/cascader.directive.ts:127-142` declare no `pending`
  or `maxLength` inputs. Compare `tag-input/headless/tag-input.directive.ts:30-36` and
  `form-field/headless/text-field-control.directive.ts:57-63`. The shell reads
  `registeredControl()?.pending?.()` (`form-field/headless/form-field.directive.ts:144`).
- Problem: signal forms binds `pending` / `maxLength` only to controls that declare those inputs. The guide
  says the busy spinner needs "no wiring" (`apps/docs/components/forms.md:249`). Yet an
  `<et-select [formField]="form.assignee">` with an async validator ("user is still active") shows no
  spinner and no `aria-busy`. A multi select with a schema `maxLength(3)` gets no limit for `<et-counter />`.
  The tag input, which the guides tell users to replace with the select, does both.
- Fix: add `pending = input(false, { transform: booleanAttribute })` and
  `maxLength = input<number | undefined>()` to `SelectDirective` and `CascaderDirective`, the same way
  `TagInputDirective` does it, and forward both through the `hostDirectives` input lists of `et-select` and
  `et-cascader`. Consider `pending` for `SelectionListDirective` too. Update `forms.md:245` (the list of
  control families that receive `maxLength`).
- Breaking: no. Decision: no.

## SEL-03 Selection-list groups have no `compareWith` / `valueKey`; object values select nothing

- Status: fixed: `compareWith` on the three groups (no `valueKey`, per the product decision); choice-inputs.md documents it.

- Review: ok

- Where: `libs/components/src/lib/forms/selection-list/headless/selection-list.directive.ts:81-88`.
  `createSelectionState` gets no `compareWith`, although the state supports one
  (`selection-list/headless/internals/selection-state.ts` `compareWith?` config). Compare
  `select.directive.ts:149,156` and `cascader.directive.ts:151`.
- Problem: `et-select` and `et-cascader` both document `compareWith` for "a form model loaded from an
  API" (`select.md:90`, `cascader.md:143`). The three selection-list groups compare with `===`, and none of
  them gives a way to change that. `<et-radio-group [formField]="form.plan">` with
  `<et-radio [value]="plan">` over a refetched `plans()` list and an API-loaded `form.plan` shows nothing
  checked, and gives no warning. The same holds for `et-checkbox-group` with object arrays. Moving the same
  data from a select to a radio group silently breaks it.
- Fix: add `compareWith` (and `valueKey` for parity with the select) inputs to `SelectionListDirective`.
  Pass a null-guarded comparator into `createSelectionState` (copy `valuesMatch` from
  `select.directive.ts`). Forward both inputs from `et-checkbox-group`, `et-radio-group` and
  `et-segmented-button-group`, and document them in `choice-inputs.md`.
- Breaking: no. Decision: no.

## SEL-04 `et-select` has both `error` (panel load error) and `errors` (validation) inputs

- Where: `libs/components/src/lib/forms/select/headless/select.directive.ts:131` (`errors`) and
  `:180` (`errorInput`, alias `error`).
- Problem: two inputs one letter apart do unrelated things. `errors` is the signal-forms validation list.
  `error` is a string that renders an error row inside the panel for a failed option load. A consumer who
  wants to show a custom validation message reaches for `[error]="'Pick a team'"`, which renders a "failed
  to load" row in the open panel instead. The cascader solved the same need with a mapper,
  `toErrorMessage`, and no clashing name.
- Fix: rename the input to `loadError` (or `optionsError`). Keep the `SelectOptionsFromQuery.error`
  bundle field, or rename it to match. Update `select.md:49`, `:226`, `:248` and the
  `selectOptionsFromQuery` JSDoc.
- Breaking: yes. Decision: yes (name choice).
- Status: fixed (2026-10-06, user chose `loadError`, bundle keeps `error`; e175fc005, c84a77652; et update migration `select-input-renames`)

## SEL-05 `et-radio` / `et-checkbox-option` outside a group fail silently (no dev-mode error)

- Status: fixed: ET5200-ET5202 thrown at construction by et-radio / et-checkbox-option / et-segmented-button; bare etSelectionOption still standalone; error-codes.md updated.

- Review: ok

- Where: `libs/components/src/lib/forms/selection-list/headless/selection-option.directive.ts:42,98-115`.
  The selection-list folder has no `*-errors.ts` and no `RuntimeError`.
- Problem: when an option sits outside its group (a wrapper component, a group forgotten in a refactor),
  `list` is `null`. A click then flips the option's own `checked` model (`:113`). You get an `et-radio` with
  `role="radio"` that unchecks on a second click and is bound to no form. The select throws `ET1005`
  (`OPTION_OUTSIDE_SELECT`) for the same mistake, and the menu throws `ET1321` "A radio item is used
  without a surrounding selection group" (`apps/docs/components/error-codes.md:194`).
- Fix: add `selection-list-errors.ts` with a new code range. Throw a dev-mode `RuntimeError` after first
  render when `et-radio` / `et-segmented-button` / `et-checkbox-option` have no `SELECTION_LIST_TOKEN`. If
  standalone `etSelectionOption` toggling is meant to stay, keep it only for the bare headless directive.
  Document the code in `error-codes.md`.
- Breaking: no (dev-mode only). Decision: no.

## SEL-06 Sibling naming drift: `maxSelection`/`maxTags`, `normalizeCustomValue`/`normalizeTag`, …

- Where: `select.directive.ts:165,167,174`, `tag-input.directive.ts:44,47,48`,
  `cascader.directive.ts:172-173`.
- Problem: the guides present the select's custom-value mode as the tag input "plus a panel", but the same
  options have different names: `maxSelection` vs `maxTags`, `normalizeCustomValue` vs `normalizeTag`,
  and `customValueSeparators` (default `[]`, characters only) vs `separators` (default `['Enter', ',']`,
  key names too). Pending text commits on blur by default in the tag input but needs
  `commitCustomValueOnClose` in the select. `allowDuplicates` exists only on the tag input. Among the panel
  controls, `et-cascader` emits `afterOpen` / `afterClose` and `et-select` emits neither, so code that waits
  for the panel (focus a row, measure) works with one and not the other. Multi `et-cascader` has no
  `maxSelection` either. Each is small, but a consumer who switches between siblings has to learn every
  name again.
- Fix: pick one vocabulary. For example, `maxSelection` everywhere (alias or rename `maxTags`), `normalize`
  or `normalizeValue` on both, and `separators` on both with the same semantics (fixing SEL-01 first). Add
  `afterOpen` / `afterClose` to `SelectDirective` (the anchored-panel controller already has
  `onMounted` / `onAfterClosed`).
- Breaking: yes, for any rename. Decision: yes.
- Status: fixed (2026-10-06, user chose one vocabulary: `maxSelection`, `normalizeValue`, `separators`; `afterOpen`/`afterClose` on et-select; a228527ab; et update migration `select-input-renames`; open: a full cascader does not grey out unselected nodes)

## SEL-07 Output tables in the select and cascader guides are incomplete

- Status: fixed.

- Review: ok

- Where: `apps/docs/components/select.md:56-65`, `apps/docs/components/cascader.md:155-159`.
- Problem: the select table lists every output except `touch`, which `et-select.component.ts:86-96`
  forwards. The cascader table lists only `afterOpen`, `afterClose` and `openChange`. It leaves out
  `valueChange`, `mixedChange`, `touchedChange` and `touch`, which `cascader.component.ts:76` forwards. A
  reader cannot tell whether `(valueChange)` works on the cascader.
- Fix: add the missing rows, copying the wording of the select table.
- Breaking: no. Decision: no.

## SEL-08 `selectOptionsFromQuery` JSDoc teaches the five-binding wiring the guide says not to use

- Status: fixed.

- Review: ok

- Where: `libs/components/src/lib/forms/select/select-options-from-query.ts:70-103`,
  `select-options-from-v2-query.ts:74-107`.
- Problem: the IDE hover for both factories shows the long form, with `[loading]`, `[error]`,
  `[hasMoreItems]`, `(queryChange)`, `(loadMore)` and `filterMode="external"`. The guide says "Prefer
  [`[etSelectOptions]`] over wiring the inputs by hand" (`select.md:248`), and
  `SelectOptionsDirective` does all of it in one binding. A consumer who learns from the hover writes six
  bindings and can forget one (for example `filterMode`, which leaves the list filtering locally on top of
  the server).
- Fix: change the JSDoc examples to `<et-select [formField]="…" [etSelectOptions]="users">` and link the
  manual form as the escape hatch.
- Breaking: no. Decision: no.

## SEL-09 `pickOnly` has no story; the tag-input guide has no live demo

- Status: fixed: `PickOnly` story embedded in the command-picker section; tag-input default story embedded.

- Review: ok

- Where: `libs/components/src/lib/forms/select/stories/select.stories.ts` (19 stories, none sets
  `pickOnly`); `apps/docs/components/select.md` "command picker" section; `apps/docs/components/text-inputs.md:441-487`
  (no `<StoryEmbed>`, although `components-forms-tag-input--default` / `--max-tags` exist).
- Problem: `pickOnly` changes the control's contract (it never writes `value` and emits only `pickOption`),
  and only specs cover it. No story demonstrates it, so the Storybook vitest/axe pass and the e2e layer
  never render it. The tag-input section is the only control section on its page with no live demo.
- Fix: add a `PickOnly` story (multi + `pickOnly` feeding an external list) and embed it in the
  command-picker section. Embed `components-forms-tag-input--default` in the tag-input section.
- Breaking: no. Decision: no.
