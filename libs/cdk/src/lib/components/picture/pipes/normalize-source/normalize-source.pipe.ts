import { Pipe, PipeTransform } from '@angular/core';
import { normalizeSource } from './normalize-source.util';

@Pipe({
  name: 'normalizeSource',
  standalone: true,
})
export class NormalizeSourcePipe implements PipeTransform {
  transform = normalizeSource;
}
