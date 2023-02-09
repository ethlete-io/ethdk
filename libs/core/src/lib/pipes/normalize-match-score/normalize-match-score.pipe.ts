import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMatchScore } from './normalize-match-score.util';

@Pipe({ name: 'etNormalizeMatchScore', standalone: true })
export class NormalizeMatchScorePipe implements PipeTransform {
  transform = normalizeMatchScore;
}
