import { Pipe, PipeTransform } from '@angular/core';
import { parseHttpErrorCodeToMessageDe, parseHttpErrorCodeToTitleDe } from './parse-http-error-code-de';

@Pipe({
  name: 'parseHttpErrorCodeToTitleDe',
})
export class ParseHttpErrorCodeToTitleDePipe implements PipeTransform {
  transform = parseHttpErrorCodeToTitleDe;
}

@Pipe({
  name: 'parseHttpErrorCodeToMessageDe',
})
export class ParseHttpErrorCodeToMessageDePipe implements PipeTransform {
  transform = parseHttpErrorCodeToMessageDe;
}
