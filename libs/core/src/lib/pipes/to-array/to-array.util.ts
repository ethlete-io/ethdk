import { TrackByFunction } from '@angular/core';

export const toArray = (value: number) => {
  return Array.from({ length: value }, (_, i) => i);
};

export const toArrayTrackByFn: TrackByFunction<number> = (_, item) => item;
