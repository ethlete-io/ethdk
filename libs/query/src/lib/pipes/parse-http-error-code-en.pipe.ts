import { Pipe, PipeTransform } from '@angular/core';
import { parseHttpErrorCodeToMessageEn, parseHttpErrorCodeToTitleEn } from './parse-http-error-code-en';

@Pipe({
  name: 'parseHttpErrorCodeToTitleEn',
  standalone: true,
})
export class ParseHttpErrorCodeToTitleEnPipe implements PipeTransform {
  transform = parseHttpErrorCodeToTitleEn;
}

@Pipe({
  name: 'parseHttpErrorCodeToMessageEn',
  standalone: true,
})
export class ParseHttpErrorCodeToMessageEnPipe implements PipeTransform {
  transform = parseHttpErrorCodeToMessageEn;
}
