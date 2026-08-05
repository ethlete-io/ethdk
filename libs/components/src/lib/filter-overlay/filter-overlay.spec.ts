import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLocale } from '@ethlete/core';
import { provideRouter } from '@angular/router';
import { defineQueryForm, queryField } from '@ethlete/query';
import '../../test-helpers';
import { FilterOverlay, provideFilterOverlay } from './filter-overlay';
import { DEFAULT_FILTER_OVERLAY_LABELS, resolveFilterOverlaySubmitButton } from './filter-overlay-labels';
import { FilterOverlayPreview } from './filter-overlay.types';

const FIELDS = {
  search: queryField<string>({ defaultValue: '' }),
  region: queryField<string>({ defaultValue: 'all' }),
  page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'region'] }),
};

const createPreview = (overrides: Partial<Record<'loading' | 'hasError' | 'totalHits', unknown>> = {}) => {
  const loading = signal((overrides.loading as boolean) ?? false);
  const hasError = signal((overrides.hasError as boolean) ?? false);
  const totalHits = signal((overrides.totalHits as number | null) ?? null);

  return { preview: { loading, hasError, totalHits } as FilterOverlayPreview, loading, hasError, totalHits };
};

const setup = (config: { preview?: (v: never) => FilterOverlayPreview; maxCountedHits?: number } = {}) =>
  TestBed.runInInjectionContext(() => {
    // Observed, because `value()` is the *committed* value and nothing commits on an unobserved form. URL sync
    // is off: these assertions are about the draft/apply contract, not the address bar.
    const queryForm = defineQueryForm({ fields: FIELDS }).observe({
      writeToQueryParams: false,
      syncOnNavigation: false,
    });

    const providers = provideFilterOverlay({
      queryForm,
      preview: config.preview as never,
      maxCountedHits: config.maxCountedHits,
    });

    // The provider's factory is what builds the service; call it in this injection context directly rather than
    // standing up an overlay, which is not what these assertions are about.
    const factory = (providers[0] as { useFactory: () => FilterOverlay<typeof FIELDS> }).useFactory;

    return { queryForm, filterOverlay: factory() };
  });

describe('provideFilterOverlay', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideLocale(), provideRouter([{ path: '**', children: [] }])] }),
  );

  it('starts as a copy of the page filters', () => {
    const { queryForm, filterOverlay } = setup();

    expect(filterOverlay.draft.value()).toEqual(queryForm.value());
    expect(filterOverlay.hasChanges()).toBe(false);
  });

  it('leaves the page filters untouched while the draft is edited', () => {
    const { queryForm, filterOverlay } = setup();

    filterOverlay.draft.patchValue({ search: 'chemie' });

    expect(filterOverlay.draft.value().search).toBe('chemie');
    expect(queryForm.value().search).toBe('');
    expect(filterOverlay.hasChanges()).toBe(true);
  });

  it('writes the draft back on submit', () => {
    const { queryForm, filterOverlay } = setup();

    filterOverlay.draft.patchValue({ search: 'chemie', region: 'eu' });
    filterOverlay.submit();
    TestBed.tick();

    expect(queryForm.value()).toMatchObject({ search: 'chemie', region: 'eu' });
    expect(filterOverlay.hasChanges()).toBe(false);
  });

  it('goes through setValue on submit, so the reset graph fires', () => {
    const { queryForm, filterOverlay } = setup();

    queryForm.patchValue({ page: 5 });
    TestBed.tick();
    filterOverlay.draft.patchValue({ search: 'chemie' });
    filterOverlay.submit();
    TestBed.tick();

    // `page` is reset by `search`, and that only happens because submit writes through the query form.
    expect(queryForm.value().page).toBe(1);
  });

  it('resets the draft to defaults without touching the page filters', () => {
    const { queryForm, filterOverlay } = setup();

    queryForm.patchValue({ search: 'applied' });
    TestBed.tick();
    filterOverlay.draft.patchValue({ search: 'draft', region: 'eu' });
    filterOverlay.reset();

    expect(filterOverlay.draft.value()).toMatchObject({ search: '', region: 'all' });
    expect(queryForm.value().search).toBe('applied');
  });

  it('counts the draft filters that are not at their default', () => {
    const { filterOverlay } = setup();

    expect(filterOverlay.activeFilterCount()).toBe(0);

    // `search` and `page` are navigation state rather than filters, so the query form leaves them out of the
    // count by design - which is what makes this the right number for a badge.
    filterOverlay.draft.patchValue({ search: 'chemie', page: 3 });

    expect(filterOverlay.activeFilterCount()).toBe(0);

    filterOverlay.draft.patchValue({ region: 'eu' });

    expect(filterOverlay.activeFilterCount()).toBe(1);
  });

  describe('the submit button', () => {
    it('is enabled and generic without a preview', () => {
      const { filterOverlay } = setup();

      expect(filterOverlay.submitButton()).toEqual({ label: 'Show results', disabled: false });
    });

    it('follows the preview', () => {
      const { preview, loading, hasError, totalHits } = createPreview({ loading: true });
      const { filterOverlay } = setup({ preview: () => preview });

      expect(filterOverlay.submitButton()).toEqual({ label: 'Loading results…', disabled: true });

      loading.set(false);
      hasError.set(true);

      expect(filterOverlay.submitButton()).toEqual({ label: 'An error occurred', disabled: true });

      hasError.set(false);
      totalHits.set(0);

      expect(filterOverlay.submitButton()).toEqual({ label: 'No results found', disabled: true });

      totalHits.set(1);

      expect(filterOverlay.submitButton()).toEqual({ label: 'Show one result', disabled: false });

      totalHits.set(42);

      expect(filterOverlay.submitButton()).toEqual({ label: 'Show 42 results', disabled: false });
    });

    it('stops counting exactly past maxCountedHits', () => {
      const { preview } = createPreview({ totalHits: 900 });
      const { filterOverlay } = setup({ preview: () => preview, maxCountedHits: 500 });

      expect(filterOverlay.submitButton()).toEqual({ label: 'Show more than 500 results', disabled: false });
    });
  });
});

describe('resolveFilterOverlaySubmitButton', () => {
  const state = {
    totalHits: null as number | null,
    loading: false,
    hasError: false,
    hasPreview: true,
    maxCountedHits: 250,
  };

  it('waits when a preview exists but has not reported yet', () => {
    expect(resolveFilterOverlaySubmitButton(state, DEFAULT_FILTER_OVERLAY_LABELS)).toEqual({
      label: 'Loading results…',
      disabled: true,
    });
  });

  it('does not wait when there is no preview at all', () => {
    // cdk returned the loading state here, which left the button permanently disabled.
    expect(resolveFilterOverlaySubmitButton({ ...state, hasPreview: false }, DEFAULT_FILTER_OVERLAY_LABELS)).toEqual({
      label: 'Show results',
      disabled: false,
    });
  });

  it('reports the boundary count exactly', () => {
    expect(resolveFilterOverlaySubmitButton({ ...state, totalHits: 250 }, DEFAULT_FILTER_OVERLAY_LABELS).label).toBe(
      'Show 250 results',
    );
    expect(resolveFilterOverlaySubmitButton({ ...state, totalHits: 251 }, DEFAULT_FILTER_OVERLAY_LABELS).label).toBe(
      'Show more than 250 results',
    );
  });
});

describe('filter overlay pristine state', () => {
  it('is not the same as an empty filter count', () => {
    TestBed.configureTestingModule({ providers: [provideLocale(), provideRouter([{ path: '**', children: [] }])] });

    const { filterOverlay } = setup();

    expect(filterOverlay.isPristine()).toBe(true);

    // `search` is excluded from the filter count but is still something a reset has to clear.
    filterOverlay.draft.patchValue({ search: 'chemie' });

    expect(filterOverlay.activeFilterCount()).toBe(0);
    expect(filterOverlay.isPristine()).toBe(false);
  });
});
