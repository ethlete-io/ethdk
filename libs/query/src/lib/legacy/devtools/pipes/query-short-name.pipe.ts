import { Pipe, PipeTransform } from '@angular/core';
import { AnyV2Query } from '../../query';

@Pipe({ name: 'queryShortName' })
export class QueryShortNamePipe implements PipeTransform {
  transform(value: AnyV2Query) {
    const route = value._routeWithParams;

    if (typeof route === 'string') {
      // given an url that looks like this: https://api.github.com/repos/EladBezalel/etimo-achievements or https://api.github.com/repos/EladBezalel/etimo-achievements?test=1&test2=2
      // we want to extract the last 3 parts of the url, so we get: repos/EladBezalel/etimo-achievements

      const parts = route.split('/');

      if (parts.length > 3) {
        return `.../${parts.slice(parts.length - 3).join('/')}`;
      }

      return route;
    }

    return route as string;
  }
}
