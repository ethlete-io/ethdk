import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';

setupTestBed();

globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};
