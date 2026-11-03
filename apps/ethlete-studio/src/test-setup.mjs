import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { afterEach } from 'vitest';
import { watchSdkErrors } from './test-sdk-errors';

const takeSdkErrors = watchSdkErrors(console);
const loggedErrors = [];
const logError = console.error.bind(console);

console.error = (...args) => {
  loggedErrors.push(args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' '));
  logError(...args);
};

afterEach(() => {
  const problem = takeSdkErrors();
  const errors = loggedErrors.splice(0);

  if (problem) throw new Error(problem);

  if (errors.length > 0)
    throw new Error(`the test logged console.error:\n${errors.map((line) => `  ${line}`).join('\n')}`);
});

setupTestBed();

globalThis.IntersectionObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
  takeRecords() {
    return [];
  }
};

globalThis.ResizeObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};

if (typeof document !== 'undefined') {
  const blockHosts = document.createElement('style');

  blockHosts.textContent = 'ethlete-design-canvas, ethlete-canvas-viewport, et-form-field { display: block; }';
  document.head.append(blockHosts);

  if (!document.fonts) {
    Object.defineProperty(document, 'fonts', {
      value: Object.assign(new EventTarget(), { ready: Promise.resolve() }),
      configurable: true,
    });
  }
}
