import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMatchType } from './normalize-match-type.util';

@Pipe({ name: 'etNormalizeMatchType', standalone: true })
export class NormalizeMatchTypePipe implements PipeTransform {
  transform = normalizeMatchType;
}
