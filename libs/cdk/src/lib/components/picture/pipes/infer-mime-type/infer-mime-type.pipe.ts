import { Pipe, PipeTransform } from '@angular/core';
import { inferMimeType } from './infer-mime-type.util';

@Pipe({
  name: 'inferMimeType',
  standalone: true,
})
export class InferMimeTypePipe implements PipeTransform {
  transform = inferMimeType;
}
