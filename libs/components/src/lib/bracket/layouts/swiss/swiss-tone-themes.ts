import { computed, Signal } from '@angular/core';
import { ColorTheme } from '@ethlete/core';
import { BracketSwissGroupColorType, getSwissGroupColorType } from '@ethlete/bracket';
import { injectOptionalSemanticTheme } from '../../../internals/semantic-theme';

/**
 * The record tone of a swiss group id like `'1-0'` (wins-losses), or `'neutral'` for an id that is no record.
 * The record-to-tone rule itself is {@link getSwissGroupColorType}.
 */
export const swissRecordTone = (groupId: string | null | undefined): BracketSwissGroupColorType => {
  const [wins, losses] = (groupId ?? '').split('-').map(Number);

  if (wins === undefined || losses === undefined || isNaN(wins) || isNaN(losses)) return 'neutral';

  return getSwissGroupColorType(wins, losses);
};

/**
 * The app's semantic theme per swiss record tone - success, warning and error; `null` for the neutral tone and
 * for a type the app registered no theme of.
 */
export const injectSwissToneThemes = (): Signal<Record<BracketSwissGroupColorType, ColorTheme | null>> => {
  const success = injectOptionalSemanticTheme('success');
  const warning = injectOptionalSemanticTheme('warning');
  const error = injectOptionalSemanticTheme('error');

  return computed(() => ({ neutral: null, positive: success(), warning: warning(), negative: error() }));
};
