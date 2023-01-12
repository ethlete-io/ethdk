import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMatchParticipants } from './normalize-match-participants.util';

@Pipe({ name: 'etNormalizeMatchParticipants', standalone: true })
export class NormalizeMatchParticipantsPipe implements PipeTransform {
  transform = normalizeMatchParticipants;
}
