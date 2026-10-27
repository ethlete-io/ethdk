import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';

setupTestBed();

globalThis.IntersectionObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
  takeRecords() {
    return [];
  }
};
