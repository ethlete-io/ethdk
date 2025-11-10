import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMatchScore } from './normalize-match-score.util';

@Pipe({ name: 'etNormalizeMatchScore' })
export class NormalizeMatchScorePipe implements PipeTransform {
  transform = normalizeMatchScore;
}
