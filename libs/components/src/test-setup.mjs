import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { applyStrictTestEnvironment } from '../../../tools/testing/strict-test-environment';

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
    const type = isRecord(error) ? Reflect.get(error, 'type') : undefined;

    if (type === 'css-parsing') {
      return;
    }

    // jsdom cannot navigate, but a download does it by clicking a real anchor at a blob url. Only
    // that one is dropped - any other unimplemented API still reports.
    if (
      type === 'not-implemented' &&
      String(Reflect.get(error, 'message')).includes('navigation to another Document')
    ) {
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
applyStrictTestEnvironment();
suppressJSDOMCssParsingNoise();
