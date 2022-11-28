import { Pipe, PipeTransform } from '@angular/core';
import { toArray } from './to-array.util';

@Pipe({ name: 'toArray', standalone: true })
export class ToArrayPipe implements PipeTransform {
  transform = toArray;
}
