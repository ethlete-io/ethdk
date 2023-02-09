import { Pipe, PipeTransform } from '@angular/core';
import { normalizeGameResultType } from './normalize-game-result-type.util';

@Pipe({ name: 'etNormalizeGameResultType', standalone: true })
export class NormalizeGameResultTypePipe implements PipeTransform {
  transform = normalizeGameResultType;
}
