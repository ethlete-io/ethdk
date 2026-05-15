/* eslint-disable no-restricted-globals */
import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';

const isJSDOMVirtualConsole = (value: unknown) => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    typeof Reflect.get(value, 'listeners') === 'function' &&
    typeof Reflect.get(value, 'removeAllListeners') === 'function' &&
    typeof Reflect.get(value, 'on') === 'function'
  );
};

const suppressJSDOMCssParsingNoise = () => {
  const virtualConsole = Reflect.get(window, '_virtualConsole');

  if (!isJSDOMVirtualConsole(virtualConsole)) {
    return;
  }

  const listeners = virtualConsole.listeners('jsdomError');

  virtualConsole.removeAllListeners('jsdomError');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  virtualConsole.on('jsdomError', (error: any) => {
    if (error.type === 'css-parsing') {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners.forEach((listener: any) => listener(error));
  });
};

setupTestBed();
suppressJSDOMCssParsingNoise();
