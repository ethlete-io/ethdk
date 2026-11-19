import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { map, merge, switchMap, timer } from 'rxjs';
import { injectHostPorts } from '../../host';
import { injectTimetrackSettings } from '../settings/settings';
import { receiveSharedSettings$, sendSharedSettings$ } from './shared-settings';

const RECEIVE_EVERY_MS = 30_000;

const SHARED_SETTINGS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const settings = injectTimetrackSettings();
  const settings$ = toObservable(settings.settings);

  settings.ready$
    .pipe(
      switchMap(() =>
        merge(
          receiveSharedSettings$({
            tick$: timer(0, RECEIVE_EVERY_MS),
            received$: () => ports.peers.receivedSettings$(),
            merge: settings.mergePeerSettings,
          }),
          sendSharedSettings$({
            settings$,
            ownKeys$: () => ports.peers.receivedSettings$().pipe(map((received) => received.ownRepoKeys)),
            send$: ports.peers.setSharedSettings$,
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {};
});

export const injectSharedSettings = /* @__PURE__ */ toInjectFn(SHARED_SETTINGS_DEF);
