import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMatchParticipants } from './normalize-match-participants.util';

@Pipe({ name: 'etNormalizeMatchParticipants' })
export class NormalizeMatchParticipantsPipe implements PipeTransform {
  transform = normalizeMatchParticipants;
}
