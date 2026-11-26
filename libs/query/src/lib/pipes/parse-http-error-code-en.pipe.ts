import { Pipe, PipeTransform } from '@angular/core';
import { parseHttpErrorCodeToMessageEn, parseHttpErrorCodeToTitleEn } from './parse-http-error-code-en';

@Pipe({
  name: 'parseHttpErrorCodeToTitleEn',
})
export class ParseHttpErrorCodeToTitleEnPipe implements PipeTransform {
  transform = parseHttpErrorCodeToTitleEn;
}

@Pipe({
  name: 'parseHttpErrorCodeToMessageEn',
})
export class ParseHttpErrorCodeToMessageEnPipe implements PipeTransform {
  transform = parseHttpErrorCodeToMessageEn;
}
