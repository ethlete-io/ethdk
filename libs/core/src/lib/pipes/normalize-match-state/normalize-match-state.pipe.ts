import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMatchState } from './normalize-match-state.util';

@Pipe({ name: 'etNormalizeMatchState' })
export class NormalizeMatchStatePipe implements PipeTransform {
  transform = normalizeMatchState;
}
