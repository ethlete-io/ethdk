import { Pipe, PipeTransform, TrackByFunction } from '@angular/core';

@Pipe({ name: 'toArray' })
export class ToArrayPipe implements PipeTransform {
  transform = toArray;
}

export const toArray = (value: number) => {
  return Array.from({ length: value }, (_, i) => i);
};

export const toArrayTrackByFn: TrackByFunction<number> = (_, item) => item;
