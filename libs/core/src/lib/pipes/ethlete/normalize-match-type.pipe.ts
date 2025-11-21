import { Pipe, PipeTransform } from '@angular/core';
import { StageType } from '@ethlete/types';
import { Translatable } from '../../utils';

@Pipe({ name: 'etNormalizeMatchType' })
export class NormalizeMatchTypePipe implements PipeTransform {
  transform = normalizeMatchType;
}

export const normalizeMatchType = (matchType: StageType | null | undefined): Translatable | null => {
  if (!matchType) {
    return null;
  }

  switch (matchType) {
    case 'double_elimination':
      return {
        i18n: 'match-type.double-elimination',
        text: 'Double Elimination',
      };
    case 'single_elimination':
      return {
        i18n: 'match-type.single-elimination',
        text: 'Single Elimination',
      };
    case 'fifa_swiss':
      return {
        i18n: 'match-type.fifa-swiss',
        text: 'FIFA Swiss',
      };
    case 'groups':
      return {
        i18n: 'match-type.groups',
        text: 'Groups',
      };
    case 'league':
      return {
        i18n: 'match-type.league',
        text: 'League',
      };
    case 'pools':
      return {
        i18n: 'match-type.pools',
        text: 'Pools',
      };
  }
};
