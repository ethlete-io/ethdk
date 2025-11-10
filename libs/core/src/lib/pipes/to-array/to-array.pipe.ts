import { Pipe, PipeTransform } from '@angular/core';
import { toArray } from './to-array.util';

@Pipe({ name: 'toArray' })
export class ToArrayPipe implements PipeTransform {
  transform = toArray;
}
