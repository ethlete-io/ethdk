import { Pipe, PipeTransform } from '@angular/core';
import { Translatable } from '../../utils';

@Pipe({ name: 'etNormalizeGameResultType' })
export class NormalizeGameResultTypePipe implements PipeTransform {
  transform = normalizeGameResultType;
}

export interface NormalizedGameResultType extends Translatable {
  shortCode: string;
}

// TODO(TRB): Add correct type once provided by API
export const normalizeGameResultType = (type: string | null): NormalizedGameResultType | null => {
  if (!type) {
    return null;
  }

  switch (type) {
    case 'extra_time':
      return {
        i18n: 'game-result-type.extra-time',
        shortCode: 'AET',
        text: 'After Extra Time',
      };

    case 'penalty':
      return {
        i18n: 'game-result-type.penalty',
        shortCode: 'PSO',
        text: 'Penalty shootout',
      };

    case 'golden_goal':
      return {
        i18n: 'game-result-type.golden-goal',
        shortCode: 'GG',
        text: 'Golden Goal',
      };

    case 'default':
    default:
      return {
        i18n: 'game-result-type.full-time',
        shortCode: 'FT',
        text: 'Full Time',
      };
  }
};
