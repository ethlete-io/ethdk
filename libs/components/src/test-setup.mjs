import '@analogjs/vitest-angular/setup-serializers';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import { afterAll, afterEach } from 'vitest';
import { applySdkRootFontSize } from '../../../tools/testing/sdk-root-font-size';
import { restoreProcessEmitAfterEachFile } from '../../../tools/testing/restore-process-emit';
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

const failOnDestroyedOutputEmit = () => {
  const emits = [];
  const warn = console.warn;

  console.warn = (...args) => {
    if (args.some((arg) => String(arg).includes('NG0953'))) {
      emits.push(`${args.map(String).join(' ')}\n${new Error().stack?.split('\n').slice(2).join('\n')}`);
    }

    warn.apply(console, args);
  };

  const throwCollected = () => {
    if (emits.length === 0) {
      return;
    }

    const messages = emits.splice(0);

    throw new Error(`An output emitted after its owner was destroyed:\n${messages.join('\n')}`);
  };

  // Runs before Angular's own teardown hook, so the module is torn down here first: an emit from a
  // destroy callback then fails the test that caused it, not the next one.
  afterEach(() => {
    getTestBed().resetTestingModule();
    throwCollected();
  });
  afterAll(throwCollected);
};

restoreProcessEmitAfterEachFile();
setupTestBed();
applyStrictTestEnvironment();
applySdkRootFontSize();
suppressJSDOMCssParsingNoise();
failOnDestroyedOutputEmit();
