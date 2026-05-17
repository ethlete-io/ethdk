import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';

const isRecord = (value) => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return true;
};

const isJSDOMVirtualConsole = (value) => {
  if (!isRecord(value)) {
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

  const forwardJSDOMError = (error) => {
    if (isRecord(error) && Reflect.get(error, 'type') === 'css-parsing') {
      return;
    }

    for (const listener of listeners) {
      if (typeof listener === 'function') {
        listener(error);
      }
    }
  };

  virtualConsole.on('jsdomError', forwardJSDOMError);
};

setupTestBed();
suppressJSDOMCssParsingNoise();
