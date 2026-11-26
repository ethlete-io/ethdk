import { toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { injectHostPorts } from '../../host';

/** The shared OAuth client the build carries, or `null` while it is read and in a build without one. */
const BUILT_IN_GOOGLE_CLIENT_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();

  return toSignal(ports.googleClient.builtIn$(), { initialValue: null });
});

export const injectBuiltInGoogleClient = /* @__PURE__ */ toInjectFn(BUILT_IN_GOOGLE_CLIENT_DEF);
