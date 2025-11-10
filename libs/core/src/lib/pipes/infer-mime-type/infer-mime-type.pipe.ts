import { Pipe, PipeTransform } from '@angular/core';
import { inferMimeType } from './infer-mime-type.util';

@Pipe({
  name: 'inferMimeType',
})
export class InferMimeTypePipe implements PipeTransform {
  transform = inferMimeType;
}
