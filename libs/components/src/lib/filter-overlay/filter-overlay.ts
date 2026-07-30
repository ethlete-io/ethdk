import { InjectionToken, Provider, Signal, computed, inject } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { equal } from '@ethlete/core';
import { QueryFormFields, QueryFormModel, QueryFormSignals } from '@ethlete/query';
import { OVERLAY_REF, OverlayRef } from '../overlay';
import {
  FilterOverlayLabels,
  injectFilterOverlayLabels,
  resolveFilterOverlaySubmitButton,
} from './filter-overlay-labels';
import {
  FilterOverlayPreview,
  FilterOverlayResult,
  FilterOverlaySubmitButton,
  FilterOverlaySubmitState,
} from './filter-overlay.types';

export type FilterOverlayConfig<TFields extends QueryFormFields> = {
  /**
   * The page's filter state. The overlay never edits it directly — it edits a detached branch and writes the
   * branch back on submit, which is what makes dismissing the overlay a discard.
   */
  queryForm: QueryFormSignals<TFields>;

  /**
   * A live count of what the draft would return, driving the submit button. Optional; without it the button just
   * says "Show results". Use {@link filterOverlayPreviewFromQuery} for the single-query case.
   */
  preview?: (draftValue: Signal<QueryFormModel<TFields>>) => FilterOverlayPreview;

  /**
   * Counts above this are reported as "more than N" rather than exactly. Past a few hundred the precise number
   * stops telling the reader anything they can act on. @default 250
   */
  maxCountedHits?: number;

  /** Full control over the submit button's label and disabled state, replacing the built-in resolver. */
  submitButton?: (state: FilterOverlaySubmitState, labels: FilterOverlayLabels) => FilterOverlaySubmitButton;
};

/**
 * The draft's editing surface — a query form branch, described by its **value** shape rather than by its field
 * map.
 *
 * That is deliberate and worth explaining: `QueryFieldDef<T>` is contravariant in `T` (it can hold a
 * `valueToQueryParam: (value: T) => unknown`), so a concrete field map does *not* satisfy
 * `Record<string, QueryFieldDef<unknown>>`. Inference copes, but an explicit type argument —
 * `injectFilterOverlay<typeof MY_FIELDS>()` — cannot be written at all. Naming the value shape sidesteps it, and
 * is what a consumer actually cares about. Structurally identical to `QueryFormBranch`.
 */
export type FilterOverlayDraft<TValue> = {
  /** The bindable signal-forms field tree: `draft.fields.search`. */
  readonly fields: FieldTree<TValue>;
  /** The draft's live value. */
  readonly value: Signal<TValue>;
  /** How many of the draft's *filters* are set — search, sort and pagination excluded. */
  readonly activeFilterCount: Signal<number>;
  setValue(value: TValue): void;
  patchValue(value: Partial<TValue>): void;
  resetFieldToDefault(key: keyof TValue): void;
  resetAllFieldsToDefault(): void;
};

/** The value shape of a query form, for naming a {@link FilterOverlay} without naming its field map. */
export type FilterOverlayValueOf<TForm> = TForm extends { value: Signal<infer TValue> } ? TValue : never;

export type FilterOverlay<TValue = unknown> = {
  /**
   * The draft being edited — bind its `fields` to your controls. A detached clone of the page's query form: its
   * own value, no URL writes, no reset graph, so nothing the reader does here affects the page until they submit.
   */
  draft: FilterOverlayDraft<TValue>;
  /** The live count, if the overlay was configured with one. */
  preview: FilterOverlayPreview | null;
  /** What the submit button should say, and whether it can be pressed. */
  submitButton: Signal<FilterOverlaySubmitButton>;
  /** The strings in effect, after locale and any overrides. */
  labels: Signal<FilterOverlayLabels>;
  /** How many filters the draft has set, for a badge on the overlay's own controls. */
  activeFilterCount: Signal<number>;
  /** Whether the draft differs from the filters actually applied — what "unsaved changes" means here. */
  hasChanges: Signal<boolean>;
  /**
   * Whether every field in the draft is still at its default, i.e. there is nothing for `reset()` to do.
   *
   * Not the same as `activeFilterCount() === 0`: the query form deliberately leaves navigation state (search,
   * page, sort) out of that count, so a reader who has typed a search has nothing to show in a badge but plenty
   * to reset.
   */
  isPristine: Signal<boolean>;
  /** Write the draft back to the page's filters and close. */
  submit: () => void;
  /** Put every filter back to its default, without closing. */
  reset: () => void;
  /** Close without applying anything. */
  discard: () => void;
};

/** The filter overlay provided for the current overlay component. Inject with `{ optional: true }` in a control
 *  that may also be used outside one. */
export const FILTER_OVERLAY_TOKEN = new InjectionToken<FilterOverlay>('FILTER_OVERLAY');

const createFilterOverlay = <TFields extends QueryFormFields>(
  config: FilterOverlayConfig<TFields>,
): FilterOverlay<QueryFormModel<TFields>> => {
  const overlayRef = inject<OverlayRef<object, FilterOverlayResult<QueryFormModel<TFields>>>>(OVERLAY_REF, {
    optional: true,
  });
  const labels = injectFilterOverlayLabels();

  const draft = config.queryForm.branch();
  const maxCountedHits = config.maxCountedHits ?? 250;

  // Called here, inside the overlay's injection context, which is why `preview` is a factory: a query created at
  // config time would belong to the page and outlive the overlay.
  const preview = config.preview?.(draft.value) ?? null;

  const submitButton = computed(() => {
    const state: FilterOverlaySubmitState = {
      totalHits: preview?.totalHits() ?? null,
      loading: preview?.loading() ?? false,
      hasError: preview?.hasError() ?? false,
      hasPreview: preview !== null,
      maxCountedHits,
    };

    return config.submitButton?.(state, labels()) ?? resolveFilterOverlaySubmitButton(state, labels());
  });

  const close = (result: FilterOverlayResult<QueryFormModel<TFields>>) => overlayRef?.close(result);

  return {
    draft,
    preview,
    submitButton,
    labels,
    activeFilterCount: draft.activeFilterCount,
    hasChanges: computed(() => !equal(draft.value(), config.queryForm.value())),
    isPristine: computed(() => equal(draft.value(), config.queryForm.defaultValue)),

    submit: () => {
      const value = draft.value();

      // Through `setValue` rather than by mutating fields: that is what fires the query form's reset graph (a new
      // search resetting the page number) and its URL sync, so the page's filters and the address bar agree.
      config.queryForm.setValue(value);
      close({ didUpdate: true, value });
    },

    reset: () => draft.resetAllFieldsToDefault(),

    discard: () => close({ didUpdate: false }),
  };
};

/**
 * Provides the filter overlay for an overlay component: a draft of the page's filters that the reader edits, a
 * live count of what those filters would return, and an explicit apply.
 *
 * The model is **edit a copy, then commit** — dismissing the overlay discards, which is what lets a filter panel
 * be closed with Escape without consequence. It is cdk's `FilterOverlayService` rebuilt on the signals query
 * form: no reactive-forms `FormGroup` to clone, no legacy query types, and `reset()` needs no configured defaults
 * because the query form already knows them.
 *
 * @example
 * export const FILTERS_OVERLAY = defineOverlay({ component: TeamFiltersComponent, … });
 *
 * @Component({
 *   providers: [
 *     provideFilterOverlay({
 *       queryForm: injectTeamFilters(),
 *       preview: filterOverlayPreviewFromQuery({
 *         queryCreator: searchTeams,
 *         args: (value) => ({ queryParams: { ...value, limit: 1 } }),
 *       }),
 *     }),
 *   ],
 * })
 * export class TeamFiltersComponent {
 *   protected filters = injectFilterOverlay();
 * }
 */
export const provideFilterOverlay = <TFields extends QueryFormFields>(
  config: FilterOverlayConfig<TFields>,
): Provider[] => [{ provide: FILTER_OVERLAY_TOKEN, useFactory: () => createFilterOverlay(config) }];

/**
 * The filter overlay provided above this component, typed to your filters' **value** shape:
 *
 * ```ts
 * const createTeamFilters = () => createQueryForm({ fields: TEAM_FILTER_FIELDS });
 * type TeamFilterValue = FilterOverlayValueOf<ReturnType<typeof createTeamFilters>>;
 *
 * protected filters = injectFilterOverlay<TeamFilterValue>();
 * ```
 */
export const injectFilterOverlay = <TValue = unknown>() => inject<FilterOverlay<TValue>>(FILTER_OVERLAY_TOKEN);
