import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { afterEach } from 'vitest';
import { watchSdkErrors } from './test-sdk-errors';

setupTestBed();

globalThis.IntersectionObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
  takeRecords() {
    return [];
  }
};

const takeSdkErrors = watchSdkErrors(console);

afterEach(() => {
  const problem = takeSdkErrors();

  if (problem) throw new Error(problem);
});
