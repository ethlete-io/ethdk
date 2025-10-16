import { ComponentType } from '@angular/cdk/portal';
import { Injectable, InjectionToken, Provider, computed, inject, isDevMode } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { cloneFormGroup, controlValueSignal, getFormGroupValue } from '@ethlete/core';
import {
  AnyQuery,
  ExperimentalQuery,
  QueryResponseOf,
  QueryState,
  isQueryStateFailure,
  isQueryStateLoading,
  isQueryStateSuccess,
  queryComputed,
  switchQueryState,
} from '@ethlete/query';
import { OverlayRef } from './overlay-ref';

export const FILTER_OVERLAY_CONFIG = new InjectionToken<FilterOverlayConfig>('FILTER_OVERLAY_CONFIG');

 
export type FilterOverlayConfig<
  F extends FormGroup<any> = FormGroup<any>,
  Q extends AnyQuery | ExperimentalQuery.AnyLegacyQuery = AnyQuery,
> = {
  /**
   * The form to use.
   */
  form: F;

  /**
   * The default form value. Used when the form is reset.
   */
  defaults?: ReturnType<F['getRawValue']>;

  /**
   * A function to create a query based on the form value.
   */
  searchPreviewQueryFn?: (formValue: ReturnType<F['getRawValue']>) => Q;

  /**
   * A function to extract the total hits from the response.
   * @default `response.totalHits`
   */
  totalHitsExtractorFn?: (response: QueryResponseOf<Q>) => number;

  /**
   * A function to create the submit button config based on the query state and the total hits.
   * If a german translation is needed, manually provide the `defaultSubmitButtonConfigFn` and set the locale to `de`.
   * @default defaultSubmitButtonConfigFn()
   */
  submitButtonConfigFn?: (
    config: DefaultSubmitButtonConfigFnConfig<QueryResponseOf<Q>>,
  ) => FilterOverlaySubmitButtonConfig;
};

export type FilterOverlaySubmitButtonConfig = {
  label: string;
  disabled: boolean;
};

export type DefaultSubmitButtonConfigFnConfig<ResponseType = unknown> = {
  queryState: QueryState<ResponseType> | null;
  totalHits: number | null;
  locale?: 'en' | 'de';
};

export const defaultSubmitButtonConfigFn = (
  config: DefaultSubmitButtonConfigFnConfig,
): FilterOverlaySubmitButtonConfig => {
  const { queryState, totalHits, locale = 'en' } = config;

  const isInitializing = queryState === null && totalHits === null;

  if (isQueryStateLoading(queryState) || isInitializing) {
    return {
      disabled: true,
      label: locale === 'en' ? 'Loading results...' : 'Lade Ergebnisse...',
    };
  } else if (isQueryStateFailure(queryState)) {
    return {
      disabled: true,
      label: locale === 'en' ? 'An error occurred' : 'Ein Fehler ist aufgetreten',
    };
  } else if (totalHits !== null) {
    if (totalHits === 0) {
      return {
        disabled: true,
        label: locale === 'en' ? 'No results found' : 'Keine Ergebnisse gefunden',
      };
    } else if (totalHits === 1) {
      return {
        disabled: false,
        label: locale === 'en' ? 'Show one result' : 'Zeige ein Ergebnis',
      };
    } else if (totalHits > 250) {
      return {
        disabled: false,
        label: locale === 'en' ? 'Show more than 250 results' : 'Zeige mehr als 250 Ergebnisse',
      };
    } else {
      return {
        disabled: false,
        label: locale === 'en' ? `Show ${totalHits} results` : `Zeige ${totalHits} Ergebnisse`,
      };
    }
  }

  if (isDevMode()) {
    console.error(
      'The default submit button config function resulted in an unknown state. The fallback state might be invalid and should be checked.',
      config,
    );
  }

  // This should never happen
  return {
    disabled: true,
    label: locale === 'en' ? 'No results found' : 'Keine Ergebnisse gefunden',
  };
};

export type FilterOverlayResult<FormValue = unknown> =
  | {
      didUpdate: false;
    }
  | {
      didUpdate: true;
      formValue: FormValue;
    };

@Injectable()
export class FilterOverlayService<F extends FormGroup, C extends ComponentType<unknown> | unknown = unknown> {
  config = inject<FilterOverlayConfig<F>>(FILTER_OVERLAY_CONFIG);
  overlayRef = inject<OverlayRef<C, FilterOverlayResult>>(OverlayRef);

  form = cloneFormGroup(this.config.form as F);

  formValue = controlValueSignal(this.form);
  searchPreviewQuery = queryComputed(() => {
    const formVal = this.formValue();

    if (!this.config.searchPreviewQueryFn || !formVal) {
      return null;
    }

    return this.config.searchPreviewQueryFn(formVal);
  });

  searchPreviewQueryState = toSignal(toObservable(this.searchPreviewQuery).pipe(switchQueryState()), {
    initialValue: null,
  });

  searchPreviewTotalHits = computed(() => {
    const state = this.searchPreviewQueryState();

    if (isQueryStateSuccess(state)) {
      if (this.config.totalHitsExtractorFn) {
        return this.config.totalHitsExtractorFn(state.response);
      }

      if (!state.response || typeof state.response !== 'object' || !('totalHits' in state.response)) {
        console.error(`The response does not contain a totalHits property.`, state.response);
        return null;
      }

      return state.response.totalHits as number;
    }

    return null;
  });

  submitButtonConfig = computed(() => {
    const state = this.searchPreviewQueryState();
    const totalHits = this.searchPreviewTotalHits();

    return (
      this.config.submitButtonConfigFn?.({ queryState: state, totalHits }) ??
      defaultSubmitButtonConfigFn({ queryState: state, totalHits })
    );
  });

  submit() {
    const value = getFormGroupValue(this.form);
    this.config.form.setValue(value);

    this.close({ didUpdate: true, formValue: value });
  }

  reset() {
    if (!this.config.defaults) {
      throw new Error(`The default form value is not defined.`);
    }

    this.form.patchValue(this.config.defaults);
  }

  close(data?: FilterOverlayResult) {
    this.overlayRef?.close(data);
  }
}

 
export const provideFilterOverlayConfig = <
  F extends FormGroup<any> = FormGroup<any>,
  Q extends AnyQuery | ExperimentalQuery.AnyLegacyQuery = AnyQuery,
>(
  config: FilterOverlayConfig<F, Q>,
): Provider[] => {
  return [
    {
      provide: FILTER_OVERLAY_CONFIG,
      useValue: config,
    },
  ];
};
